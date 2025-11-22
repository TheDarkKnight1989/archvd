/**
 * Retry Wrapper for StockX Services
 * Phase 2.9 - Reliability & Monitoring
 *
 * WHY: Add resilient retry logic to StockX API calls
 * - Retries on network/5xx/429 errors
 * - No retry on 4xx (except 429)
 * - Exponential backoff
 */

interface RetryOptions {
  maxAttempts?: number
  baseDelayMs?: number
  label?: string
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  label: 'StockX API call',
}

/**
 * Check if error is retryable
 * Retry on: network errors, 5xx, 429
 * Don't retry: 4xx (except 429)
 */
function isRetryableError(error: any): boolean {
  const message = error.message || ''

  // Network errors (ECONNREFUSED, ENOTFOUND, etc.)
  if (message.includes('ECONNREFUSED') ||
      message.includes('ENOTFOUND') ||
      message.includes('ETIMEDOUT') ||
      message.includes('network') ||
      message.includes('Network')) {
    return true
  }

  // Rate limiting (429)
  if (message.includes('429') || message.includes('rate limit')) {
    return true
  }

  // Server errors (5xx)
  if (message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')) {
    return true
  }

  // Client errors (4xx) - do NOT retry
  if (message.includes('400') ||
      message.includes('401') ||
      message.includes('403') ||
      message.includes('404')) {
    return false
  }

  // Unknown errors - retry to be safe
  return true
}

/**
 * Exponential backoff delay
 */
function getBackoffDelay(attemptNumber: number, baseDelayMs: number): number {
  return baseDelayMs * attemptNumber
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry wrapper for StockX API calls
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @returns Result of successful fn() execution
 * @throws Error if all retry attempts fail
 *
 * @example
 * const result = await withStockxRetry(
 *   () => client.request('/v2/catalog/search?query=Nike'),
 *   { maxAttempts: 3, label: 'Search Nike' }
 * )
 */
export async function withStockxRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options }
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      // Attempt the function
      const result = await fn()

      // Success - log if it took multiple attempts
      if (attempt > 1) {
        console.log(
          `[StockX Retry] ${config.label} succeeded on attempt ${attempt}/${config.maxAttempts}`
        )
      }

      return result

    } catch (error: any) {
      lastError = error

      // Check if error is retryable
      const retryable = isRetryableError(error)

      // Log attempt failure
      console.warn(
        `[StockX Retry] ${config.label} failed (attempt ${attempt}/${config.maxAttempts}):`,
        {
          error: error.message,
          retryable,
          willRetry: retryable && attempt < config.maxAttempts,
        }
      )

      // If not retryable or last attempt, throw immediately
      if (!retryable || attempt >= config.maxAttempts) {
        throw new Error(
          `[StockX Retry] ${config.label} failed after ${attempt} attempt(s): ${error.message}`
        )
      }

      // Calculate backoff delay
      const delayMs = getBackoffDelay(attempt, config.baseDelayMs)
      console.log(`[StockX Retry] Waiting ${delayMs}ms before retry ${attempt + 1}...`)

      // Wait before retrying
      await sleep(delayMs)
    }
  }

  // This should never be reached, but TypeScript requires it
  throw new Error(
    `[StockX Retry] ${config.label} failed after ${config.maxAttempts} attempts: ${lastError?.message || 'Unknown error'}`
  )
}
