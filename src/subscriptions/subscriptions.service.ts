import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import {
  CreateSaasPlanDto,
  UpdateSaasPlanDto,
} from './dto/plan.dto';
import {
  AssignSubscriptionDto,
  UpdateSubscriptionStatusDto,
} from './dto/subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  // ==========================================
  // 1. PLANS
  // ==========================================

  async listPlans(includeInactive: boolean = false) {
    return this.prisma.saasPlan.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { price: 'asc' },
    });
  }

  async createPlan(
    dto: CreateSaasPlanDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existing = await this.prisma.saasPlan.findFirst({
      where: {
        OR: [{ code: dto.code.trim().toUpperCase() }, { name: dto.name.trim() }],
      },
    });

    if (existing) {
      throw new ConflictException(
        `Plan with code "${dto.code}" or name "${dto.name}" already exists`,
      );
    }

    const priceDecimal = new Prisma.Decimal(dto.price);
    if (priceDecimal.lt(0)) {
      throw new BadRequestException('Plan price cannot be negative');
    }

    const plan = await this.prisma.saasPlan.create({
      data: {
        name: dto.name.trim(),
        code: dto.code.trim().toUpperCase(),
        description: dto.description?.trim(),
        price: priceDecimal,
        currency: dto.currency || 'USD',
        maxMembers: dto.maxMembers ?? 100,
        maxStaff: dto.maxStaff ?? 2,
        storageLimitMb: dto.storageLimitMb ?? 1024,
        features: dto.features ?? {},
        isActive: dto.isActive ?? true,
      },
    });

    return plan;
  }

  async updatePlan(
    planId: string,
    dto: UpdateSaasPlanDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existing = await this.prisma.saasPlan.findUnique({
      where: { id: planId },
    });

    if (!existing) {
      throw new NotFoundException(`Plan ${planId} not found`);
    }

    const updated = await this.prisma.saasPlan.update({
      where: { id: planId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() } : {}),
        ...(dto.price !== undefined ? { price: new Prisma.Decimal(dto.price) } : {}),
        ...(dto.currency ? { currency: dto.currency } : {}),
        ...(dto.maxMembers !== undefined ? { maxMembers: dto.maxMembers } : {}),
        ...(dto.maxStaff !== undefined ? { maxStaff: dto.maxStaff } : {}),
        ...(dto.storageLimitMb !== undefined ? { storageLimitMb: dto.storageLimitMb } : {}),
        ...(dto.features !== undefined ? { features: dto.features } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    return updated;
  }

  // ==========================================
  // 2. SUBSCRIPTIONS
  // ==========================================

  async getTenantSubscription(organizationId: string) {
    const sub = await this.prisma.withPlatformAdminContext((tx) =>
      tx.organizationSubscription.findUnique({
        where: { organizationId },
        include: { saasPlan: true },
      }),
    );

    if (!sub) {
      throw new NotFoundException(`No subscription found for organization ${organizationId}`);
    }

    return sub;
  }

  async listAllSubscriptions() {
    return this.prisma.withPlatformAdminContext((tx) =>
      tx.organizationSubscription.findMany({
        include: {
          organization: { select: { id: true, name: true, slug: true, status: true } },
          saasPlan: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async assignSubscription(
    dto: AssignSubscriptionDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
    });
    if (!org) {
      throw new NotFoundException(`Organization ${dto.organizationId} not found`);
    }

    const plan = await this.prisma.saasPlan.findUnique({
      where: { id: dto.saasPlanId },
    });
    if (!plan) {
      throw new NotFoundException(`SaaS Plan ${dto.saasPlanId} not found`);
    }

    const durationMonths = dto.durationMonths ?? 12;
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + durationMonths);

    const sub = await this.prisma.withPlatformAdminContext((tx) =>
      tx.organizationSubscription.upsert({
        where: { organizationId: dto.organizationId },
        create: {
          organizationId: dto.organizationId,
          saasPlanId: dto.saasPlanId,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
        update: {
          saasPlanId: dto.saasPlanId,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
        include: { saasPlan: true },
      }),
    );

    await this.auditService.logEvent({
      organizationId: dto.organizationId,
      actorUserId,
      action: 'SUBSCRIPTION_ASSIGNED',
      entityType: 'OrganizationSubscription',
      entityId: sub.id,
      afterDiff: {
        planCode: plan.code,
        periodEnd,
        status: sub.status,
      },
      ipAddress,
      userAgent,
    });

    return sub;
  }

  async updateSubscriptionStatus(
    subscriptionId: string,
    dto: UpdateSubscriptionStatusDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existing = await this.prisma.withPlatformAdminContext((tx) =>
      tx.organizationSubscription.findUnique({
        where: { id: subscriptionId },
      }),
    );

    if (!existing) {
      throw new NotFoundException(`Subscription ${subscriptionId} not found`);
    }

    if (existing.status === dto.status) {
      return {
        success: true,
        message: `Subscription already in status ${dto.status}`,
        subscription: existing,
      };
    }

    const updated = await this.prisma.withPlatformAdminContext((tx) =>
      tx.organizationSubscription.update({
        where: { id: subscriptionId },
        data: { status: dto.status },
        include: { saasPlan: true },
      }),
    );

    await this.auditService.logEvent({
      organizationId: existing.organizationId,
      actorUserId,
      action: 'SUBSCRIPTION_STATUS_UPDATED',
      entityType: 'OrganizationSubscription',
      entityId: subscriptionId,
      beforeDiff: { status: existing.status },
      afterDiff: { status: dto.status, reason: dto.reason },
      ipAddress,
      userAgent,
    });

    return updated;
  }
}
