import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { validateEnvironment } from './config/validation';
import { DatabaseModule } from './database/database.module';
import { TenantModule } from './tenant/tenant.module';
import { AuditModule } from './audit/audit.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { MembersModule } from './members/members.module';
import { MembershipsModule } from './memberships/memberships.module';
import { PaymentsModule } from './payments/payments.module';
import { CardsModule } from './cards/cards.module';
import { CmsModule } from './cms/cms.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { HealthModule } from './health/health.module';
import { PlatformModule } from './platform/platform.module';
import { MessagesModule } from './messages/messages.module';
import { GroupsModule } from './groups/groups.module';
import { UploadsModule } from './uploads/uploads.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { TenantResolutionMiddleware } from './common/middleware/tenant-resolution.middleware';

@Module({
  imports: [
    // 1. Centralized Environment Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnvironment,
      envFilePath: ['.env'],
    }),

    // 2. Global Rate Limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('throttler.ttl', 60000),
          limit: config.get<number>('throttler.limit', 60),
        },
      ],
    }),

    // 3. Core & Domain Modules
    DatabaseModule,
    TenantModule,
    AuditModule,
    UsersModule,
    AuthModule,
    OrganizationsModule,
    MembersModule,
    MembershipsModule,
    PaymentsModule,
    CardsModule,
    CmsModule,
    NotificationsModule,
    SubscriptionsModule,
    PlatformModule,
    HealthModule,
    MessagesModule,
    GroupsModule,
    UploadsModule,
  ],
  providers: [CorrelationIdMiddleware, TenantResolutionMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, TenantResolutionMiddleware)
      .forRoutes('{*path}');
  }
}
