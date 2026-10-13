import { Injectable, NotFoundException, BadRequestException, ConflictException, Inject } from '@nestjs/common';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateMemberProfileDto } from './dto/update-member-profile.dto';
import { AdminUpdateMemberProfileDto, AdminCreateUserDto } from './dto/admin-member.dto';
import { CardStatus, MembershipStatus } from '@prisma/client';

@Injectable()
export class MembersService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  /**
   * Retrieves current user's member profile in the active tenant under PostgreSQL RLS.
   */
  async getMyProfile(userId: string, organizationId: string) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const profile = await tx.memberProfile.findFirst({
        where: {
          userId,
          organizationId,
          deletedAt: null,
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              currency: true,
            },
          },
          memberships: {
            where: { organizationId },
            include: {
              membershipPlan: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  price: true,
                  currency: true,
                  billingInterval: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!profile) {
        throw new NotFoundException('Member profile not found in this organization');
      }

      return profile;
    });
  }

  /**
   * Updates allowed personal fields of the current user's member profile in the active tenant.
   * Runs under PostgreSQL RLS and records an immutable audit log.
   */
  async updateMyProfile(
    userId: string,
    organizationId: string,
    dto: UpdateMemberProfileDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.memberProfile.findFirst({
        where: {
          userId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!existing) {
        throw new NotFoundException('Member profile not found in this organization');
      }

      const updated = await tx.memberProfile.update({
        where: { id: existing.id },
        data: {
          firstName: dto.firstName !== undefined ? dto.firstName.trim() : undefined,
          lastName: dto.lastName !== undefined ? dto.lastName.trim() : undefined,
          email: dto.email !== undefined ? dto.email.toLowerCase().trim() : undefined,
          phoneNumber: dto.phoneNumber !== undefined ? dto.phoneNumber.trim() : undefined,
          photoUrl: dto.photoUrl !== undefined ? dto.photoUrl : undefined,
          gender: dto.gender !== undefined ? dto.gender : undefined,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          nationalIdNumber:
            dto.nationalIdNumber !== undefined ? dto.nationalIdNumber.trim() : undefined,
          address: dto.address !== undefined ? dto.address.trim() : undefined,
          city: dto.city !== undefined ? dto.city.trim() : undefined,
          customFieldsData:
            dto.customFieldsData !== undefined ? dto.customFieldsData : undefined,
        },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId: userId,
        action: 'MEMBER_PROFILE_UPDATE',
        entityType: 'MemberProfile',
        entityId: existing.id,
        beforeDiff: {
          firstName: existing.firstName,
          lastName: existing.lastName,
          email: existing.email,
          phoneNumber: existing.phoneNumber,
        },
        afterDiff: {
          firstName: updated.firstName,
          lastName: updated.lastName,
          email: updated.email,
          phoneNumber: updated.phoneNumber,
        },
        ipAddress,
        userAgent,
      });

      return updated;
    });
  }

  /**
   * Admin: List members with search, filters (status), sorting and pagination.
   */
  async getMembersList(organizationId: string, query: any) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const page = Math.max(1, parseInt(query.page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
      const skip = (page - 1) * limit;

      const where: any = {
        organizationId,
        deletedAt: null,
      };

      if (query.status) {
        where.status = query.status;
      }

      if (query.search) {
        const s = query.search.trim();
        where.OR = [
          { firstName: { contains: s, mode: 'insensitive' } },
          { lastName: { contains: s, mode: 'insensitive' } },
          { email: { contains: s, mode: 'insensitive' } },
          { phoneNumber: { contains: s } },
          { memberNumber: { contains: s, mode: 'insensitive' } },
        ];
      }

      const [total, members] = await Promise.all([
        tx.memberProfile.count({ where }),
        tx.memberProfile.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                phoneNumber: true,
                status: true,
                createdAt: true,
              },
            },
            memberships: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                membershipPlan: {
                  select: { name: true, code: true, price: true, currency: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
      ]);

      return {
        data: members,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  }

  /**
   * Admin: View complete member details including history, payments, cards.
   */
  async getMemberDetails(organizationId: string, memberId: string) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const member = await tx.memberProfile.findFirst({
        where: { id: memberId, organizationId, deletedAt: null },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phoneNumber: true,
              status: true,
              createdAt: true,
              emailVerifiedAt: true,
              phoneVerifiedAt: true,
            },
          },
          memberships: {
            include: {
              membershipPlan: true,
              digitalCard: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          digitalCards: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!member) {
        throw new NotFoundException(`Member ${memberId} not found`);
      }

      return member;
    });
  }

  /**
   * Admin: Approve or Reject a pending member registration.
   */
  async approveOrRejectMember(
    organizationId: string,
    memberId: string,
    decision: 'APPROVED' | 'REJECTED',
    reason?: string,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const member = await tx.memberProfile.findFirst({
        where: { id: memberId, organizationId, deletedAt: null },
      });

      if (!member) {
        throw new NotFoundException(`Member ${memberId} not found`);
      }

      const newStatus = decision === 'APPROVED' ? 'ACTIVE' : 'ARCHIVED';

      const updated = await tx.memberProfile.update({
        where: { id: member.id },
        data: {
          status: newStatus as any,
          ...(decision === 'APPROVED'
            ? {
                approvedAt: new Date(),
                approvedByUserId: actorUserId,
              }
            : {
                rejectedAt: new Date(),
                rejectedByUserId: actorUserId,
                rejectionReason: reason || null,
              }),
        },
      });

      // Also ensure the user record status is active if approved
      if (decision === 'APPROVED') {
        await tx.user.update({
          where: { id: member.userId },
          data: { status: 'ACTIVE' },
        });
      }

      // Create notification for member
      await tx.notification.create({
        data: {
          organizationId,
          recipientUserId: member.userId,
          title: decision === 'APPROVED' ? 'Membership Approved' : 'Application Status Update',
          message:
            decision === 'APPROVED'
              ? 'Your membership application has been approved! Welcome to 4Baye.'
              : `Your membership application was not approved. Reason: ${reason || 'Criteria not met'}`,
          actionUrl: '/app/dashboard',
        },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: decision === 'APPROVED' ? 'MEMBER_REGISTRATION_APPROVED' : 'MEMBER_REGISTRATION_REJECTED',
        entityType: 'MemberProfile',
        entityId: member.id,
        beforeDiff: { status: member.status },
        afterDiff: { status: updated.status, reason },
        ipAddress,
        userAgent,
      });

      return updated;
    });
  }

  /**
   * Admin: Suspend a member account.
   */
  async suspendMember(
    organizationId: string,
    memberId: string,
    reason: string,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const member = await tx.memberProfile.findFirst({
        where: { id: memberId, organizationId, deletedAt: null },
      });

      if (!member) {
        throw new NotFoundException(`Member ${memberId} not found`);
      }

      // Check if user is the last owner of the organization
      const staffOwner = await tx.staffMembership.findFirst({
        where: {
          organizationId,
          userId: member.userId,
          role: { code: 'OWNER' },
          isActive: true,
        },
      });
      if (staffOwner) {
        const ownerCount = await tx.staffMembership.count({
          where: { organizationId, role: { code: 'OWNER' }, isActive: true },
        });
        if (ownerCount <= 1) {
          throw new BadRequestException('Cannot suspend the last owner of this organization');
        }
      }

      const updated = await tx.memberProfile.update({
        where: { id: member.id },
        data: {
          status: 'SUSPENDED',
          suspendedAt: new Date(),
          suspendedByUserId: actorUserId,
          suspensionReason: reason,
        },
      });

      // Update User global status to SUSPENDED as well
      await tx.user.update({
        where: { id: member.userId },
        data: { status: 'SUSPENDED' },
      });

      // Invalidate active sessions
      await tx.session.deleteMany({
        where: { userId: member.userId },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'MEMBER_ACCOUNT_SUSPENDED',
        entityType: 'MemberProfile',
        entityId: member.id,
        beforeDiff: { status: member.status },
        afterDiff: { status: 'SUSPENDED', suspensionReason: reason },
        ipAddress,
        userAgent,
      });

      return updated;
    });
  }

  /**
   * Admin: Reinstate a suspended member account.
   */
  async reinstateMember(
    organizationId: string,
    memberId: string,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const member = await tx.memberProfile.findFirst({
        where: { id: memberId, organizationId, deletedAt: null },
      });

      if (!member) {
        throw new NotFoundException(`Member ${memberId} not found`);
      }

      const updated = await tx.memberProfile.update({
        where: { id: member.id },
        data: {
          status: 'ACTIVE',
          suspendedAt: null,
          suspendedByUserId: null,
          suspensionReason: null,
        },
      });

      // Reinstate User global status
      await tx.user.update({
        where: { id: member.userId },
        data: { status: 'ACTIVE' },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'MEMBER_ACCOUNT_REINSTATED',
        entityType: 'MemberProfile',
        entityId: member.id,
        beforeDiff: { status: member.status },
        afterDiff: { status: 'ACTIVE' },
        ipAddress,
        userAgent,
      });

      return updated;
    });
  }

  /**
   * Admin: Update internal admin notes for a member.
   */
  async updateAdminNotes(
    organizationId: string,
    memberId: string,
    adminNotes: string,
    actorUserId?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const member = await tx.memberProfile.findFirst({
        where: { id: memberId, organizationId, deletedAt: null },
      });

      if (!member) {
        throw new NotFoundException(`Member ${memberId} not found`);
      }

      return tx.memberProfile.update({
        where: { id: member.id },
        data: { adminNotes },
      });
    });
  }

  /**
   * Admin: Update member details (profile info, name, phone, email, address, etc.)
   */
  async adminUpdateMember(
    organizationId: string,
    memberId: string,
    dto: AdminUpdateMemberProfileDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const member = await tx.memberProfile.findFirst({
        where: { id: memberId, organizationId, deletedAt: null },
      });

      if (!member) {
        throw new NotFoundException(`Member ${memberId} not found`);
      }

      // Check unique email collision if email provided
      if (dto.email && dto.email.toLowerCase().trim() !== (member.email || '').toLowerCase()) {
        const cleanEmail = dto.email.toLowerCase().trim();
        const existingEmail = await tx.memberProfile.findFirst({
          where: {
            organizationId,
            email: { equals: cleanEmail, mode: 'insensitive' },
            id: { not: member.id },
            deletedAt: null,
          },
        });
        if (existingEmail) {
          throw new ConflictException('Another member in this organization is already registered with this email');
        }
      }

      const updated = await tx.memberProfile.update({
        where: { id: member.id },
        data: {
          firstName: dto.firstName !== undefined ? dto.firstName.trim() : undefined,
          lastName: dto.lastName !== undefined ? dto.lastName.trim() : undefined,
          email: dto.email !== undefined ? dto.email.toLowerCase().trim() : undefined,
          phoneNumber: dto.phoneNumber !== undefined ? dto.phoneNumber.trim() : undefined,
          gender: dto.gender !== undefined ? dto.gender : undefined,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          address: dto.address !== undefined ? dto.address.trim() : undefined,
          city: dto.city !== undefined ? dto.city.trim() : undefined,
        },
      });

      // Synchronize firstName/lastName on user table if user is linked
      if (dto.firstName || dto.lastName) {
        await tx.user.update({
          where: { id: member.userId },
          data: {
            firstName: dto.firstName !== undefined ? dto.firstName.trim() : undefined,
            lastName: dto.lastName !== undefined ? dto.lastName.trim() : undefined,
          },
        });
      }

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'MEMBER_PROFILE_ADMIN_UPDATE',
        entityType: 'MemberProfile',
        entityId: member.id,
        beforeDiff: {
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          phoneNumber: member.phoneNumber,
        },
        afterDiff: {
          firstName: updated.firstName,
          lastName: updated.lastName,
          email: updated.email,
          phoneNumber: updated.phoneNumber,
        },
        ipAddress,
        userAgent,
      });

      return updated;
    });
  }

  /**
   * Admin: Reset member account password securely.
   * Generates a high-entropy temporary password, hashes with Argon2id,
   * invalidates all existing sessions, and returns the temporary password once.
   */
  async resetMemberPassword(
    organizationId: string,
    memberId: string,
    actorUserId?: string,
    requestedPassword?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const member = await tx.memberProfile.findFirst({
        where: { id: memberId, organizationId, deletedAt: null },
      });

      if (!member) {
        throw new NotFoundException(`Member ${memberId} not found`);
      }

      // Generate secure temporary password if not provided
      const tempPassword =
        requestedPassword && requestedPassword.length >= 8
          ? requestedPassword
          : `Temp!${crypto.randomBytes(6).toString('base64url')}#9`;

      const passwordHash = await argon2.hash(tempPassword, {
        type: argon2.argon2id,
      });

      // Update User password
      await tx.user.update({
        where: { id: member.userId },
        data: {
          passwordHash,
        },
      });

      // Invalidate all active sessions for this user across devices
      await tx.session.deleteMany({
        where: { userId: member.userId },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'MEMBER_PASSWORD_ADMIN_RESET',
        entityType: 'User',
        entityId: member.userId,
        afterDiff: { resetByAdmin: true, targetMemberId: member.id },
        ipAddress,
        userAgent,
      });

      return {
        success: true,
        temporaryPassword: tempPassword,
        message: 'Password has been reset successfully. Existing sessions have been terminated.',
      };
    });
  }

  /**
   * Admin: Soft-delete / revoke a member profile.
   * Checks that the user is not the last owner of the organization.
   */
  async deleteMember(
    organizationId: string,
    memberId: string,
    actorUserId?: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const member = await tx.memberProfile.findFirst({
        where: { id: memberId, organizationId, deletedAt: null },
      });

      if (!member) {
        throw new NotFoundException(`Member ${memberId} not found`);
      }

      // Protect against deleting the last owner of the organization
      const staffOwner = await tx.staffMembership.findFirst({
        where: {
          organizationId,
          userId: member.userId,
          role: { code: 'OWNER' },
          isActive: true,
        },
      });
      if (staffOwner) {
        const ownerCount = await tx.staffMembership.count({
          where: { organizationId, role: { code: 'OWNER' }, isActive: true },
        });
        if (ownerCount <= 1) {
          throw new BadRequestException('Cannot delete or revoke the last owner of this organization');
        }
      }

      // Soft delete member profile
      const updated = await tx.memberProfile.update({
        where: { id: member.id },
        data: {
          deletedAt: new Date(),
          status: 'ARCHIVED',
          adminNotes: reason
            ? `${member.adminNotes || ''}\n[Revoked]: ${reason}`.trim()
            : member.adminNotes,
        },
      });

      // Invalidate sessions if member has no other active profiles or staff memberships
      const otherAffiliations = await tx.memberProfile.count({
        where: { userId: member.userId, deletedAt: null },
      });
      const staffAffiliations = await tx.staffMembership.count({
        where: { userId: member.userId, isActive: true },
      });

      if (otherAffiliations === 0 && staffAffiliations === 0) {
        await tx.user.update({
          where: { id: member.userId },
          data: { status: 'DEACTIVATED' },
        });
        await tx.session.deleteMany({
          where: { userId: member.userId },
        });
      }

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'MEMBER_PROFILE_REVOKED',
        entityType: 'MemberProfile',
        entityId: member.id,
        beforeDiff: { status: member.status },
        afterDiff: { deletedAt: updated.deletedAt, reason },
        ipAddress,
        userAgent,
      });

      return {
        success: true,
        message: 'Member has been removed and access revoked successfully',
      };
    });
  }

  /**
   * Admin: Upload or replace a member's digital ID image / card photo.
   * Associates the uploaded photoUrl with the memberProfile.photoUrl and audits the action.
   */
  async updateMemberDigitalIdPhoto(
    organizationId: string,
    memberId: string,
    photoUrl: string,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const member = await tx.memberProfile.findFirst({
        where: { id: memberId, organizationId, deletedAt: null },
      });

      if (!member) {
        throw new NotFoundException(`Member ${memberId} not found`);
      }

      const previousPhotoUrl = member.photoUrl;
      const updated = await tx.memberProfile.update({
        where: { id: member.id },
        data: { photoUrl: photoUrl.trim() },
      });

      // Ensure active DigitalMembershipCard is minted so the member's card immediately reflects the new photo
      const existingCard = await tx.digitalMembershipCard.findFirst({
        where: {
          organizationId,
          memberProfileId: member.id,
          status: CardStatus.ACTIVE,
        },
      });

      if (!existingCard) {
        let membership = await tx.membership.findFirst({
          where: { organizationId, memberProfileId: member.id },
          orderBy: { createdAt: 'desc' },
        });

        if (!membership) {
          const defaultPlan = (await tx.membershipPlan.findFirst({
            where: { organizationId, isActive: true },
          })) || (await tx.membershipPlan.findFirst({
            where: { organizationId },
          }));

          if (defaultPlan) {
            const now = new Date();
            const oneYear = new Date(now);
            oneYear.setFullYear(oneYear.getFullYear() + 1);

            membership = await tx.membership.create({
              data: {
                organizationId,
                memberProfileId: member.id,
                membershipPlanId: defaultPlan.id,
                status: MembershipStatus.ACTIVE,
                startDate: now,
                endDate: oneYear,
              },
            });
          }
        }

        if (membership) {
          const now = new Date();
          const expirationDate =
            membership.endDate && membership.endDate > now
              ? membership.endDate
              : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

          const cleanMemberNumber = member.memberNumber || Math.floor(10000 + Math.random() * 90000).toString();
          const cardNumber = `CARD-${cleanMemberNumber}`;

          const rawToken = crypto.randomBytes(32).toString('hex');
          const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

          await tx.digitalMembershipCard.create({
            data: {
              organizationId,
              membershipId: membership.id,
              memberProfileId: member.id,
              cardNumber,
              cardVersion: 1,
              status: CardStatus.ACTIVE,
              issueDate: now,
              expirationDate,
              verificationToken: {
                create: {
                  organizationId,
                  token: rawToken,
                  tokenHash,
                  expiresAt: expirationDate,
                  isRevoked: false,
                },
              },
            },
          });
        }
      }

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'MEMBER_DIGITAL_ID_PHOTO_UPDATED',
        entityType: 'MemberProfile',
        entityId: member.id,
        beforeDiff: { photoUrl: previousPhotoUrl },
        afterDiff: { photoUrl: updated.photoUrl },
        ipAddress,
        userAgent,
      });

      return {
        success: true,
        message: 'Member digital ID photo uploaded and associated successfully',
        photoUrl: updated.photoUrl,
        member: updated,
      };
    });
  }

  /**
   * Admin: Remove a member's uploaded digital ID image / card photo.
   * Clears the memberProfile.photoUrl and audits the action.
   */
  async removeMemberDigitalIdPhoto(
    organizationId: string,
    memberId: string,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const member = await tx.memberProfile.findFirst({
        where: { id: memberId, organizationId, deletedAt: null },
      });

      if (!member) {
        throw new NotFoundException(`Member ${memberId} not found`);
      }

      const previousPhotoUrl = member.photoUrl;
      const updated = await tx.memberProfile.update({
        where: { id: member.id },
        data: { photoUrl: null },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'MEMBER_DIGITAL_ID_PHOTO_REMOVED',
        entityType: 'MemberProfile',
        entityId: member.id,
        beforeDiff: { photoUrl: previousPhotoUrl },
        afterDiff: { photoUrl: null },
        ipAddress,
        userAgent,
      });

      return {
        success: true,
        message: 'Member digital ID photo removed successfully',
        photoUrl: null,
        member: updated,
      };
    });
  }

  /**
   * Admin: Create a new user and associate with the organization as a member/staff.
   * Generates or uses provided temporary password, computes unique memberNumber,
   * creates User and MemberProfile in an atomic transaction, audits action,
   * and returns sanitized user credentials.
   */
  async createUser(
    organizationId: string,
    dto: AdminCreateUserDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const email = dto.email ? dto.email.toLowerCase().trim() : null;
    const phoneNumber = dto.phoneNumber ? dto.phoneNumber.trim() : null;

    if (!email && !phoneNumber) {
      throw new BadRequestException('At least one identifier (email or phone number) is required');
    }

    // Check duplicate user in User table
    if (email) {
      const existingUser = await this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      });
      if (existingUser) {
        throw new ConflictException('A user account with this email address already exists');
      }
    }

    if (phoneNumber) {
      const existingPhone = await this.prisma.user.findFirst({
        where: { phoneNumber },
      });
      if (existingPhone) {
        throw new ConflictException('A user account with this phone number already exists');
      }
    }

    // Temporary password generation
    const tempPassword =
      dto.initialPassword && dto.initialPassword.length >= 8
        ? dto.initialPassword
        : `4B!${crypto.randomBytes(6).toString('base64url')}#26`;

    const passwordHash = await argon2.hash(tempPassword, {
      type: argon2.argon2id,
    });

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      // 1. Fetch Organization for prefix
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
      });
      if (!org) {
        throw new NotFoundException('Organization not found');
      }

      // 2. Generate unique memberNumber if not provided
      let memberNumber = dto.memberNumber?.trim();
      if (!memberNumber) {
        const count = await tx.memberProfile.count({
          where: { organizationId },
        });
        const prefix = org.slug.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'MEM';
        memberNumber = `${prefix}-${String(count + 1).padStart(5, '0')}`;
      } else {
        const existingNumber = await tx.memberProfile.findFirst({
          where: { organizationId, memberNumber },
        });
        if (existingNumber) {
          throw new ConflictException(`Member number ${memberNumber} is already in use`);
        }
      }

      // 3. Create User record
      const newUser = await tx.user.create({
        data: {
          email,
          phoneNumber,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          passwordHash,
          status: 'ACTIVE',
        },
      });

      // 4. Create MemberProfile record
      const memberStatus = dto.initialStatus === 'PENDING_APPROVAL' ? 'PENDING_APPROVAL' : 'ACTIVE';
      const newProfile = await tx.memberProfile.create({
        data: {
          organizationId,
          userId: newUser.id,
          memberNumber,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          email: newUser.email,
          phoneNumber: newUser.phoneNumber,
          gender: dto.gender || null,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          address: dto.address?.trim() || null,
          city: dto.city?.trim() || null,
          status: memberStatus,
        },
      });

      // 5. Optional membership plan attachment
      if (dto.membershipPlanId) {
        const plan = await tx.membershipPlan.findFirst({
          where: { id: dto.membershipPlanId, organizationId, isActive: true },
        });
        if (plan) {
          const startDate = new Date();
          const endDate = new Date();
          endDate.setFullYear(endDate.getFullYear() + 1);

          await tx.membership.create({
            data: {
              organizationId,
              memberProfileId: newProfile.id,
              membershipPlanId: plan.id,
              status: 'ACTIVE',
              startDate,
              endDate,
            },
          });
        }
      }

      // 6. Optional staff role assignment (if roleCode provided and not MEMBER)
      if (dto.roleCode && dto.roleCode !== 'MEMBER') {
        const role = await tx.role.findFirst({
          where: {
            code: dto.roleCode,
            organizationId,
          },
        });
        if (role) {
          await tx.staffMembership.create({
            data: {
              organizationId,
              userId: newUser.id,
              roleId: role.id,
              isActive: true,
            },
          });
        }
      }

      // 7. Audit creation event
      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'USER_CREATED_BY_ADMIN',
        entityType: 'User',
        entityId: newUser.id,
        afterDiff: {
          email: newUser.email,
          phoneNumber: newUser.phoneNumber,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          memberNumber: newProfile.memberNumber,
          status: newProfile.status,
          roleCode: dto.roleCode || 'MEMBER',
        },
        ipAddress,
        userAgent,
      });

      return {
        success: true,
        message: 'User and member profile created successfully',
        user: {
          id: newUser.id,
          email: newUser.email,
          phoneNumber: newUser.phoneNumber,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          status: newUser.status,
          memberNumber: newProfile.memberNumber,
          memberProfileId: newProfile.id,
        },
        temporaryPassword: tempPassword,
      };
    });
  }
}


