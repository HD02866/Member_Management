import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { AuthenticatedUser } from '../types/authenticated-user.type';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { PermissionAliases } from '../types/permissions.enum';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(TenantContextService)
    private readonly tenantContextService: TenantContextService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      throw new UnauthorizedException('Authentication required to verify permissions');
    }

    // Platform Super Admin bypasses tenant permission checks
    if (user.isPlatformAdmin) {
      return true;
    }

    // Check permissions granted to the user within this specific tenant
    const contextPermissions: string[] =
      request.tenantPermissions || this.tenantContextService.getContext()?.permissions || [];

    const hasAllPermissions = requiredPermissions.every((perm) => {
      if (contextPermissions.includes(perm)) return true;
      const alias = PermissionAliases[perm];
      if (alias && contextPermissions.includes(alias)) return true;
      const withTenant = `tenant:${perm.replace(/^tenant:/, '')}`;
      if (contextPermissions.includes(withTenant)) return true;
      const dotFormat = perm.replace(/^tenant:/, '').replace(/:/g, '.');
      if (contextPermissions.includes(dotFormat)) return true;
      const colonFormat = `tenant:${dotFormat.replace(/\./g, ':')}`;
      if (contextPermissions.includes(colonFormat)) return true;
      return false;
    });

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        `Access denied. Required permissions: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
