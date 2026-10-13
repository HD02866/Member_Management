import { Injectable, Logger } from '@nestjs/common';
import { PaymentProvider as PrismaPaymentProvider } from '@prisma/client';
import {
  IPaymentProvider,
  PaymentInitiationResult,
  PaymentVerificationResult,
  WebhookProcessingResult,
} from './payment-provider.interface';

@Injectable()
export class ManualBankProvider implements IPaymentProvider {
  readonly providerType = PrismaPaymentProvider.MANUAL_BANK;
  readonly isConfigured = true;
  private readonly logger = new Logger(ManualBankProvider.name);

  async initiatePayment(params: {
    paymentId: string;
    organizationId: string;
    amount: string;
    currency: string;
    reference: string;
    payerName?: string;
  }): Promise<PaymentInitiationResult> {
    this.logger.log(`Initiating manual bank payment ${params.paymentId} with reference ${params.reference}`);
    return {
      provider: this.providerType,
      providerTxId: params.reference,
      requiresProof: true,
      instructions: {
        method: 'MANUAL_BANK_TRANSFER',
        referenceNote: `Please include reference "${params.reference}" on your bank deposit or transfer slip.`,
        instructionsText:
          'After completing your bank transfer or deposit, upload a clear photo or PDF copy of the transaction slip/receipt to confirm your payment.',
      },
    };
  }

  async verifyTransaction(providerTxId: string): Promise<PaymentVerificationResult> {
    return {
      provider: this.providerType,
      providerTxId,
      isPaid: false, // Manual bank payments require human staff verification
      status: 'AWAITING_PROOF_REVIEW',
    };
  }

  async handleWebhook(_payload: any, _signature?: string): Promise<WebhookProcessingResult> {
    return {
      verified: false,
      providerTxId: '',
      isPaid: false,
      status: 'NOT_SUPPORTED_FOR_MANUAL_BANK',
    };
  }
}
