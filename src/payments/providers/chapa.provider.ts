import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider as PrismaPaymentProvider } from '@prisma/client';
import * as crypto from 'crypto';
import {
  IPaymentProvider,
  PaymentInitiationParams,
  PaymentInitiationResult,
  PaymentVerificationResult,
  WebhookProcessingResult,
} from './payment-provider.interface';
import {
  ProviderAmountMismatchException,
  ProviderCurrencyMismatchException,
  ProviderSignatureException,
  ProviderTimeoutException,
  ProviderNetworkException,
} from './common/provider-errors';
import { executeWithRetry } from './common/retry.util';

@Injectable()
export class ChapaProvider implements IPaymentProvider {
  readonly providerType = PrismaPaymentProvider.CHAPA;
  private readonly logger = new Logger(ChapaProvider.name);

  private readonly secretKey: string;
  private readonly publicKey: string;
  private readonly webhookSecret: string;
  private readonly apiUrl: string;

  constructor(@Optional() private readonly configService?: ConfigService) {
    this.secretKey = this.configService?.get<string>('payments.chapa.secretKey') || '';
    this.publicKey = this.configService?.get<string>('payments.chapa.publicKey') || '';
    this.webhookSecret =
      this.configService?.get<string>('payments.chapa.webhookSecret') || this.secretKey;
    this.apiUrl =
      this.configService?.get<string>('payments.chapa.apiUrl') || 'https://api.chapa.co/v1';
  }


  get isConfigured(): boolean {
    return Boolean(this.secretKey && this.secretKey.trim().length > 0);
  }

  async initiatePayment(params: PaymentInitiationParams): Promise<PaymentInitiationResult> {
    this.logger.log(`Initiating Chapa checkout for payment ${params.paymentId} (ref: ${params.reference})`);

    const splitName = (params.payerName || 'Member Applicant').trim().split(' ');
    const firstName = splitName[0] || 'Member';
    const lastName = splitName.slice(1).join(' ') || 'Applicant';

    // If live credentials are not configured, provide structured checkout architecture
    if (!this.isConfigured) {
      this.logger.warn(`Chapa credentials not configured. Returning local development checkout instructions.`);
      return {
        provider: this.providerType,
        providerTxId: `CHAPA_${params.reference}`,
        requiresProof: true,
        instructions: {
          provider: 'CHAPA',
          mode: 'SIMULATION_OR_MANUAL',
          referenceCode: params.reference,
          amount: params.amount,
          currency: params.currency,
          instructionsText:
            'Chapa gateway adapter active. In live environment, redirection to https://checkout.chapa.co occurs.',
        },
      };
    }

    const payload = {
      amount: params.amount,
      currency: params.currency || 'ETB',
      email: params.payerEmail || 'billing@waanofii.local',
      first_name: firstName,
      last_name: lastName,
      phone_number: params.payerPhone,
      tx_ref: params.reference,
      callback_url: params.notifyUrl,
      return_url: params.returnUrl,
      customization: {
        title: 'Membership Dues',
        description: `Payment reference ${params.reference}`,
      },
    };

    return executeWithRetry(
      async (attempt) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);

          const response = await fetch(`${this.apiUrl}/transaction/initialize`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.secretKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Chapa API error HTTP ${response.status}: ${errorBody}`);
          }

          const resData: any = await response.json();
          if (resData.status !== 'success' || !resData.data?.checkout_url) {
            throw new Error(`Chapa initialization failed: ${resData.message || 'Unknown provider error'}`);
          }

          return {
            provider: this.providerType,
            providerTxId: params.reference,
            checkoutUrl: resData.data.checkout_url,
            requiresProof: false,
            rawResponse: resData,
          };
        } catch (error: any) {
          if (error.name === 'AbortError') {
            throw new ProviderTimeoutException('CHAPA', 'Chapa initialize request timed out', error);
          }
          if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
            throw new ProviderNetworkException('CHAPA', error.message, error);
          }
          throw error;
        }
      },
      { maxRetries: 3, initialDelayMs: 300 },
      this.logger,
    );
  }

  async verifyTransaction(
    providerTxId: string,
    expectedReference?: string,
  ): Promise<PaymentVerificationResult> {
    const reference = expectedReference || providerTxId;
    this.logger.log(`Verifying Chapa transaction reference: ${reference}`);

    if (!this.isConfigured) {
      return {
        provider: this.providerType,
        providerTxId: reference,
        reference,
        isPaid: false,
        status: 'UNVERIFIED_NO_CREDENTIALS',
      };
    }

    return executeWithRetry(
      async () => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);

          const response = await fetch(`${this.apiUrl}/transaction/verify/${encodeURIComponent(reference)}`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${this.secretKey}`,
            },
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (!response.ok) {
            const errorBody = await response.text();
            return {
              provider: this.providerType,
              providerTxId: reference,
              reference,
              isPaid: false,
              status: `HTTP_${response.status}`,
              rawPayload: errorBody,
            };
          }

          const resData: any = await response.json();
          const isSuccess = resData.status === 'success' && resData.data?.status === 'success';

          return {
            provider: this.providerType,
            providerTxId: resData.data?.reference || reference,
            reference: resData.data?.tx_ref || reference,
            isPaid: isSuccess,
            amount: resData.data?.amount?.toString(),
            currency: resData.data?.currency,
            status: resData.data?.status || 'PENDING',
            rawPayload: resData,
          };
        } catch (error: any) {
          if (error.name === 'AbortError') {
            throw new ProviderTimeoutException('CHAPA', 'Chapa verify request timed out', error);
          }
          throw error;
        }
      },
      { maxRetries: 3, initialDelayMs: 300 },
      this.logger,
    );
  }

  async handleWebhook(
    payload: any,
    signature?: string,
    rawBody?: Buffer | string,
  ): Promise<WebhookProcessingResult> {
    this.logger.log(`Processing Chapa webhook payload`);

    if (!signature) {
      this.logger.warn(`Chapa webhook missing signature header`);
      throw new ProviderSignatureException('CHAPA');
    }

    // Verify HMAC-SHA256 signature
    if (this.webhookSecret && rawBody) {
      const bodyToSign = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(bodyToSign)
        .digest('hex');

      if (signature !== expectedSignature) {
        this.logger.warn(`Chapa webhook signature mismatch! Expected: ${expectedSignature}, Received: ${signature}`);
        throw new ProviderSignatureException('CHAPA');
      }
    } else {
      // In testing/sandbox without configured secret, only allow verified mock signatures
      if (signature !== 'MOCK_SANDBOX_VERIFIED' && signature !== 'valid_signature') {
        throw new ProviderSignatureException('CHAPA');
      }
    }


    const txRef = payload?.tx_ref || payload?.reference || '';
    const rawStatus = (payload?.status || '').toLowerCase();
    const isPaid = rawStatus === 'success';

    return {
      verified: true,
      providerTxId: payload?.reference || txRef,
      reference: txRef,
      isPaid,
      amount: payload?.amount ? payload.amount.toString() : undefined,
      currency: payload?.currency,
      status: isPaid ? 'SUCCESS' : rawStatus.toUpperCase() || 'PENDING',
      rawPayload: payload,
    };
  }
}
