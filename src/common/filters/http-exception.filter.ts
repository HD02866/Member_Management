import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CORRELATION_ID_HEADER } from '../middleware/correlation-id.middleware';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId = (request.headers[CORRELATION_ID_HEADER] as string) || 'none';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        message = resObj.message || exception.message;
        error = resObj.error || exception.name;
      }
    } else if (exception instanceof Error) {
      const errStatus = (exception as any).status || (exception as any).statusCode;
      if (errStatus && typeof errStatus === 'number') {
        status = errStatus;
        if (errStatus === HttpStatus.BAD_REQUEST || exception.name === 'SyntaxError') {
          message = 'Malformed JSON payload';
          error = 'BadRequest';
        } else {
          message = exception.message;
          error = exception.name;
        }
      } else {
        // Don't leak raw database or internal code stack traces in production
        this.logger.error(`[${correlationId}] Unhandled Exception: ${exception.message}`, exception.stack);
        if (process.env.NODE_ENV === 'development') {
          message = exception.message;
          error = exception.name;
        } else {
          message = 'An unexpected error occurred. Please contact system support.';
          error = 'InternalServerError';
        }
      }
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      error,
      meta: {
        timestamp: new Date().toISOString(),
        path: request.originalUrl || request.url,
        correlationId,
      },
    });
  }
}
