import {
  Controller,
  Post,
  Param,
  Body,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { PaymentsService } from '../payments.service';

@Controller('payments/webhooks')
export class PaymentWebhooksController {
  constructor(
    @Inject(PaymentsService)
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * Public webhook ingress endpoint for external payment providers.
   * Authenticated via provider-specific signatures (HMAC, RSA, or secret tokens).
   */
  @Public()
  @Post(':provider')
  @HttpCode(HttpStatus.OK)
  async handleProviderWebhook(
    @Param('provider') provider: string,
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ) {
    const rawBody = (req as any).rawBody || JSON.stringify(payload);
    return this.paymentsService.processWebhook(
      provider,
      payload,
      headers,
      rawBody,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
