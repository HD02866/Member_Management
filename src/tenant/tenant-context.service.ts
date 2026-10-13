import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { TenantContext } from '../common/types/tenant-context.type';

@Injectable()
export class TenantContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<TenantContext>();

  /**
   * Runs the provided function within the asynchronous boundary of the given TenantContext.
   */
  runWithContext<R>(context: TenantContext, callback: () => R): R {
    return this.asyncLocalStorage.run(context, callback);
  }

  /**
   * Retrieves the current request-scoped TenantContext if available.
   */
  getContext(): TenantContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * Retrieves the current organizationId or undefined.
   */
  getOrganizationId(): string | undefined {
    return this.asyncLocalStorage.getStore()?.organizationId;
  }

  /**
   * Retrieves the current organizationSlug or undefined.
   */
  getOrganizationSlug(): string | undefined {
    return this.asyncLocalStorage.getStore()?.organizationSlug;
  }

  /**
   * Asserts that a valid organization context exists for the current request.
   * Throws BadRequestException if missing.
   */
  requireOrganizationId(): string {
    const orgId = this.getOrganizationId();
    if (!orgId) {
      throw new BadRequestException('Request requires a valid resolved tenant context');
    }
    return orgId;
  }

  /**
   * Updates or merges attributes into the active request context (e.g. after user affiliation lookup).
   */
  updateContext(partial: Partial<TenantContext>): void {
    const current = this.asyncLocalStorage.getStore();
    if (current) {
      Object.assign(current, partial);
    }
  }
}
