import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantContext } from '../types/tenant-context.type';

export const CurrentTenant = createParamDecorator(
  (data: keyof TenantContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const tenant = request.tenant as TenantContext;
    if (!tenant) {
      return null;
    }
    return data ? tenant[data] : tenant;
  },
);
