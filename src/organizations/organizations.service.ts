import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OrganizationStatus } from '@prisma/client';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UpdateOrganizationStatusDto } from './dto/update-organization-status.dto';
import { AssignStaffDto, UpdateStaffDto, ALLOWED_STAFF_ROLES } from './dto/assign-staff.dto';
import { RESERVED_ORGANIZATION_SLUGS } from './constants/reserved-slugs.constant';

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  /**
   * Retrieves public directory of active organizations on the platform.
   */
  async getPublicDirectory() {
    return this.prisma.organization.findMany({
      where: {
        status: OrganizationStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        logoUrl: true,
        contactEmail: true,
        defaultLanguage: true,
        currency: true,
        profile: {
          select: {
            mission: true,
            vision: true,
            values: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Retrieves public organization profile and all published CMS/membership plan details.
   */
  async getByIdentifier(identifier: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      identifier,
    );

    const where = isUuid
      ? { id: identifier, status: OrganizationStatus.ACTIVE, deletedAt: null }
      : { slug: identifier.toLowerCase().trim(), status: OrganizationStatus.ACTIVE, deletedAt: null };

    const org = await this.prisma.organization.findFirst({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        logoUrl: true,
        contactEmail: true,
        contactPhone: true,
        address: true,
        defaultLanguage: true,
        timezone: true,
        currency: true,
        createdAt: true,
        profile: {
          select: {
            mission: true,
            vision: true,
            history: true,
            values: true,
            brandingConfig: true,
            socialLinks: true,
          },
        },
        domains: {
          select: {
            domain: true,
            isPrimary: true,
            isVerified: true,
          },
        },
        programs: {
          where: { deletedAt: null, status: 'PUBLISHED' },
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            coverImageUrl: true,
            startDate: true,
            endDate: true,
            isMembersOnly: true,
          },
          orderBy: { startDate: 'desc' },
        },
        benefits: {
          where: { deletedAt: null, isActive: true },
          select: {
            id: true,
            title: true,
            description: true,
            icon: true,
            displayOrder: true,
          },
          orderBy: { displayOrder: 'asc' },
        },
        leaders: {
          where: { deletedAt: null, isActive: true },
          select: {
            id: true,
            name: true,
            photoUrl: true,
            bio: true,
            email: true,
            phone: true,
            displayOrder: true,
            position: {
              select: {
                code: true,
                title: true,
              },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
        rules: {
          where: { deletedAt: null, isActive: true },
          select: {
            id: true,
            title: true,
            contentMarkdown: true,
            pdfAttachmentUrl: true,
            displayOrder: true,
          },
          orderBy: { displayOrder: 'asc' },
        },
        announcements: {
          where: {
            deletedAt: null,
            status: 'PUBLISHED',
            audience: 'PUBLIC',
            OR: [
              { scheduledAt: null },
              { scheduledAt: { lte: new Date() } },
            ],
            AND: [
              {
                OR: [
                  { expiresAt: null },
                  { expiresAt: { gt: new Date() } },
                ],
              },
            ],
          },
          select: {
            id: true,
            title: true,
            content: true,
            summary: true,
            coverImageUrl: true,
            ctaLabel: true,
            ctaUrl: true,
            isPinned: true,
            publishedAt: true,
          },
          orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        },
        membershipPlans: {
          where: { deletedAt: null, isActive: true },
          select: {
            id: true,
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
        },
      },
    });

    if (!org) {
      throw new NotFoundException(`Organization '${identifier}' not found`);
    }

    return org;
  }

  /**
   * Onboards a new organization. Platform admin operation.
   * Enforces strict reserved slug validation and audit logging.
   */
  async createOrganization(
    dto: CreateOrganizationDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const cleanSlug = dto.slug.toLowerCase().trim();

    if (RESERVED_ORGANIZATION_SLUGS.has(cleanSlug)) {
      throw new BadRequestException(`Slug '${cleanSlug}' is reserved for platform use`);
    }

    const existing = await this.prisma.organization.findUnique({
      where: { slug: cleanSlug },
    });

    if (existing) {
      throw new ConflictException(`Organization slug '${cleanSlug}' is already taken`);
    }

    const org = await this.prisma.organization.create({
      data: {
        name: dto.name.trim(),
        slug: cleanSlug,
        contactEmail: dto.contactEmail.toLowerCase().trim(),
        contactPhone: dto.contactPhone?.trim(),
        address: dto.address?.trim(),
        defaultLanguage: dto.defaultLanguage || 'en',
        timezone: dto.timezone || 'Africa/Addis_Ababa',
        currency: dto.currency || 'ETB',
        logoUrl: dto.logoUrl,
        status: OrganizationStatus.ACTIVE,
        profile: dto.profile
          ? {
              create: {
                mission: dto.profile.mission ? { en: dto.profile.mission } : undefined,
                vision: dto.profile.vision ? { en: dto.profile.vision } : undefined,
                history: dto.profile.history ? { en: dto.profile.history } : undefined,
                values: dto.profile.purpose ? { en: dto.profile.purpose } : undefined,
                brandingConfig: dto.profile.contactDetails
                  ? { contactDetails: dto.profile.contactDetails }
                  : undefined,
              },
            }
          : undefined,
      },
      include: {
        profile: true,
      },
    });

    await this.auditService.logEvent({
      organizationId: org.id,
      actorUserId,
      action: 'ORGANIZATION_CREATE',
      entityType: 'Organization',
      entityId: org.id,
      afterDiff: {
        name: org.name,
        slug: org.slug,
        contactEmail: org.contactEmail,
      },
      ipAddress,
      userAgent,
    });

    return org;
  }

  /**
   * Retrieves member roster for a specific tenant.
   * Executed strictly via PostgreSQL RLS transaction (PrismaService.withTenantContext)
   * under the dedicated 'waanofii_app' role.
   */
  async getMembersRoster(organizationId: string) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      return tx.memberProfile.findMany({
        where: {
          organizationId,
          deletedAt: null,
        },
        select: {
          id: true,
          organizationId: true,
          userId: true,
          memberNumber: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          photoUrl: true,
          gender: true,
          dateOfBirth: true,
          nationalIdNumber: true,
          address: true,
          city: true,
          status: true,
          adminNotes: true,
          suspensionReason: true,
          suspendedAt: true,
          approvedAt: true,
          rejectedAt: true,
          rejectionReason: true,
          joinedAt: true,
          createdAt: true,
          memberships: {
            select: {
              id: true,
              status: true,
              startDate: true,
              endDate: true,
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
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { joinedAt: 'asc' },
      });
    });
  }

  /**
   * Retrieves all organizations on platform for Platform Admins.
   */
  async getAllForPlatformAdmin() {
    return this.prisma.organization.findMany({
      where: { deletedAt: null },
      include: {
        subscription: {
          include: { saasPlan: true },
        },
        _count: {
          select: {
            memberProfiles: true,
            staffMemberships: true,
            memberships: true,
            payments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Updates organization lifecycle status. Platform admin operation.
   * Validates transitions, audits the transition, and is idempotent.
   */
  async updateOrganizationStatus(
    identifier: string,
    dto: UpdateOrganizationStatusDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      identifier,
    );
    const org = await this.prisma.organization.findFirst({
      where: isUuid ? { id: identifier } : { slug: identifier.toLowerCase().trim() },
    });

    if (!org) {
      throw new NotFoundException(`Organization '${identifier}' not found`);
    }

    if (!Object.values(OrganizationStatus).includes(dto.status)) {
      throw new BadRequestException(
        `Status must be one of: ${Object.values(OrganizationStatus).join(', ')}`,
      );
    }

    if (org.status === dto.status) {
      return {
        success: true,
        message: `Organization is already in status ${dto.status}`,
        status: org.status,
        organization: org,
      };
    }

    const previousStatus = org.status;
    const updated = await this.prisma.organization.update({
      where: { id: org.id },
      data: { status: dto.status },
    });

    await this.auditService.logEvent({
      organizationId: org.id,
      actorUserId,
      action: 'ORGANIZATION_STATUS_UPDATE',
      entityType: 'Organization',
      entityId: org.id,
      beforeDiff: { status: previousStatus },
      afterDiff: { status: dto.status, reason: dto.reason },
      ipAddress,
      userAgent,
    });

    return {
      success: true,
      message: `Organization status updated from ${previousStatus} to ${dto.status}`,
      status: updated.status,
      organization: updated,
    };
  }

  /**
   * Updates organization settings and metadata.
   */
  async updateOrganization(
    identifier: string,
    dto: UpdateOrganizationDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      identifier,
    );
    const org = await this.prisma.organization.findFirst({
      where: isUuid ? { id: identifier } : { slug: identifier.toLowerCase().trim() },
    });

    if (!org) {
      throw new NotFoundException(`Organization '${identifier}' not found`);
    }

    const updated = await this.prisma.organization.update({
      where: { id: org.id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.contactEmail ? { contactEmail: dto.contactEmail.toLowerCase().trim() } : {}),
        ...(dto.contactPhone !== undefined ? { contactPhone: dto.contactPhone?.trim() || null } : {}),
        ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
        ...(dto.coverImageUrl !== undefined ? { coverImageUrl: dto.coverImageUrl } : {}),
        ...(dto.defaultLanguage ? { defaultLanguage: dto.defaultLanguage } : {}),
        ...(dto.currency ? { currency: dto.currency } : {}),
      },
    });

    await this.auditService.logEvent({
      organizationId: org.id,
      actorUserId,
      action: 'ORGANIZATION_UPDATE',
      entityType: 'Organization',
      entityId: org.id,
      beforeDiff: {
        name: org.name,
        contactEmail: org.contactEmail,
      },
      afterDiff: dto,
      ipAddress,
      userAgent,
    });

    return updated;
  }

  /**
   * Retrieves staff roster for an organization.
   * Executed strictly via PostgreSQL RLS transaction (PrismaService.withTenantContext).
   */
  async getStaffRoster(organizationId: string) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      return tx.staffMembership.findMany({
        where: {
          organizationId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phoneNumber: true,
              firstName: true,
              lastName: true,
              status: true,
              createdAt: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
              code: true,
              description: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    });
  }

  /**
   * Returns list of staff roles available to assign.
   */
  async getAvailableStaffRoles(organizationId?: string) {
    return this.prisma.role.findMany({
      where: {
        code: { in: [...ALLOWED_STAFF_ROLES] },
        OR: [
          { organizationId: null },
          ...(organizationId ? [{ organizationId }] : []),
        ],
      },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Assigns a user to a staff role within the organization.
   * Audited and strictly restricted.
   */
  async assignStaff(
    organizationId: string,
    dto: AssignStaffDto,
    actorUserId?: string,
    actorRole?: string,
    isPlatformAdmin?: boolean,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Privilege check: Only an OWNER or Platform Admin can assign the OWNER role
    if (dto.roleCode === 'OWNER' && !isPlatformAdmin && actorRole !== 'OWNER') {
      throw new ForbiddenException(
        'Only an Organization Owner or Platform Administrator can assign the Owner role',
      );
    }

    const identifier = dto.identifier.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase() },
          { phoneNumber: identifier },
          { id: identifier },
        ],
      },
    });

    if (!user) {
      throw new NotFoundException(
        `User with identifier '${identifier}' not found. Please verify the user exists on the platform.`,
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new BadRequestException(
        `User account is ${user.status.toLowerCase()} and cannot be assigned as staff`,
      );
    }

    const role = await this.prisma.role.findFirst({
      where: {
        code: dto.roleCode,
        OR: [{ organizationId: null }, { organizationId }],
      },
    });

    if (!role) {
      throw new NotFoundException(`Role '${dto.roleCode}' not found`);
    }

    const result = await this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.staffMembership.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: user.id,
          },
        },
        include: { role: true },
      });

      if (existing) {
        if (existing.isActive) {
          throw new ConflictException(
            `User is already an active staff member with role ${existing.role.name}`,
          );
        }
        return tx.staffMembership.update({
          where: { id: existing.id },
          data: {
            roleId: role.id,
            isActive: true,
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                phoneNumber: true,
                firstName: true,
                lastName: true,
                status: true,
              },
            },
            role: {
              select: {
                id: true,
                name: true,
                code: true,
                description: true,
              },
            },
          },
        });
      }

      return tx.staffMembership.create({
        data: {
          organizationId,
          userId: user.id,
          roleId: role.id,
          isActive: true,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phoneNumber: true,
              firstName: true,
              lastName: true,
              status: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
              code: true,
              description: true,
            },
          },
        },
      });
    });

    await this.auditService.logEvent({
      organizationId,
      actorUserId,
      action: 'STAFF_ASSIGNED',
      entityType: 'StaffMembership',
      entityId: result.id,
      afterDiff: {
        userId: user.id,
        userEmail: user.email,
        roleCode: role.code,
        roleName: role.name,
      },
      ipAddress,
      userAgent,
    });

    return result;
  }

  /**
   * Updates staff role or active status.
   */
  async updateStaff(
    organizationId: string,
    staffMembershipId: string,
    dto: UpdateStaffDto,
    actorUserId?: string,
    actorRole?: string,
    isPlatformAdmin?: boolean,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.staffMembership.findFirst({
        where: {
          id: staffMembershipId,
          organizationId,
        },
        include: { role: true, user: true },
      });

      if (!existing) {
        throw new NotFoundException('Staff membership record not found in this organization');
      }

      // Privilege check: modifying an OWNER or assigning OWNER requires OWNER or Platform Admin
      if (
        (existing.role.code === 'OWNER' || dto.roleCode === 'OWNER') &&
        !isPlatformAdmin &&
        actorRole !== 'OWNER'
      ) {
        throw new ForbiddenException(
          'Only an Organization Owner or Platform Administrator can modify Owner staff assignments',
        );
      }

      // Safety check: Cannot demote or deactivate the last active OWNER
      if (
        existing.role.code === 'OWNER' &&
        (dto.isActive === false || (dto.roleCode && dto.roleCode !== 'OWNER'))
      ) {
        const ownerCount = await tx.staffMembership.count({
          where: {
            organizationId,
            isActive: true,
            role: { code: 'OWNER' },
          },
        });
        if (ownerCount <= 1) {
          throw new BadRequestException(
            'Cannot deactivate or change the role of the last active Organization Owner',
          );
        }
      }

      let newRoleId = existing.roleId;
      if (dto.roleCode) {
        const role = await tx.role.findFirst({
          where: {
            code: dto.roleCode,
            OR: [{ organizationId: null }, { organizationId }],
          },
        });
        if (!role) {
          throw new NotFoundException(`Role '${dto.roleCode}' not found`);
        }
        newRoleId = role.id;
      }

      const updated = await tx.staffMembership.update({
        where: { id: staffMembershipId },
        data: {
          ...(dto.roleCode ? { roleId: newRoleId } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phoneNumber: true,
              firstName: true,
              lastName: true,
              status: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
              code: true,
              description: true,
            },
          },
        },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'STAFF_UPDATED',
        entityType: 'StaffMembership',
        entityId: updated.id,
        beforeDiff: {
          roleCode: existing.role.code,
          isActive: existing.isActive,
        },
        afterDiff: {
          roleCode: updated.role.code,
          isActive: updated.isActive,
        },
        ipAddress,
        userAgent,
      });

      return updated;
    });
  }

  /**
   * Revokes staff membership entirely.
   */
  async revokeStaff(
    organizationId: string,
    staffMembershipId: string,
    actorUserId?: string,
    actorRole?: string,
    isPlatformAdmin?: boolean,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.staffMembership.findFirst({
        where: {
          id: staffMembershipId,
          organizationId,
        },
        include: { role: true, user: true },
      });

      if (!existing) {
        throw new NotFoundException('Staff membership record not found');
      }

      if (existing.role.code === 'OWNER' && !isPlatformAdmin && actorRole !== 'OWNER') {
        throw new ForbiddenException(
          'Only an Organization Owner or Platform Administrator can revoke an Owner staff member',
        );
      }

      if (existing.role.code === 'OWNER') {
        const ownerCount = await tx.staffMembership.count({
          where: {
            organizationId,
            isActive: true,
            role: { code: 'OWNER' },
          },
        });
        if (ownerCount <= 1) {
          throw new BadRequestException('Cannot remove the last active Organization Owner');
        }
      }

      await tx.staffMembership.delete({
        where: { id: staffMembershipId },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'STAFF_REVOKED',
        entityType: 'StaffMembership',
        entityId: staffMembershipId,
        beforeDiff: {
          userId: existing.userId,
          userEmail: existing.user?.email,
          roleCode: existing.role.code,
        },
        ipAddress,
        userAgent,
      });

      return {
        success: true,
        message: 'Staff membership revoked successfully',
      };
    });
  }
}
