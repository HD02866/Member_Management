import { Logger } from '@nestjs/common';
import { PaymentProviderException } from './provider-errors';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  maxDelayMs?: number;
}

const defaultOptions: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 200,
  backoffFactor: 2,
  maxDelayMs: 3000,
};

export async function executeWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
  logger?: Logger,
): Promise<T> {
  const config = { ...defaultOptions, ...options };
  let currentDelay = config.initialDelayMs;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation(attempt);
    } catch (error: any) {
      // Determine if error is retryable
      const isRetryable =
        error instanceof PaymentProviderException
          ? error.isRetryable
          : error?.code === 'ETIMEDOUT' ||
            error?.code === 'ECONNRESET' ||
            error?.code === 'ENOTFOUND' ||
            error?.name === 'TimeoutError' ||
            (error?.status >= 500 && error?.status < 600) ||
            error?.status === 429;

      if (!isRetryable || attempt >= config.maxRetries) {
        if (logger) {
          logger.warn(
            `Operation failed permanently on attempt ${attempt}/${config.maxRetries}: ${error?.message}`,
          );
        }
        throw error;
      }

      // Add jitter to delay (±20%)
      const jitter = currentDelay * 0.2 * (Math.random() * 2 - 1);
      const delayWithJitter = Math.min(
        config.maxDelayMs,
        Math.max(50, Math.round(currentDelay + jitter)),
      );

      if (logger) {
        logger.warn(
          `Operation failed on attempt ${attempt}/${config.maxRetries} (retrying in ${delayWithJitter}ms): ${error?.message}`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, delayWithJitter));
      currentDelay = Math.min(config.maxDelayMs, currentDelay * config.backoffFactor);
    }
  }

  throw new Error('Unexpected retry loop exit');
}
