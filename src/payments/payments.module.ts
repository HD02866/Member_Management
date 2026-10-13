import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentsController } from './payments.controller';
import { PaymentWebhooksController } from './webhooks/payment-webhooks.controller';
import { PaymentsService } from './payments.service';
import { PaymentReconciliationService } from './reconciliation/payment-reconciliation.service';
import { PaymentProviderRegistry } from './providers/payment-provider.registry';
import { ManualBankProvider } from './providers/manual-bank.provider';
import { TelebirrProvider } from './providers/telebirr.provider';
import { CbeBirrProvider } from './providers/cbe-birr.provider';
import { ChapaProvider } from './providers/chapa.provider';

@Module({
  imports: [DatabaseModule, AuditModule, TenantModule, AuthModule],
  controllers: [PaymentsController, PaymentWebhooksController],
  providers: [
    PaymentsService,
    PaymentReconciliationService,
    PaymentProviderRegistry,
    ManualBankProvider,
    TelebirrProvider,
    CbeBirrProvider,
    ChapaProvider,
  ],
  exports: [PaymentsService, PaymentReconciliationService],
})
export class PaymentsModule {}

