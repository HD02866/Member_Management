import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  OrganizationStatus,
  SubscriptionStatus,
  UserStatus,
  MemberStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';
import {
  CreatePlatformUserDto,
  UpdateOrganizationConfigDto,
  UpdateOrganizationBrandingDto,
  UpdateOrganizationFeaturesDto,
  AssignPlatformStaffDto,
  UpdatePlatformSettingsDto,
} from './dto/platform.dto';

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);

  // In-memory persistent platform settings fallback
  private platformSettings = {
    platformName: 'WaanOfii',
    supportEmail: 'support@waanofii.com',
    defaultLocale: 'en',
    defaultTimezone: 'Africa/Addis_Ababa',
    maintenanceMode: false,
    sessionTimeoutMinutes: '120',
  };

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  // =========================================================================
  // 1. PLATFORM AGGREGATED STATS
  // =========================================================================

  async getPlatformStats() {
    const [
      totalOrgs,
      activeOrgs,
      onboardingOrgs,
      suspendedOrgs,
      deactivatedOrgs,
      totalUsers,
      totalMembers,
      totalStaff,
      activeSubscriptions,
      totalPlans,
      paymentsSummary,
      totalCards,
      recentAuditLogs,
    ] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.organization.count({ where: { status: OrganizationStatus.ACTIVE, deletedAt: null } }),
      this.prisma.organization.count({ where: { status: OrganizationStatus.ONBOARDING, deletedAt: null } }),
      this.prisma.organization.count({ where: { status: OrganizationStatus.SUSPENDED, deletedAt: null } }),
      this.prisma.organization.count({
        where: {
          OR: [{ status: OrganizationStatus.DEACTIVATED }, { deletedAt: { not: null } }],
        },
      }),
      this.prisma.user.count(),
      this.prisma.memberProfile.count({ where: { deletedAt: null } }),
      this.prisma.staffMembership.count({ where: { isActive: true } }),
      this.prisma.organizationSubscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      this.prisma.saasPlan.count({ where: { isActive: true } }),
      this.prisma.payment.aggregate({
        _count: true,
        _sum: { amount: true },
      }),
      this.prisma.digitalMembershipCard.count(),
      this.prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          actor: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
    ]);

    return {
      organizations: {
        total: totalOrgs,
        active: activeOrgs,
        onboarding: onboardingOrgs,
        suspended: suspendedOrgs,
        deactivated: deactivatedOrgs,
      },
      users: {
        total: totalUsers,
        totalMembers,
        totalStaff,
      },
      saas: {
        activeSubscriptions,
        totalPlans,
      },
      operations: {
        totalPayments: paymentsSummary._count || 0,
        totalPaymentVolume: paymentsSummary._sum?.amount || 0,
        totalDigitalCards: totalCards,
      },
      recentActivity: recentAuditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        actor: log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : 'System',
        organizationName: log.organization?.name || 'Global',
        organizationSlug: log.organization?.slug || null,
        createdAt: log.createdAt,
      })),
      health: 'healthy',
    };
  }

  // =========================================================================
  // 2. PLATFORM USER MANAGEMENT
  // =========================================================================

  async getUsers(search?: string, status?: string, page: number = 1, limit: number = 20) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { phoneNumber: { contains: q } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          phoneNumber: true,
          firstName: true,
          lastName: true,
          isPlatformAdmin: true,
          status: true,
          createdAt: true,
          memberProfiles: {
            where: { deletedAt: null },
            select: {
              id: true,
              memberNumber: true,
              status: true,
              organization: { select: { id: true, name: true, slug: true } },
            },
          },
          staffMemberships: {
            where: { isActive: true },
            select: {
              id: true,
              organization: { select: { id: true, name: true, slug: true } },
              role: { select: { id: true, name: true, code: true } },
            },
          },
        },
      }),
    ]);

    const formattedUsers = users.map((u) => {
      const affiliations: Array<{
        organizationId: string;
        organizationName: string;
        organizationSlug: string;
        roleType: 'MEMBER' | 'STAFF' | 'BOTH';
        staffRole?: string;
        memberNumber?: string;
      }> = [];

      const orgMap = new Map<string, any>();
      for (const mp of u.memberProfiles) {
        orgMap.set(mp.organization.id, {
          organizationId: mp.organization.id,
          organizationName: mp.organization.name,
          organizationSlug: mp.organization.slug,
          roleType: 'MEMBER',
          memberNumber: mp.memberNumber,
        });
      }

      for (const sm of u.staffMemberships) {
        if (orgMap.has(sm.organization.id)) {
          const item = orgMap.get(sm.organization.id);
          item.roleType = 'BOTH';
          item.staffRole = sm.role.name;
        } else {
          orgMap.set(sm.organization.id, {
            organizationId: sm.organization.id,
            organizationName: sm.organization.name,
            organizationSlug: sm.organization.slug,
            roleType: 'STAFF',
            staffRole: sm.role.name,
          });
        }
      }

      return {
        ...u,
        affiliations: Array.from(orgMap.values()),
      };
    });

    return {
      users: formattedUsers,
      pagination: {
        total,
        page,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async createPlatformUser(
    dto: CreatePlatformUserDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (!dto.email && !dto.phoneNumber) {
      throw new BadRequestException('User must have an email or phone number');
    }

    if (dto.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: dto.email.toLowerCase().trim() },
      });
      if (existingEmail) {
        throw new ConflictException('A user with this email address already exists');
      }
    }

    if (dto.phoneNumber) {
      const existingPhone = await this.prisma.user.findFirst({
        where: { phoneNumber: dto.phoneNumber.trim() },
      });
      if (existingPhone) {
        throw new ConflictException('A user with this phone number already exists');
      }
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email: dto.email ? dto.email.toLowerCase().trim() : null,
        phoneNumber: dto.phoneNumber ? dto.phoneNumber.trim() : null,
        passwordHash,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        firstName: true,
        lastName: true,
        isPlatformAdmin: true,
        status: true,
        createdAt: true,
      },
    });

    // Record audit event using global system org or first org
    const defaultOrg = await this.prisma.organization.findFirst({ select: { id: true } });
    if (defaultOrg) {
      await this.auditService.logEvent({
        organizationId: defaultOrg.id,
        actorUserId,
        action: 'PLATFORM_USER_CREATED',
        entityType: 'User',
        entityId: user.id,
        afterDiff: { email: user.email, name: `${user.firstName} ${user.lastName}` },
        ipAddress,
        userAgent,
      });
    }

    return user;
  }

  // =========================================================================
  // 3. ORGANIZATION MANAGEMENT
  // =========================================================================

  async getOrganizations(
    search?: string,
    status?: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const where: any = {};
    if (status && status !== 'ALL') {
      if (status === 'DEACTIVATED') {
        where.OR = [{ status: OrganizationStatus.DEACTIVATED }, { deletedAt: { not: null } }];
      } else {
        where.status = status;
        where.deletedAt = null;
      }
    } else {
      where.deletedAt = null;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { contactEmail: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, orgs] = await Promise.all([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        skip,
        take,
        include: {
          subscription: {
            include: { saasPlan: true },
          },
          _count: {
            select: {
              memberProfiles: true,
              staffMemberships: true,
              announcements: true,
              payments: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      organizations: orgs,
      pagination: {
        total,
        page,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getOrganizationDetail(identifier: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      identifier,
    );

    const org = await this.prisma.organization.findFirst({
      where: isUuid ? { id: identifier } : { slug: identifier.toLowerCase().trim() },
      include: {
        profile: true,
        domains: true,
        subscription: {
          include: { saasPlan: true },
        },
        staffMemberships: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phoneNumber: true,
                status: true,
              },
            },
            role: true,
          },
        },
        _count: {
          select: {
            memberProfiles: true,
            staffMemberships: true,
            memberships: true,
            payments: true,
            announcements: true,
            programs: true,
            benefits: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException(`Organization '${identifier}' not found`);
    }

    // Fetch recent audit logs for this organization
    const recentAuditLogs = await this.prisma.auditLog.findMany({
      where: { organizationId: org.id },
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    return {
      ...org,
      recentAuditLogs,
    };
  }

  async updateOrganizationConfig(
    identifier: string,
    dto: UpdateOrganizationConfigDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const org = await this.resolveOrg(identifier);

    const beforeDiff = {
      name: org.name,
      contactEmail: org.contactEmail,
      contactPhone: org.contactPhone,
      address: org.address,
      timezone: org.timezone,
      currency: org.currency,
      defaultLanguage: org.defaultLanguage,
    };

    const updated = await this.prisma.organization.update({
      where: { id: org.id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.contactEmail ? { contactEmail: dto.contactEmail.toLowerCase().trim() } : {}),
        ...(dto.contactPhone !== undefined ? { contactPhone: dto.contactPhone?.trim() || null } : {}),
        ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
        ...(dto.timezone ? { timezone: dto.timezone } : {}),
        ...(dto.currency ? { currency: dto.currency.toUpperCase() } : {}),
        ...(dto.defaultLanguage ? { defaultLanguage: dto.defaultLanguage } : {}),
      },
    });

    await this.auditService.logEvent({
      organizationId: org.id,
      actorUserId,
      action: 'ORGANIZATION_CONFIG_UPDATED',
      entityType: 'Organization',
      entityId: org.id,
      beforeDiff,
      afterDiff: dto,
      ipAddress,
      userAgent,
    });

    return updated;
  }

  async updateOrganizationBranding(
    identifier: string,
    dto: UpdateOrganizationBrandingDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const org = await this.resolveOrg(identifier);

    // Update Organization top-level fields (logoUrl, coverImageUrl)
    await this.prisma.organization.update({
      where: { id: org.id },
      data: {
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
        ...(dto.coverImageUrl !== undefined ? { coverImageUrl: dto.coverImageUrl } : {}),
      },
    });

    // Ensure OrganizationProfile exists and update brandingConfig
    const existingProfile = await this.prisma.organizationProfile.findUnique({
      where: { organizationId: org.id },
    });

    const currentBranding = (existingProfile?.brandingConfig as Record<string, any>) || {};
    const updatedBranding = {
      ...currentBranding,
      ...(dto.primaryColor !== undefined ? { primaryColor: dto.primaryColor } : {}),
      ...(dto.secondaryColor !== undefined ? { secondaryColor: dto.secondaryColor } : {}),
      ...(dto.navbarBrandingMode !== undefined ? { navbarBrandingMode: dto.navbarBrandingMode } : {}),
      ...(dto.cardTemplate !== undefined ? { cardTemplate: { ...currentBranding.cardTemplate, ...dto.cardTemplate } } : {}),
    };

    if (existingProfile) {
      await this.prisma.organizationProfile.update({
        where: { organizationId: org.id },
        data: { brandingConfig: updatedBranding },
      });
    } else {
      await this.prisma.organizationProfile.create({
        data: {
          organizationId: org.id,
          brandingConfig: updatedBranding,
        },
      });
    }

    await this.auditService.logEvent({
      organizationId: org.id,
      actorUserId,
      action: 'ORGANIZATION_BRANDING_UPDATED',
      entityType: 'OrganizationProfile',
      entityId: org.id,
      beforeDiff: currentBranding,
      afterDiff: updatedBranding,
      ipAddress,
      userAgent,
    });

    return {
      organizationId: org.id,
      logoUrl: dto.logoUrl !== undefined ? dto.logoUrl : org.logoUrl,
      brandingConfig: updatedBranding,
    };
  }

  async updateOrganizationFeatures(
    identifier: string,
    dto: UpdateOrganizationFeaturesDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const org = await this.resolveOrg(identifier);

    const existingProfile = await this.prisma.organizationProfile.findUnique({
      where: { organizationId: org.id },
    });

    const currentBranding = (existingProfile?.brandingConfig as Record<string, any>) || {};
    const updatedBranding = {
      ...currentBranding,
      featureOverrides: {
        ...(currentBranding.featureOverrides || {}),
        ...dto.featureOverrides,
      },
    };

    if (existingProfile) {
      await this.prisma.organizationProfile.update({
        where: { organizationId: org.id },
        data: { brandingConfig: updatedBranding },
      });
    } else {
      await this.prisma.organizationProfile.create({
        data: {
          organizationId: org.id,
          brandingConfig: updatedBranding,
        },
      });
    }

    await this.auditService.logEvent({
      organizationId: org.id,
      actorUserId,
      action: 'ORGANIZATION_FEATURES_OVERRIDDEN',
      entityType: 'OrganizationProfile',
      entityId: org.id,
      beforeDiff: currentBranding.featureOverrides || {},
      afterDiff: updatedBranding.featureOverrides,
      ipAddress,
      userAgent,
    });

    return {
      organizationId: org.id,
      featureOverrides: updatedBranding.featureOverrides,
    };
  }

  async updateOrganizationStatus(
    identifier: string,
    status: OrganizationStatus,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const org = await this.resolveOrg(identifier);

    if (org.status === status) {
      return org;
    }

    const updated = await this.prisma.organization.update({
      where: { id: org.id },
      data: { status },
    });

    await this.auditService.logEvent({
      organizationId: org.id,
      actorUserId,
      action: `ORGANIZATION_STATUS_${status}`,
      entityType: 'Organization',
      entityId: org.id,
      beforeDiff: { status: org.status },
      afterDiff: { status },
      ipAddress,
      userAgent,
    });

    return updated;
  }

  async safeDeactivateOrganization(
    identifier: string,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const org = await this.resolveOrg(identifier);

    // Non-destructive soft-delete / deactivation
    const updated = await this.prisma.organization.update({
      where: { id: org.id },
      data: {
        status: OrganizationStatus.DEACTIVATED,
        deletedAt: new Date(),
      },
    });

    // Cancel active subscription
    await this.prisma.organizationSubscription.updateMany({
      where: { organizationId: org.id, status: SubscriptionStatus.ACTIVE },
      data: { status: SubscriptionStatus.CANCELLED },
    });

    await this.auditService.logEvent({
      organizationId: org.id,
      actorUserId,
      action: 'ORGANIZATION_DEACTIVATED_AND_ARCHIVED',
      entityType: 'Organization',
      entityId: org.id,
      beforeDiff: { status: org.status, deletedAt: org.deletedAt },
      afterDiff: { status: OrganizationStatus.DEACTIVATED, deletedAt: updated.deletedAt },
      ipAddress,
      userAgent,
    });

    return updated;
  }

  // =========================================================================
  // 4. ORGANIZATION STAFF MANAGEMENT (PLATFORM ADMIN)
  // =========================================================================

  async assignStaff(
    identifier: string,
    dto: AssignPlatformStaffDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const org = await this.resolveOrg(identifier);

    // 1. Resolve user
    const user = await this.resolveUser(dto.identifier);

    // 2. Resolve role
    const role = await this.prisma.role.findFirst({
      where: {
        code: dto.roleCode.toUpperCase().trim(),
        OR: [{ organizationId: org.id }, { organizationId: null }],
      },
    });

    if (!role) {
      throw new NotFoundException(`Role '${dto.roleCode}' not found`);
    }

    // 3. Upsert staff membership
    const existing = await this.prisma.staffMembership.findFirst({
      where: {
        organizationId: org.id,
        userId: user.id,
      },
    });

    let membership;
    if (existing) {
      membership = await this.prisma.staffMembership.update({
        where: { id: existing.id },
        data: {
          roleId: role.id,
          isActive: true,
        },
        include: { role: true, user: true },
      });
    } else {
      membership = await this.prisma.staffMembership.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          roleId: role.id,
          isActive: true,
        },
        include: { role: true, user: true },
      });
    }

    await this.auditService.logEvent({
      organizationId: org.id,
      actorUserId,
      action: 'PLATFORM_STAFF_ASSIGNED',
      entityType: 'StaffMembership',
      entityId: membership.id,
      afterDiff: {
        userId: user.id,
        roleCode: role.code,
        userEmail: user.email,
      },
      ipAddress,
      userAgent,
    });

    return membership;
  }

  async revokeStaff(
    identifier: string,
    staffId: string,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const org = await this.resolveOrg(identifier);

    const staff = await this.prisma.staffMembership.findFirst({
      where: { id: staffId, organizationId: org.id },
      include: { role: true, user: true },
    });

    if (!staff) {
      throw new NotFoundException('Staff membership record not found');
    }

    // Protect last active owner
    if (staff.role.code === 'OWNER') {
      const activeOwners = await this.prisma.staffMembership.count({
        where: {
          organizationId: org.id,
          role: { code: 'OWNER' },
          isActive: true,
          id: { not: staff.id },
        },
      });

      if (activeOwners === 0) {
        throw new BadRequestException(
          'Cannot remove the last active Organization Owner. Assign another Owner first.',
        );
      }
    }

    await this.prisma.staffMembership.delete({
      where: { id: staff.id },
    });

    await this.auditService.logEvent({
      organizationId: org.id,
      actorUserId,
      action: 'PLATFORM_STAFF_REVOKED',
      entityType: 'StaffMembership',
      entityId: staff.id,
      beforeDiff: {
        userId: staff.userId,
        roleCode: staff.role.code,
        userEmail: staff.user?.email,
      },
      ipAddress,
      userAgent,
    });

    return { success: true, message: 'Staff membership revoked successfully' };
  }

  // =========================================================================
  // 5. AUDIT LOGS QUERY
  // =========================================================================

  async getAuditLogs(
    organizationId?: string,
    action?: string,
    entityType?: string,
    actorUserId?: string,
    page: number = 1,
    limit: number = 25,
  ) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const where: any = {};
    if (organizationId && organizationId !== 'ALL') {
      where.organizationId = organizationId;
    }
    if (action && action !== 'ALL') {
      where.action = action;
    }
    if (entityType && entityType !== 'ALL') {
      where.entityType = entityType;
    }
    if (actorUserId) {
      where.actorUserId = actorUserId;
    }

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          actor: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
    ]);

    return {
      logs,
      pagination: {
        total,
        page,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  // =========================================================================
  // 6. PAYMENTS & VERIFICATION OVERSIGHT
  // =========================================================================

  async getPaymentsOversight(
    organizationId?: string,
    status?: string,
    page: number = 1,
    limit: number = 25,
  ) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const where: any = {};
    if (organizationId && organizationId !== 'ALL') {
      where.organizationId = organizationId;
    }
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const [total, payments] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          memberProfile: { select: { id: true, firstName: true, lastName: true, memberNumber: true } },
          paymentMethod: { select: { id: true, name: true, type: true } },
          reviews: { take: 1, orderBy: { reviewedAt: 'desc' } },
        },
      }),
    ]);

    return {
      payments,
      pagination: {
        total,
        page,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getVerificationOversight(
    organizationId?: string,
    result?: string,
    page: number = 1,
    limit: number = 25,
  ) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const where: any = {};
    if (organizationId && organizationId !== 'ALL') {
      where.organizationId = organizationId;
    }
    if (result && result !== 'ALL') {
      where.verificationResult = result;
    }

    const [total, logs] = await Promise.all([
      this.prisma.verificationLog.count({ where }),
      this.prisma.verificationLog.findMany({
        where,
        skip,
        take,
        orderBy: { scannedAt: 'desc' },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          card: {
            select: {
              id: true,
              cardNumber: true,
              status: true,
              memberProfile: { select: { firstName: true, lastName: true, memberNumber: true } },
            },
          },
        },
      }),
    ]);

    return {
      logs,
      pagination: {
        total,
        page,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  // =========================================================================
  // 7. PLATFORM SETTINGS
  // =========================================================================

  getPlatformSettings() {
    return this.platformSettings;
  }

  async updatePlatformSettings(
    dto: UpdatePlatformSettingsDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const beforeDiff = { ...this.platformSettings };
    this.platformSettings = {
      ...this.platformSettings,
      ...dto,
    };

    const defaultOrg = await this.prisma.organization.findFirst({ select: { id: true } });
    if (defaultOrg) {
      await this.auditService.logEvent({
        organizationId: defaultOrg.id,
        actorUserId,
        action: 'PLATFORM_SETTINGS_UPDATED',
        entityType: 'PlatformSettings',
        entityId: 'global',
        beforeDiff,
        afterDiff: this.platformSettings,
        ipAddress,
        userAgent,
      });
    }

    return this.platformSettings;
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private async resolveOrg(identifier: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      identifier,
    );
    const org = await this.prisma.organization.findFirst({
      where: isUuid ? { id: identifier } : { slug: identifier.toLowerCase().trim() },
    });

    if (!org) {
      throw new NotFoundException(`Organization '${identifier}' not found`);
    }

    return org;
  }

  private async resolveUser(identifier: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      identifier,
    );

    const user = await this.prisma.user.findFirst({
      where: isUuid
        ? { id: identifier }
        : {
            OR: [
              { email: identifier.toLowerCase().trim() },
              { phoneNumber: identifier.trim() },
            ],
          },
    });

    if (!user) {
      throw new NotFoundException(`User '${identifier}' not found`);
    }

    return user;
  }
}
