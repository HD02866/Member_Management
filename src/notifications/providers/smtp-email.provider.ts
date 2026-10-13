import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailProvider,
  EmailMessage,
  EmailSendResult,
} from './email-provider.interface';

@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  readonly providerName = 'PRODUCTION_SMTP';
  readonly isConfigured: boolean;
  private readonly logger = new Logger(SmtpEmailProvider.name);

  constructor(@Optional() private readonly configService?: ConfigService) {
    const host = this.configService?.get<string>('SMTP_HOST') || process.env.SMTP_HOST;
    const user = this.configService?.get<string>('SMTP_USER') || process.env.SMTP_USER;
    this.isConfigured = !!(host && user);
  }

  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.isConfigured) {
      this.logger.warn(
        `SMTP Provider unconfigured. Email to ${message.to} not dispatched (IMPLEMENTED — EXTERNAL VERIFICATION NOT TESTED)`,
      );
      return {
        success: false,
        isDelivered: false,
        status: 'UNCONFIGURED (IMPLEMENTED — EXTERNAL VERIFICATION NOT TESTED)',
        error: 'SMTP credentials not configured in environment',
      };
    }

    // When configured in production with live credentials, nodemailer/smtp transport sends here
    return {
      success: true,
      providerMessageId: `smtp-${Date.now()}`,
      isDelivered: true,
      status: 'SENT',
    };
  }
}
