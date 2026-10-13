import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface AuditEventParams {
  organizationId: string;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeDiff?: Record<string, any> | null;
  afterDiff?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Records an immutable audit log entry.
   * Diffs are automatically sanitized to strip passwords, tokens, and secrets.
   */
  async logEvent(params: AuditEventParams): Promise<void> {
    try {
      const sanitizedBefore = this.sanitizeData(params.beforeDiff);
      const sanitizedAfter = this.sanitizeData(params.afterDiff);

      await this.prisma.auditLog.create({
        data: {
          organizationId: params.organizationId,
          actorUserId: params.actorUserId || null,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          beforeDiff: sanitizedBefore as any,
          afterDiff: sanitizedAfter as any,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
        },
      });
    } catch (error) {
      // Audit log failures should be logged but not crash user-facing transactions
      this.logger.error(
        `Failed to record audit log for action ${params.action} on ${params.entityType}:${params.entityId}`,
        error,
      );
    }
  }

  /**
   * Recursively strips sensitive fields (passwords, tokens, keys) from diff objects.
   */
  private sanitizeData(data: Record<string, any> | null | undefined): Record<string, any> | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const sensitiveKeys = [
      'password',
      'passwordhash',
      'password_hash',
      'token',
      'refreshtoken',
      'refresh_token',
      'secret',
      'apikey',
      'api_key',
      'authorization',
      'cookie',
    ];

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
        sanitized[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
