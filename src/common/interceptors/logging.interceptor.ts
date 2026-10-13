import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { CORRELATION_ID_HEADER } from '../middleware/correlation-id.middleware';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const startTime = Date.now();
    const method = req.method;
    const url = req.originalUrl || req.url;
    const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || 'none';
    const tenantId = req.tenant?.organizationId || 'global';
    const userId = (req.user as any)?.id || 'anonymous';

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = res.statusCode;
          this.logger.log(
            `[${correlationId}] ${method} ${url} ${statusCode} - ${duration}ms [tenant:${tenantId} user:${userId}]`,
          );
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          const statusCode = err.status || 500;
          this.logger.warn(
            `[${correlationId}] ${method} ${url} ${statusCode} - ${duration}ms [tenant:${tenantId} user:${userId}] - ${err.message}`,
          );
        },
      }),
    );
  }
}
