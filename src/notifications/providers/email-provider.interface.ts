export interface EmailMessage {
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  metadata?: Record<string, any>;
}

export interface EmailSendResult {
  success: boolean;
  providerMessageId?: string;
  isDelivered: boolean;
  status: string; // 'SENT' | 'SIMULATED' | 'FAILED' | 'UNCONFIGURED'
  error?: string;
}

export interface EmailProvider {
  readonly providerName: string;
  readonly isConfigured: boolean;
  sendEmail(message: EmailMessage): Promise<EmailSendResult>;
}
