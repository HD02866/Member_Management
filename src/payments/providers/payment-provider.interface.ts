import { PaymentProvider as PrismaPaymentProvider } from '@prisma/client';

export interface PaymentInitiationParams {
  paymentId: string;
  organizationId: string;
  amount: string;
  currency: string;
  reference: string;
  payerName?: string;
  payerEmail?: string;
  payerPhone?: string;
  returnUrl?: string;
  notifyUrl?: string;
}

export interface PaymentInitiationResult {
  provider: PrismaPaymentProvider;
  providerTxId?: string;
  checkoutUrl?: string;
  instructions?: Record<string, any>;
  requiresProof: boolean;
  rawResponse?: any;
}

export interface PaymentVerificationResult {
  provider: PrismaPaymentProvider;
  providerTxId: string;
  isPaid: boolean;
  amount?: string;
  currency?: string;
  status: string;
  reference?: string;
  rawPayload?: any;
}

export interface WebhookProcessingResult {
  verified: boolean;
  providerTxId: string;
  reference?: string;
  isPaid: boolean;
  amount?: string;
  currency?: string;
  status: string;
  rawPayload?: any;
}

export interface IPaymentProvider {
  readonly providerType: PrismaPaymentProvider;
  readonly isConfigured: boolean;

  /**
   * Initiates payment with the provider or generates payment instructions.
   */
  initiatePayment(params: PaymentInitiationParams): Promise<PaymentInitiationResult>;

  /**
   * Queries provider for payment status / transaction verification.
   */
  verifyTransaction(providerTxId: string, expectedReference?: string): Promise<PaymentVerificationResult>;

  /**
   * Queries provider payment status by internal reference if supported.
   */
  queryPaymentStatus?(reference: string): Promise<PaymentVerificationResult>;

  /**
   * Validates and parses provider webhook callback.
   */
  handleWebhook(
    payload: any,
    signature?: string,
    rawBody?: Buffer | string,
  ): Promise<WebhookProcessingResult>;

  /**
   * Initiates reversal / refund if supported by the provider.
   */
  refundPayment?(
    providerTxId: string,
    amount: string,
    reason?: string,
  ): Promise<PaymentVerificationResult>;
}
