import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { User, UserStatus } from '@prisma/client';

export interface UserAffiliationSummary {
  id: string;
  email: string | null;
  phoneNumber: string | null;
  firstName: string;
  lastName: string;
  isPlatformAdmin: boolean;
  status: UserStatus;
  createdAt: Date;
  memberProfiles: {
    id: string;
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    memberNumber: string;
    status: string;
    logoUrl?: string | null;
    brandingConfig?: any;
  }[];
  staffMemberships: {
    id: string;
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    roleCode: string;
    roleName: string;
    permissions: string[];
    logoUrl?: string | null;
    brandingConfig?: any;
  }[];
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Look up user by canonical identifier (email or phone number).
   * Email search is case-insensitive.
   */
  async findByIdentifier(identifier: string): Promise<User | null> {
    const clean = identifier.trim();
    const isEmail = clean.includes('@');

    if (isEmail) {
      return this.prisma.user.findFirst({
        where: {
          email: {
            equals: clean.toLowerCase(),
            mode: 'insensitive',
          },
        },
      });
    }

    // Phone number lookup
    const canonicalPhone = this.normalizePhone(clean);
    return this.prisma.user.findFirst({
      where: {
        phoneNumber: canonicalPhone,
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Retrieves user profile along with all active multi-tenant affiliations (staff & member).
   */
  async getUserWithAffiliations(userId: string): Promise<UserAffiliationSummary> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberProfiles: {
          where: { deletedAt: null },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                profile: {
                  select: {
                    brandingConfig: true,
                  },
                },
              },
            },
          },
        },
        staffMemberships: {
          where: { isActive: true },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                profile: {
                  select: {
                    brandingConfig: true,
                  },
                },
              },
            },
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User account not found');
    }

    return {
      id: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      firstName: user.firstName,
      lastName: user.lastName,
      isPlatformAdmin: user.isPlatformAdmin,
      status: user.status,
      createdAt: user.createdAt,
      memberProfiles: user.memberProfiles.map((mp) => {
        const bc = (mp.organization.profile?.brandingConfig as any) || null;
        return {
          id: mp.id,
          organizationId: mp.organizationId,
          organizationName: mp.organization.name,
          organizationSlug: mp.organization.slug,
          memberNumber: mp.memberNumber,
          status: mp.status,
          logoUrl: bc?.logoUrl || null,
          brandingConfig: bc,
        };
      }),
      staffMemberships: user.staffMemberships.map((sm) => {
        const bc = (sm.organization.profile?.brandingConfig as any) || null;
        return {
          id: sm.id,
          organizationId: sm.organizationId,
          organizationName: sm.organization.name,
          organizationSlug: sm.organization.slug,
          roleCode: sm.role.code,
          roleName: sm.role.name,
          permissions: sm.role.rolePermissions.map((rp) => rp.permission.code),
          logoUrl: bc?.logoUrl || null,
          brandingConfig: bc,
        };
      }),
    };
  }

  /**
   * Normalizes phone numbers to standard representation (E.164 canonical representation).
   */
  normalizePhone(phone: string): string {
    const digits = phone.replace(/[^0-9+]/g, '');
    if (digits.startsWith('09') && digits.length === 10) {
      return '+251' + digits.substring(1);
    }
    if (digits.startsWith('07') && digits.length === 10) {
      return '+251' + digits.substring(1);
    }
    if (digits.startsWith('251') && !digits.startsWith('+')) {
      return '+' + digits;
    }
    return digits;
  }
}
