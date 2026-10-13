import {
  Injectable,
  NotFoundException,
  Logger,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  NotificationChannel,
  NotificationStatus,
} from '@prisma/client';
import { ConsoleEmailProvider } from './providers/console-email.provider';
import { SmtpEmailProvider } from './providers/smtp-email.provider';
import { UpdateNotificationPreferencesDto } from './dto/update-preferences.dto';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';

export interface SendNotificationParams {
  organizationId: string;
  recipientUserId: string;
  title: string;
  message: string;
  channel?: NotificationChannel;
  category?: 'SECURITY' | 'PAYMENT' | 'MEMBERSHIP' | 'ANNOUNCEMENT' | 'SYSTEM';
  actionUrl?: string;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(ConsoleEmailProvider)
    private readonly consoleEmailProvider: ConsoleEmailProvider,
    @Inject(SmtpEmailProvider)
    private readonly smtpEmailProvider: SmtpEmailProvider,
  ) {}

  /**
   * Idempotent & preference-aware notification dispatcher.
   */
  async sendNotification(params: SendNotificationParams) {
    const {
      organizationId,
      title,
      message,
      channel = NotificationChannel.IN_APP,
      category = 'SYSTEM',
      actionUrl,
      metadata = {},
      idempotencyKey,
    } = params;
    const recipientUserId = params.recipientUserId || (params as any).userId;

    // 1. Idempotency Check: Prevent duplicate generation for same event
    if (idempotencyKey) {
      const existing = await this.prisma.withPlatformAdminContext((tx) =>
        tx.notification.findFirst({
          where: { organizationId, idempotencyKey },
        }),
      );
      if (existing) {
        this.logger.log(
          `Idempotent notification hit for key "${idempotencyKey}". Skipping duplicate.`,
        );
        return {
          isDuplicate: true,
          notification: existing,
        };
      }
    }

    // 2. Preference Enforcement
    const preference = await this.prisma.withPlatformAdminContext((tx) =>
      tx.notificationPreference.findUnique({
        where: {
          organizationId_userId: { organizationId, userId: recipientUserId },
        },
      }),
    );

    // Security & payment events are non-opt-outable
    const isCritical = category === 'SECURITY' || category === 'PAYMENT';
    const emailAllowed = isCritical || (preference ? preference.emailEnabled : true);
    const inAppAllowed = isCritical || (preference ? preference.inAppEnabled : true);

    let createdNotification: any = null;

    // 3. Create In-App Notification Record under Tenant Context
    if (inAppAllowed) {
      try {
        createdNotification = await this.prisma.withTenantContext(
          organizationId,
          async (tx) => {
            return tx.notification.create({
              data: {
                organizationId,
                recipientUserId,
                idempotencyKey,
                title: title.trim(),
                message: message.trim(),
                channel,
                status: NotificationStatus.UNREAD,
                actionUrl,
                metadata: {
                  ...metadata,
                  category,
                },
              },
            });
          },
        );
      } catch (err: any) {
        if (err?.code === 'P2002' && idempotencyKey) {
          this.logger.log(
            `Concurrent insert conflict on idempotencyKey "${idempotencyKey}". Resolving idempotently.`,
          );
          const existing = await this.prisma.withPlatformAdminContext((tx) =>
            tx.notification.findFirst({
              where: { organizationId, idempotencyKey },
            }),
          );
          return {
            isDuplicate: true,
            notification: existing,
          };
        }
        throw err;
      }
    }

    // 4. Dispatch Email if requested and permitted
    if (channel === NotificationChannel.EMAIL || channel === NotificationChannel.IN_APP) {
      if (emailAllowed) {
        const recipientUser = await this.prisma.user.findUnique({
          where: { id: recipientUserId },
          select: { email: true, firstName: true },
        });

        if (recipientUser?.email) {
          // Use development console provider by default, or SMTP adapter if configured
          const emailProvider = this.smtpEmailProvider.isConfigured
            ? this.smtpEmailProvider
            : this.consoleEmailProvider;

          await emailProvider.sendEmail({
            to: recipientUser.email,
            subject: title,
            bodyText: `Hello ${recipientUser.firstName},\n\n${message}\n\n${actionUrl ? 'Action: ' + actionUrl : ''}`,
            metadata: { organizationId, category },
          });
        }
      }
    }

    return {
      isDuplicate: false,
      notification: createdNotification,
    };
  }

  /**
   * Broadcast an announcement notification to all tenant members.
   */
  async broadcastToTenant(
    organizationId: string,
    dto: BroadcastNotificationDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const memberProfiles = await this.prisma.withTenantContext(
      organizationId,
      async (tx) => {
        return tx.memberProfile.findMany({
          where: { organizationId, deletedAt: null },
          select: { userId: true },
        });
      },
    );

    const userIds = Array.from(new Set(memberProfiles.map((m) => m.userId)));
    let deliveredCount = 0;

    for (const userId of userIds) {
      await this.sendNotification({
        organizationId,
        recipientUserId: userId,
        title: dto.title,
        message: dto.message,
        channel: NotificationChannel.IN_APP,
        category: 'ANNOUNCEMENT',
        actionUrl: dto.actionUrl,
      });
      deliveredCount++;
    }

    await this.auditService.logEvent({
      organizationId,
      actorUserId,
      action: 'NOTIFICATION_BROADCAST',
      entityType: 'Notification',
      entityId: organizationId,
      afterDiff: {
        title: dto.title,
        recipientCount: deliveredCount,
      },
      ipAddress,
      userAgent,
    });

    return {
      success: true,
      deliveredCount,
      message: `Announcement broadcast to ${deliveredCount} members`,
    };
  }

  /**
   * Retrieve notification feed for authenticated user in this organization.
   */
  async getUserNotifications(
    userId: string,
    organizationId: string,
    options?: { status?: NotificationStatus; limit?: number; offset?: number },
  ) {
    const limit = Math.min(options?.limit ?? 50, 100);
    const offset = options?.offset ?? 0;

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const where: any = {
        organizationId,
        recipientUserId: userId,
      };
      if (options?.status) {
        where.status = options.status;
      }

      const [items, unreadCount] = await Promise.all([
        tx.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        tx.notification.count({
          where: {
            organizationId,
            recipientUserId: userId,
            status: NotificationStatus.UNREAD,
          },
        }),
      ]);

      return {
        items,
        unreadCount,
        limit,
        offset,
      };
    });
  }

  async markAsRead(notificationId: string, userId: string, organizationId: string) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.notification.findFirst({
        where: { id: notificationId, organizationId, recipientUserId: userId },
      });

      if (!existing) {
        throw new NotFoundException(`Notification ${notificationId} not found`);
      }

      return tx.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.READ,
          readAt: new Date(),
        },
      });
    });
  }

  async markAllAsRead(userId: string, organizationId: string) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const updated = await tx.notification.updateMany({
        where: {
          organizationId,
          recipientUserId: userId,
          status: NotificationStatus.UNREAD,
        },
        data: {
          status: NotificationStatus.READ,
          readAt: new Date(),
        },
      });

      return {
        success: true,
        updatedCount: updated.count,
      };
    });
  }

  async getUserPreferences(userId: string, organizationId: string) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const pref = await tx.notificationPreference.findUnique({
        where: {
          organizationId_userId: { organizationId, userId },
        },
      });

      return (
        pref || {
          organizationId,
          userId,
          emailEnabled: true,
          smsEnabled: true,
          inAppEnabled: true,
        }
      );
    });
  }

  async updateUserPreferences(
    userId: string,
    organizationId: string,
    dto: UpdateNotificationPreferencesDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const pref = await tx.notificationPreference.upsert({
        where: {
          organizationId_userId: { organizationId, userId },
        },
        create: {
          organizationId,
          userId,
          emailEnabled: dto.emailEnabled ?? true,
          smsEnabled: dto.smsEnabled ?? true,
          inAppEnabled: dto.inAppEnabled ?? true,
        },
        update: {
          ...(dto.emailEnabled !== undefined ? { emailEnabled: dto.emailEnabled } : {}),
          ...(dto.smsEnabled !== undefined ? { smsEnabled: dto.smsEnabled } : {}),
          ...(dto.inAppEnabled !== undefined ? { inAppEnabled: dto.inAppEnabled } : {}),
        },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId: userId,
        action: 'NOTIFICATION_PREFERENCE_CHANGED',
        entityType: 'NotificationPreference',
        entityId: pref.id,
        afterDiff: pref,
        ipAddress,
        userAgent,
      });

      return pref;
    });
  }
}
