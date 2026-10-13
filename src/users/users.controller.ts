import { Controller, Get, UseGuards, Inject } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

export interface UserOrganizationAffiliation {
  id: string;
  name: string;
  slug: string;
  isMember: boolean;
  memberStatus?: string;
  memberNumber?: string;
  isStaff: boolean;
  staffRole?: string;
  staffRoleCode?: string;
  permissions?: string[];
  logoUrl?: string | null;
  brandingConfig?: any;
}

@Controller('me')
export class UsersController {
  constructor(
    @Inject(UsersService)
    private readonly usersService: UsersService,
  ) {}

  /**
   * Retrieves profile of currently authenticated user with all multi-tenant affiliations.
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getUserWithAffiliations(user.id);
  }

  /**
   * Retrieves list of all organizations the authenticated user is affiliated with.
   * Powering the Organization Switcher.
   */
  @UseGuards(JwtAuthGuard)
  @Get('organizations')
  async getMyOrganizations(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserOrganizationAffiliation[]> {
    const summary = await this.usersService.getUserWithAffiliations(user.id);
    const orgMap = new Map<string, UserOrganizationAffiliation>();

    for (const mp of summary.memberProfiles) {
      orgMap.set(mp.organizationId, {
        id: mp.organizationId,
        name: mp.organizationName,
        slug: mp.organizationSlug,
        isMember: true,
        memberStatus: mp.status,
        memberNumber: mp.memberNumber,
        isStaff: false,
        logoUrl: mp.logoUrl,
        brandingConfig: mp.brandingConfig,
      });
    }

    for (const sm of summary.staffMemberships) {
      const existing = orgMap.get(sm.organizationId);
      if (existing) {
        existing.isStaff = true;
        existing.staffRole = sm.roleName;
        existing.staffRoleCode = sm.roleCode;
        existing.permissions = sm.permissions;
        if (!existing.logoUrl && sm.logoUrl) existing.logoUrl = sm.logoUrl;
        if (!existing.brandingConfig && sm.brandingConfig) existing.brandingConfig = sm.brandingConfig;
      } else {
        orgMap.set(sm.organizationId, {
          id: sm.organizationId,
          name: sm.organizationName,
          slug: sm.organizationSlug,
          isMember: false,
          isStaff: true,
          staffRole: sm.roleName,
          staffRoleCode: sm.roleCode,
          permissions: sm.permissions,
          logoUrl: sm.logoUrl,
          brandingConfig: sm.brandingConfig,
        });
      }
    }

    return Array.from(orgMap.values());
  }
}
