import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ContentStatus, SubscriptionStatus } from '@prisma/client';

export interface TenantUsageMetrics {
  organizationId: string;
  planName: string;
  planCode: string;
  subscriptionStatus: SubscriptionStatus;
  currentPeriodEnd: Date;
  currentMembers: number;
  maxMembers: number;
  memberCapacityPercentage: number;
  currentStaff: number;
  maxStaff: number;
  publishedAnnouncements: number;
  storageLimitMb: number;
  features: Record<string, any>;
}

@Injectable()
export class SubscriptionEntitlementService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Retrieves active plan and subscription for an organization.
   */
  async getSubscriptionForTenant(organizationId: string) {
    const sub = await this.prisma.withPlatformAdminContext((tx) =>
      tx.organizationSubscription.findUnique({
        where: { organizationId },
        include: { saasPlan: true },
      }),
    );

    if (!sub) {
      throw new NotFoundException(`No active SaaS subscription found for tenant ${organizationId}`);
    }

    return sub;
  }

  /**
   * Checks whether the organization's plan entitles them to a specific feature key,
   * respecting any organization-specific feature overrides configured by Platform Admin.
   */
  async hasFeature(organizationId: string, featureKey: string): Promise<boolean> {
    const sub = await this.getSubscriptionForTenant(organizationId);

    // If subscription is not ACTIVE or TRIAL, feature access is denied
    if (sub.status !== SubscriptionStatus.ACTIVE && sub.status !== SubscriptionStatus.TRIAL) {
      return false;
    }

    // 1. Check organization-specific overrides configured by Platform Admin
    const profile = await this.prisma.withPlatformAdminContext((tx) =>
      tx.organizationProfile.findUnique({
        where: { organizationId },
        select: { brandingConfig: true },
      }),
    );

    const brandingConfig = (profile?.brandingConfig as Record<string, any>) || {};
    const featureOverrides = brandingConfig.featureOverrides || {};
    if (typeof featureOverrides[featureKey] === 'boolean') {
      return featureOverrides[featureKey];
    }

    // 2. Inherit from active SaaS plan features
    const features = (sub.saasPlan.features as Record<string, any>) || {};
    return !!features[featureKey];
  }

  /**
   * Asserts feature entitlement and throws ForbiddenException if missing.
   */
  async assertFeature(organizationId: string, featureKey: string): Promise<void> {
    const allowed = await this.hasFeature(organizationId, featureKey);
    if (!allowed) {
      throw new ForbiddenException(
        `Feature "${featureKey}" is not included in the current subscription plan for this organization`,
      );
    }
  }

  /**
   * Checks current member count against plan maxMembers limit.
   */
  async checkMemberLimit(organizationId: string): Promise<{
    current: number;
    max: number;
    allowed: boolean;
  }> {
    const sub = await this.getSubscriptionForTenant(organizationId);

    const currentCount = await this.prisma.withTenantContext(
      organizationId,
      (tx) =>
        tx.memberProfile.count({
          where: { organizationId, deletedAt: null },
        }),
    );

    const max = sub.saasPlan.maxMembers;
    return {
      current: currentCount,
      max,
      allowed: currentCount < max,
    };
  }

  /**
   * Asserts that tenant is within allowed member limits before new member registration.
   */
  async assertWithinMemberLimit(organizationId: string): Promise<void> {
    const check = await this.checkMemberLimit(organizationId);
    if (!check.allowed) {
      throw new ForbiddenException(
        `Tenant has reached its maximum member limit (${check.max} members) under the ${organizationId} plan`,
      );
    }
  }

  /**
   * Checks current staff count against plan maxStaff limit.
   */
  async checkStaffLimit(organizationId: string): Promise<{
    current: number;
    max: number;
    allowed: boolean;
  }> {
    const sub = await this.getSubscriptionForTenant(organizationId);

    const currentCount = await this.prisma.withTenantContext(
      organizationId,
      (tx) =>
        tx.staffMembership.count({
          where: { organizationId, isActive: true },
        }),
    );

    const max = sub.saasPlan.maxStaff;
    return {
      current: currentCount,
      max,
      allowed: currentCount < max,
    };
  }

  /**
   * Computes server-authoritative usage metrics for the tenant.
   */
  async getUsageMetrics(organizationId: string): Promise<TenantUsageMetrics> {
    const sub = await this.getSubscriptionForTenant(organizationId);

    const [currentMembers, currentStaff, publishedAnnouncements] =
      await Promise.all([
        this.prisma.withTenantContext(organizationId, (tx) =>
          tx.memberProfile.count({
            where: { organizationId, deletedAt: null },
          }),
        ),
        this.prisma.withTenantContext(organizationId, (tx) =>
          tx.staffMembership.count({
            where: { organizationId, isActive: true },
          }),
        ),
        this.prisma.withTenantContext(organizationId, (tx) =>
          tx.announcement.count({
            where: { organizationId, status: ContentStatus.PUBLISHED, deletedAt: null },
          }),
        ),
      ]);

    const maxMembers = sub.saasPlan.maxMembers;
    const capacityPct =
      maxMembers > 0 ? Math.min(100, Math.round((currentMembers / maxMembers) * 100)) : 100;

    return {
      organizationId,
      planName: sub.saasPlan.name,
      planCode: sub.saasPlan.code,
      subscriptionStatus: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      currentMembers,
      maxMembers,
      memberCapacityPercentage: capacityPct,
      currentStaff,
      maxStaff: sub.saasPlan.maxStaff,
      publishedAnnouncements,
      storageLimitMb: sub.saasPlan.storageLimitMb,
      features: (sub.saasPlan.features as Record<string, any>) || {},
    };
  }
}
