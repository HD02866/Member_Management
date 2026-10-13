import { Injectable, Logger } from '@nestjs/common';
import {
  EmailProvider,
  EmailMessage,
  EmailSendResult,
} from './email-provider.interface';

@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  readonly providerName = 'CONSOLE_DEVELOPMENT';
  readonly isConfigured = true;
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    this.logger.log(`\n================= [DISPATCHING EMAIL] =================`);
    this.logger.log(`TO: ${message.to}`);
    this.logger.log(`SUBJECT: ${message.subject}`);
    this.logger.log(`BODY:\n${message.bodyText}`);
    this.logger.log(`=======================================================\n`);

    const simulatedId = `msg-dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      success: true,
      providerMessageId: simulatedId,
      isDelivered: true,
      status: 'SIMULATED',
    };
  }
}
