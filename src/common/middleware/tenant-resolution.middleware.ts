import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantResolutionService } from '../../tenant/tenant-resolution.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { TenantContext } from '../types/tenant-context.type';

// Extend Express Request interface to include tenant property
declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

@Injectable()
export class TenantResolutionMiddleware implements NestMiddleware {
  constructor(
    @Inject(TenantResolutionService)
    private readonly tenantResolutionService: TenantResolutionService,
    @Inject(TenantContextService)
    private readonly tenantContextService: TenantContextService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await this.tenantResolutionService.resolveTenant(
        req.headers.host,
        req.headers,
        req.originalUrl || req.url,
      );

      if (resolved) {
        const tenantContext: TenantContext = {
          organizationId: resolved.id,
          organizationSlug: resolved.slug,
          organizationName: resolved.name,
        };

        // Attach to request
        req.tenant = tenantContext;

        // Wrap execution in AsyncLocalStorage request context
        this.tenantContextService.runWithContext(tenantContext, () => {
          next();
        });
        return;
      }

      // No tenant resolved (e.g. global /health or /auth routes)
      next();
    } catch (error) {
      next(error);
    }
  }
}
