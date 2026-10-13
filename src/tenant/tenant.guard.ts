import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  Logger,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from './tenant-context.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ALLOW_PROSPECTIVE_MEMBER_KEY } from '../common/decorators/allow-prospective-member.decorator';
import { OrganizationStatus } from '@prisma/client';

@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(TenantContextService)
    private readonly tenantContextService: TenantContextService,
    @Inject(Reflector)
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantContext = request.tenant || this.tenantContextService.getContext();

    if (!tenantContext || !tenantContext.organizationId) {
      throw new NotFoundException('Organization not found or tenant context missing');
    }

    const user = request.user as AuthenticatedUser | undefined;

    // If endpoint is unauthenticated/public but tenant-scoped (e.g. public org landing page)
    if (!user) {
      return true;
    }

    // 1. Platform SuperAdmin bypass check: Platform admins can oversee any tenant
    if (user.isPlatformAdmin) {
      this.tenantContextService.updateContext({
        isPlatformAdmin: true,
        userRole: 'PLATFORM_SUPER_ADMIN',
      });
      return true;
    }

    // 1b. Organization Lifecycle Enforcement: Prohibit operations on suspended or deactivated tenants
    const org = await this.prisma.organization.findUnique({
      where: { id: tenantContext.organizationId },
      select: { status: true },
    });

    if (org?.status === OrganizationStatus.DEACTIVATED) {
      throw new ForbiddenException('Organization has been archived/deactivated');
    }

    if (org?.status === OrganizationStatus.SUSPENDED) {
      const method = (request.method || '').toUpperCase();
      if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
        throw new ForbiddenException('Organization operations are suspended');
      }
    }

    // 2. Check Staff Membership in this organization
    const staffMembership = await this.prisma.staffMembership.findFirst({
      where: {
        organizationId: tenantContext.organizationId,
        userId: user.id,
        isActive: true,
      },
      include: {
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
    });

    if (staffMembership) {
      const permissions = staffMembership.role.rolePermissions.map((rp) => rp.permission.code);
      this.tenantContextService.updateContext({
        userRole: staffMembership.role.code,
        permissions,
      });
      request.tenantUserRole = staffMembership.role.code;
      request.tenantPermissions = permissions;
      return true;
    }

    // 3. Check Member Profile in this organization
    const memberProfile = await this.prisma.memberProfile.findFirst({
      where: {
        organizationId: tenantContext.organizationId,
        userId: user.id,
        deletedAt: null,
      },
      include: {
        memberships: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (memberProfile) {
      // User is an active/registered member of this organization
      const permissions = ['tenant:members:self_read'];
      this.tenantContextService.updateContext({
        userRole: 'MEMBER',
        permissions,
      });
      request.tenantUserRole = 'MEMBER';
      request.tenantPermissions = permissions;
      return true;
    }

    // 4. Prospective Member route check (e.g. applying for initial membership)
    const allowProspective = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PROSPECTIVE_MEMBER_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (allowProspective) {
      const permissions = ['membership:apply'];
      this.tenantContextService.updateContext({
        userRole: 'PROSPECTIVE_MEMBER',
        permissions,
      });
      request.tenantUserRole = 'PROSPECTIVE_MEMBER';
      request.tenantPermissions = permissions;
      return true;
    }

    // 5. User is authenticated, but has NO valid affiliation with this organization!
    // Reject to enforce strict cross-tenant isolation and prevent unauthorized access.
    this.logger.warn(
      `Cross-tenant access blocked: User ${user.id} attempted to access Organization ${tenantContext.organizationId} without affiliation`,
    );
    throw new ForbiddenException('You do not have permission to access this organization');
  }
}
