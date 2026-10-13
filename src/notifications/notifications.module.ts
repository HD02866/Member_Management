import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ConsoleEmailProvider } from './providers/console-email.provider';
import { SmtpEmailProvider } from './providers/smtp-email.provider';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConfigModule, DatabaseModule, AuditModule, TenantModule, AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    ConsoleEmailProvider,
    SmtpEmailProvider,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
