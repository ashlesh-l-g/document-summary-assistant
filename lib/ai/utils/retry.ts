import {
  AIAuthenticationError,
  AIConfigurationError,
  AIResponseValidationError,
  AIRateLimitError,
  AIProviderError,
} from '@/types/errors';

export interface RetryOptions {
  readonly maxRetries?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 10000;

/**
 * Determine if an error is transient and safe to retry
 */
export function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  // Never retry authentication or configuration errors
  if (
    error instanceof AIAuthenticationError ||
    error instanceof AIConfigurationError ||
    error instanceof AIResponseValidationError
  ) {
    return false;
  }

  // Rate limits are retryable
  if (error instanceof AIRateLimitError) {
    return true;
  }

  // Check AIProviderError status and retryable flag
  if (error instanceof AIProviderError) {
    if (error.isRetryable) return true;
    if (error.statusCode) {
      // 429 Rate limit, 408 Timeout, 500 Internal, 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout
      return [408, 429, 500, 502, 503, 504].includes(error.statusCode);
    }
  }

  // Network / fetch failures
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // Generic transient server error strings
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (
    message.includes('rate limit') ||
    message.includes('quota exceeded') ||
    message.includes('429') ||
    message.includes('503') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('network error')
  ) {
    return true;
  }

  return false;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  rateLimitSeconds?: number
): number {
  if (typeof rateLimitSeconds === 'number' && rateLimitSeconds > 0) {
    return Math.min(rateLimitSeconds * 1000, maxDelayMs);
  }

  const exponential = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * (baseDelayMs * 0.5));
  return Math.min(exponential + jitter, maxDelayMs);
}

/**
 * Execute an asynchronous operation with bounded exponential backoff retries
 */
export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation(attempt);
    } catch (err: unknown) {
      lastError = err;

      if (attempt >= maxRetries || !isRetryableError(err)) {
        throw err;
      }

      const retryAfterSec = err instanceof AIRateLimitError ? err.retryAfterSeconds : undefined;
      const delayMs = calculateBackoffDelay(attempt, baseDelayMs, maxDelayMs, retryAfterSec);

      options?.onRetry?.(err, attempt + 1, delayMs);

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
