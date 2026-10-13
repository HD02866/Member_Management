import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? [
              { emit: 'event', level: 'query' },
              { emit: 'stdout', level: 'error' },
              { emit: 'stdout', level: 'info' },
              { emit: 'stdout', level: 'warn' },
            ]
          : [{ emit: 'stdout', level: 'error' }],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('PostgreSQL connection established successfully.');
    } catch (error) {
      this.logger.error('Failed to connect to PostgreSQL database.', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('PostgreSQL connection closed cleanly.');
  }

  /**
   * Executes a database operation within an isolated PostgreSQL transaction
   * bounded strictly by Row-Level Security (RLS) under the dedicated 'waanofii_app' role.
   *
   * Transaction-local parameters (SET LOCAL) reset automatically on commit/rollback,
   * guaranteeing zero connection pool cross-talk.
   */
  async withTenantContext<T>(
    organizationId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (!organizationId) {
      throw new Error('Tenant context requires a valid non-empty organizationId');
    }

    return this.$transaction(async (tx) => {
      // 1. Switch to dedicated non-superuser application role (NOBYPASSRLS)
      await tx.$executeRawUnsafe(`SET LOCAL ROLE waanofii_app;`);
      // 2. Set tenant boundary for RLS
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_organization_id = '${organizationId.replace(/'/g, "''")}';`,
      );

      // 3. Execute domain queries strictly subject to RLS
      return await fn(tx);
    });
  }

  /**
   * Executes a database operation under the trusted 'waanofii_platform_admin' role,
   * permitting cross-tenant metrics and platform maintenance queries.
   */
  async withPlatformAdminContext<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      // Switch to trusted platform admin role
      await tx.$executeRawUnsafe(`SET LOCAL ROLE waanofii_platform_admin;`);
      await tx.$executeRawUnsafe(`SET LOCAL app.current_organization_id = '';`);

      return await fn(tx);
    });
  }
}
