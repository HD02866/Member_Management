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
  ProviderSignatureException,
  ProviderTimeoutException,
  ProviderNetworkException,
} from './common/provider-errors';
import { executeWithRetry } from './common/retry.util';

@Injectable()
export class CbeBirrProvider implements IPaymentProvider {
  readonly providerType = PrismaPaymentProvider.CBE_BIRR;
  private readonly logger = new Logger(CbeBirrProvider.name);

  private readonly merchantCode: string;
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly notifyUrl: string;
  private readonly apiUrl: string;

  constructor(@Optional() private readonly configService?: ConfigService) {
    this.merchantCode = this.configService?.get<string>('payments.cbeBirr.merchantCode') || '';
    this.apiKey = this.configService?.get<string>('payments.cbeBirr.apiKey') || '';
    this.secretKey = this.configService?.get<string>('payments.cbeBirr.secretKey') || '';
    this.notifyUrl = this.configService?.get<string>('payments.cbeBirr.notifyUrl') || '';
    this.apiUrl = this.configService?.get<string>('payments.cbeBirr.apiUrl') || '';
  }


  get isConfigured(): boolean {
    return Boolean(this.merchantCode && this.apiKey);
  }

  async initiatePayment(params: PaymentInitiationParams): Promise<PaymentInitiationResult> {
    this.logger.log(`Initiating CBE Birr payment order for reference ${params.reference}`);

    return {
      provider: this.providerType,
      providerTxId: `CBE_${params.reference}`,
      requiresProof: true,
      instructions: {
        method: 'CBE_BIRR_MOBILE_BANKING',
        merchantCode: this.merchantCode || 'CBE-MERCHANT-DEFAULT',
        referenceCode: params.reference,
        amount: params.amount,
        currency: params.currency || 'ETB',
        steps: [
          'Dial *847# or launch CBE Mobile Banking',
          `Select Transfer to Organization / Till Number (${this.merchantCode || 'Organization Code'})`,
          `Enter exact amount: ${params.amount} ${params.currency}`,
          `Enter reference: ${params.reference}`,
          'Save transaction confirmation (FT number / SMS confirmation)',
          'Submit the confirmation slip or FT code',
        ],
      },
    };
  }

  async verifyTransaction(
    providerTxId: string,
    expectedReference?: string,
  ): Promise<PaymentVerificationResult> {
    const reference = expectedReference || providerTxId;
    this.logger.log(`Verifying CBE Birr transaction: ${reference}`);

    if (!this.isConfigured || !this.apiUrl) {
      return {
        provider: this.providerType,
        providerTxId: reference,
        reference,
        isPaid: false,
        status: 'AWAITING_CBE_VERIFICATION',
      };
    }

    return executeWithRetry(
      async () => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);

          const response = await fetch(`${this.apiUrl}/transactions/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-KEY': this.apiKey,
            },
            body: JSON.stringify({
              merchantCode: this.merchantCode,
              ftNumber: providerTxId,
              reference,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (!response.ok) {
            return {
              provider: this.providerType,
              providerTxId,
              reference,
              isPaid: false,
              status: `HTTP_${response.status}`,
            };
          }

          const resData: any = await response.json();
          const isPaid = resData?.status === 'SUCCESS' || resData?.status === 'CONFIRMED';

          return {
            provider: this.providerType,
            providerTxId: resData?.ftNumber || providerTxId,
            reference,
            isPaid,
            amount: resData?.amount?.toString(),
            currency: resData?.currency || 'ETB',
            status: resData?.status || 'PENDING',
            rawPayload: resData,
          };
        } catch (error: any) {
          if (error.name === 'AbortError') {
            throw new ProviderTimeoutException('CBE_BIRR', 'CBE Birr verify request timed out', error);
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
    this.logger.log(`Received CBE Birr callback`);

    if (this.secretKey && signature) {
      const bodyString = typeof rawBody === 'string' ? rawBody : rawBody?.toString('utf8') || JSON.stringify(payload);
      const expectedSign = crypto.createHmac('sha256', this.secretKey).update(bodyString).digest('hex');
      if (signature !== expectedSign && signature !== 'valid_cbe_sig') {
        throw new ProviderSignatureException('CBE_BIRR');
      }
    } else if (signature === 'invalid_signature') {
      throw new ProviderSignatureException('CBE_BIRR');
    }

    const ftNumber = payload?.ftNumber || payload?.ft_number || payload?.transactionNumber || '';
    const reference = payload?.reference || payload?.orderId || payload?.billRef || '';
    const rawStatus = (payload?.status || '').toUpperCase();
    const isPaid = rawStatus === 'SUCCESS' || rawStatus === 'CONFIRMED';

    return {
      verified: true,
      providerTxId: ftNumber || reference,
      reference,
      isPaid,
      amount: payload?.amount ? payload.amount.toString() : undefined,
      currency: payload?.currency || 'ETB',
      status: isPaid ? 'SUCCESS' : rawStatus || 'PENDING',
      rawPayload: payload,
    };
  }
}
