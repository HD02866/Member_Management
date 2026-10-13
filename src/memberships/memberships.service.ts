import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ApplyMembershipDto } from './dto/apply-membership.dto';
import { MembershipStatus, MemberStatus } from '@prisma/client';

@Injectable()
export class MembershipsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  /**
   * Retrieves active membership plans for the resolved tenant under PostgreSQL RLS.
   */
  async getPlans(organizationId: string) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      return tx.membershipPlan.findMany({
        where: {
          organizationId,
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
          organizationId: true,
          name: true,
          code: true,
          description: true,
          price: true,
          currency: true,
          registrationFee: true,
          billingInterval: true,
          durationCount: true,
          benefitsSummary: true,
          isActive: true,
        },
        orderBy: { price: 'asc' },
      });
    });
  }

  /**
   * Retrieves current user's memberships in the active tenant under PostgreSQL RLS.
   */
  async getMyMemberships(userId: string, organizationId: string) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const profile = await tx.memberProfile.findFirst({
        where: {
          userId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!profile) {
        return [];
      }

      return tx.membership.findMany({
        where: {
          organizationId,
          memberProfileId: profile.id,
        },
        include: {
          membershipPlan: true,
          digitalCard: {
            select: {
              id: true,
              cardNumber: true,
              status: true,
              expirationDate: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  /**
   * Submits a membership application for a chosen plan in the active tenant.
   * Creates a MemberProfile in PENDING_APPROVAL status if not already present.
   * Creates a Membership record in REGISTERED status with nextStep: COMPLETE_PAYMENT.
   * Protected under PostgreSQL RLS and audited.
   */
  async applyForMembership(
    userId: string,
    organizationId: string,
    dto: ApplyMembershipDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      // 1. Verify plan belongs to this tenant and is active
      const plan = await tx.membershipPlan.findFirst({
        where: {
          id: dto.planId,
          organizationId,
          isActive: true,
          deletedAt: null,
        },
      });

      if (!plan) {
        throw new NotFoundException('Membership plan not found or inactive');
      }

      // 2. Resolve or create member profile for this tenant
      let profile = await tx.memberProfile.findFirst({
        where: {
          userId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!profile) {
        const user = await tx.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          throw new NotFoundException('User account not found');
        }

        // Generate tenant-unique member number
        const randomSuffix = Math.floor(100000 + Math.random() * 900000);
        const memberNumber = `MEM-${randomSuffix}`;

        profile = await tx.memberProfile.create({
          data: {
            organizationId,
            userId,
            memberNumber,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            status: MemberStatus.PENDING_APPROVAL,
          },
        });
      }

      // 3. Verify user does not already have an active/pending membership for this plan
      const existingMembership = await tx.membership.findFirst({
        where: {
          organizationId,
          memberProfileId: profile.id,
          membershipPlanId: plan.id,
          status: {
            in: [
              MembershipStatus.REGISTERED,
              MembershipStatus.PAYMENT_PENDING,
              MembershipStatus.PAYMENT_SUBMITTED,
              MembershipStatus.UNDER_REVIEW,
              MembershipStatus.APPROVED,
              MembershipStatus.ACTIVE,
            ],
          },
        },
      });

      if (existingMembership) {
        throw new ConflictException(
          'An active or pending application already exists for this plan',
        );
      }

      // 4. Create Membership in REGISTERED status
      const membership = await tx.membership.create({
        data: {
          organizationId,
          memberProfileId: profile.id,
          membershipPlanId: plan.id,
          status: MembershipStatus.REGISTERED,
        },
        include: {
          membershipPlan: true,
          memberProfile: true,
        },
      });

      // 5. Immutable Audit Log
      await this.auditService.logEvent({
        organizationId,
        actorUserId: userId,
        action: 'MEMBERSHIP_APPLICATION_SUBMITTED',
        entityType: 'Membership',
        entityId: membership.id,
        afterDiff: {
          membershipId: membership.id,
          planId: plan.id,
          planName: plan.name,
          status: membership.status,
          memberProfileId: profile.id,
        },
        ipAddress,
        userAgent,
      });

      // 6. Return response with clear payment boundary
      const planFee = Number(plan.price);
      const registrationFee = Number(plan.registrationFee);
      const totalDue = planFee + registrationFee;

      return {
        membership,
        nextStep: 'COMPLETE_PAYMENT',
        paymentRequired: {
          planFee,
          registrationFee,
          totalDue,
          currency: plan.currency,
        },
        message:
          'Membership application registered successfully. Next step: complete payment.',
      };
    });
  }
}
