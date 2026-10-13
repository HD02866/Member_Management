import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionEntitlementService } from './subscription-entitlement.service';
import { SaasBillingService } from './saas-billing.service';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuditModule, TenantModule, AuthModule],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    SubscriptionEntitlementService,
    SaasBillingService,
  ],
  exports: [
    SubscriptionsService,
    SubscriptionEntitlementService,
    SaasBillingService,
  ],
})
export class SubscriptionsModule {}
