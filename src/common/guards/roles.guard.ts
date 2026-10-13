import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/require-roles.decorator';
import { AuthenticatedUser } from '../types/authenticated-user.type';
import { TenantContextService } from '../../tenant/tenant-context.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(TenantContextService)
    private readonly tenantContextService: TenantContextService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      throw new UnauthorizedException('Authentication required to verify roles');
    }

    if (user.isPlatformAdmin) {
      return true;
    }

    const currentRole: string | undefined =
      request.tenantUserRole || this.tenantContextService.getContext()?.userRole;

    if (!currentRole || !requiredRoles.includes(currentRole)) {
      throw new ForbiddenException(
        `Access denied. Required role(s): ${requiredRoles.join(', ')} (Current: ${currentRole || 'NONE'})`,
      );
    }

    return true;
  }
}
