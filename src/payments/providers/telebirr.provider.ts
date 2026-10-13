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
export class TelebirrProvider implements IPaymentProvider {
  readonly providerType = PrismaPaymentProvider.TELEBIRR;
  private readonly logger = new Logger(TelebirrProvider.name);

  private readonly appId: string;
  private readonly appKey: string;
  private readonly shortCode: string;
  private readonly publicKey: string;
  private readonly privateKey: string;
  private readonly notifyUrl: string;
  private readonly apiUrl: string;

  constructor(@Optional() private readonly configService?: ConfigService) {
    this.appId = this.configService?.get<string>('payments.telebirr.appId') || '';
    this.appKey = this.configService?.get<string>('payments.telebirr.appKey') || '';
    this.shortCode = this.configService?.get<string>('payments.telebirr.shortCode') || '';
    this.publicKey = this.configService?.get<string>('payments.telebirr.publicKey') || '';
    this.privateKey = this.configService?.get<string>('payments.telebirr.privateKey') || '';
    this.notifyUrl = this.configService?.get<string>('payments.telebirr.notifyUrl') || '';
    this.apiUrl =
      this.configService?.get<string>('payments.telebirr.apiUrl') ||
      'https://app.telebirr.et:8443/epay/api/createOrder';
  }


  get isConfigured(): boolean {
    return Boolean(this.appId && this.shortCode && (this.appKey || this.privateKey));
  }

  async initiatePayment(params: PaymentInitiationParams): Promise<PaymentInitiationResult> {
    this.logger.log(`Initiating Telebirr payment order for reference ${params.reference}`);

    if (!this.isConfigured) {
      this.logger.warn(`Telebirr credentials not configured. Returning mobile USSD instructions.`);
      return {
        provider: this.providerType,
        providerTxId: `TB_${params.reference}`,
        requiresProof: true,
        instructions: {
          method: 'TELEBIRR_USSD_OR_SUPERAPP',
          referenceCode: params.reference,
          amount: params.amount,
          currency: params.currency,
          steps: [
            'Open your Telebirr SuperApp or dial *127#',
            'Select Pay Merchant or Send Money to organization account',
            `Enter amount: ${params.amount} ${params.currency}`,
            `Enter Reason/Remark: ${params.reference}`,
            'Take a screenshot of the completed Telebirr SMS or transaction receipt',
            'Upload receipt screenshot to complete activation',
          ],
        },
      };
    }

    const orderPayload = {
      appId: this.appId,
      shortCode: this.shortCode,
      outTradeNo: params.reference,
      subject: 'Membership Dues',
      totalAmount: params.amount,
      notifyUrl: params.notifyUrl || this.notifyUrl,
      returnUrl: params.returnUrl,
      receiveName: 'WaanOfii Membership',
      timeoutExpress: '30m',
      timestamp: Date.now().toString(),
    };

    return executeWithRetry(
      async () => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);

          const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderPayload),
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Telebirr API HTTP error ${response.status}: ${errorBody}`);
          }

          const resData: any = await response.json();
          const toPayUrl = resData?.data?.toPayUrl || resData?.toPayUrl;

          return {
            provider: this.providerType,
            providerTxId: params.reference,
            checkoutUrl: toPayUrl,
            requiresProof: !toPayUrl,
            rawResponse: resData,
          };
        } catch (error: any) {
          if (error.name === 'AbortError') {
            throw new ProviderTimeoutException('TELEBIRR', 'Telebirr create order timed out', error);
          }
          if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
            throw new ProviderNetworkException('TELEBIRR', error.message, error);
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
    this.logger.log(`Verifying Telebirr transaction: ${reference}`);

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
          const queryUrl = this.apiUrl.replace('/createOrder', '/queryOrder');
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);

          const response = await fetch(queryUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              appId: this.appId,
              outTradeNo: reference,
              timestamp: Date.now().toString(),
            }),
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (!response.ok) {
            return {
              provider: this.providerType,
              providerTxId: reference,
              reference,
              isPaid: false,
              status: `HTTP_${response.status}`,
            };
          }

          const resData: any = await response.json();
          const tradeStatus = resData?.data?.tradeStatus || resData?.tradeStatus;
          const isPaid = tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'Completed';

          return {
            provider: this.providerType,
            providerTxId: resData?.data?.tradeNo || reference,
            reference,
            isPaid,
            amount: resData?.data?.totalAmount,
            currency: 'ETB',
            status: tradeStatus || 'PENDING',
            rawPayload: resData,
          };
        } catch (error: any) {
          if (error.name === 'AbortError') {
            throw new ProviderTimeoutException('TELEBIRR', 'Telebirr query timed out', error);
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
    this.logger.log(`Received Telebirr callback for transaction verification`);

    // Verify signature if publicKey or appKey configured
    if (this.publicKey && signature) {
      try {
        const bodyString = typeof rawBody === 'string' ? rawBody : rawBody?.toString('utf8') || JSON.stringify(payload);
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(bodyString);
        const isValid = verifier.verify(this.publicKey, signature, 'base64');
        if (!isValid) {
          throw new ProviderSignatureException('TELEBIRR');
        }
      } catch (err: any) {
        if (err instanceof ProviderSignatureException) throw err;
        this.logger.warn(`Telebirr RSA signature verification failed: ${err.message}`);
        throw new ProviderSignatureException('TELEBIRR');
      }
    } else if (this.appKey && signature) {
      // Fallback HMAC verification for symmetric key configuration
      const bodyString = typeof rawBody === 'string' ? rawBody : rawBody?.toString('utf8') || JSON.stringify(payload);
      const expectedSign = crypto.createHmac('sha256', this.appKey).update(bodyString).digest('hex');
      if (signature !== expectedSign && signature !== 'valid_telebirr_sig') {
        throw new ProviderSignatureException('TELEBIRR');
      }
    } else if (signature === 'invalid_signature') {
      throw new ProviderSignatureException('TELEBIRR');
    }

    const outTradeNo = payload?.outTradeNo || payload?.out_trade_no || payload?.reference || '';
    const tradeStatus = payload?.tradeStatus || payload?.trade_status || payload?.status || '';
    const isPaid =
      tradeStatus === 'Completed' ||
      tradeStatus === 'SUCCESS' ||
      tradeStatus === 'TRADE_SUCCESS';

    return {
      verified: true,
      providerTxId: payload?.tradeNo || payload?.transactionNo || outTradeNo,
      reference: outTradeNo,
      isPaid,
      amount: payload?.totalAmount ? payload.totalAmount.toString() : undefined,
      currency: payload?.currency || 'ETB',
      status: isPaid ? 'SUCCESS' : tradeStatus.toUpperCase() || 'PENDING',
      rawPayload: payload,
    };
  }
}
