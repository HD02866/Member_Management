import { Global, Module } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';
import { TenantResolutionService } from './tenant-resolution.service';
import { TenantGuard } from './tenant.guard';

@Global()
@Module({
  providers: [TenantContextService, TenantResolutionService, TenantGuard],
  exports: [TenantContextService, TenantResolutionService, TenantGuard],
})
export class TenantModule {}
