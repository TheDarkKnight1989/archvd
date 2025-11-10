/**
 * Alias (GOAT) API Base Client
 * Handles authentication, rate limiting, retries, and error handling
 */

import { logger } from '@/lib/logger';
import type {
  GoatApiConfig,
  GoatApiError,
  GoatApiResponse,
  GoatAuthCredentials,
  GoatAuthResponse,
  GoatRefreshTokenParams,
} from './types';

// ============================================================================
// Error Classes
// ============================================================================

export class GoatApiException extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'GoatApiException';
  }
}

export class GoatAuthException extends GoatApiException {
  constructor(message: string, details?: any) {
    super(401, 'AUTH_ERROR', message, details);
    this.name = 'GoatAuthException';
  }
}

export class GoatRateLimitException extends GoatApiException {
  constructor(public retryAfter: number) {
    super(429, 'RATE_LIMIT', `Rate limit exceeded. Retry after ${retryAfter}s`);
    this.name = 'GoatRateLimitException';
  }
}

export class GoatValidationException extends GoatApiException {
  constructor(message: string, public validationErrors: any) {
    super(400, 'VALIDATION_ERROR', message, validationErrors);
    this.name = 'GoatValidationException';
  }
}

// ============================================================================
// Base Client
// ============================================================================

export class GoatClient {
  private config: Required<GoatApiConfig>;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(config: GoatApiConfig) {
    this.config = {
      apiUrl: config.apiUrl || 'https://www.goat.com/api/v1',
      accessToken: config.accessToken || '',
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
    };

    this.accessToken = config.accessToken || null;
  }

  // ==========================================================================
  // Authentication
  // ==========================================================================

  /**
   * Authenticate with email/password and obtain access token
   */
  async authenticate(credentials: GoatAuthCredentials): Promise<GoatAuthResponse> {
    const response = await this.rawRequest<GoatAuthResponse>(
      'POST',
      '/auth/login',
      credentials,
      { skipAuth: true }
    );

    this.accessToken = response.accessToken;
    this.refreshToken = response.refreshToken;
    this.tokenExpiresAt = new Date(response.expiresAt);

    logger.info('[GOAT] Authentication successful', {
      userId: response.user.id,
      expiresAt: response.expiresAt,
    });

    return response;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(params: GoatRefreshTokenParams): Promise<GoatAuthResponse> {
    const response = await this.rawRequest<GoatAuthResponse>(
      'POST',
      '/auth/refresh',
      params,
      { skipAuth: true }
    );

    this.accessToken = response.accessToken;
    this.refreshToken = response.refreshToken;
    this.tokenExpiresAt = new Date(response.expiresAt);

    logger.info('[GOAT] Access token refreshed', {
      expiresAt: response.expiresAt,
    });

    return response;
  }

  /**
   * Set access token manually (for use with stored tokens)
   */
  setAccessToken(token: string, expiresAt?: string): void {
    this.accessToken = token;
    if (expiresAt) {
      this.tokenExpiresAt = new Date(expiresAt);
    }
  }

  /**
   * Check if current token is expired or about to expire (within 5 minutes)
   */
  isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) return true;
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    return this.tokenExpiresAt < fiveMinutesFromNow;
  }

  // ==========================================================================
  // Request Methods
  // ==========================================================================

  /**
   * Make authenticated API request with automatic retry and error handling
   */
  async request<T>(
    method: string,
    endpoint: string,
    data?: any,
    options?: {
      params?: Record<string, string | number | boolean>;
      headers?: Record<string, string>;
    }
  ): Promise<T> {
    return this.requestWithRetry<T>(method, endpoint, data, options, this.config.retries);
  }

  /**
   * Internal request method with retry logic
   */
  private async requestWithRetry<T>(
    method: string,
    endpoint: string,
    data?: any,
    options?: {
      params?: Record<string, string | number | boolean>;
      headers?: Record<string, string>;
    },
    retriesLeft: number = this.config.retries
  ): Promise<T> {
    try {
      // Auto-refresh token if expired
      if (this.isTokenExpired() && this.refreshToken) {
        await this.refreshAccessToken({ refreshToken: this.refreshToken });
      }

      return await this.rawRequest<T>(method, endpoint, data, options);
    } catch (error) {
      if (error instanceof GoatRateLimitException) {
        // Rate limit: wait and retry
        if (retriesLeft > 0) {
          logger.warn('[GOAT] Rate limited, waiting before retry', {
            endpoint,
            retryAfter: error.retryAfter,
            retriesLeft,
          });

          await this.sleep(error.retryAfter * 1000);
          return this.requestWithRetry<T>(method, endpoint, data, options, retriesLeft - 1);
        }
        throw error;
      }

      if (error instanceof GoatAuthException) {
        // Auth error: try to refresh token once
        if (retriesLeft === this.config.retries && this.refreshToken) {
          logger.warn('[GOAT] Auth error, attempting token refresh', { endpoint });
          await this.refreshAccessToken({ refreshToken: this.refreshToken });
          return this.requestWithRetry<T>(method, endpoint, data, options, retriesLeft - 1);
        }
        throw error;
      }

      if (this.isRetryableError(error)) {
        // Server error or network issue: exponential backoff
        if (retriesLeft > 0) {
          const backoffMs = 2 ** (this.config.retries - retriesLeft) * 1000;
          logger.warn('[GOAT] Retryable error, backing off', {
            endpoint,
            error: error instanceof Error ? error.message : 'Unknown',
            backoffMs,
            retriesLeft,
          });

          await this.sleep(backoffMs);
          return this.requestWithRetry<T>(method, endpoint, data, options, retriesLeft - 1);
        }
      }

      throw error;
    }
  }

  /**
   * Raw HTTP request without retry logic
   */
  private async rawRequest<T>(
    method: string,
    endpoint: string,
    data?: any,
    options?: {
      params?: Record<string, string | number | boolean>;
      headers?: Record<string, string>;
      skipAuth?: boolean;
    }
  ): Promise<T> {
    const startTime = Date.now();

    // Build URL with query params
    const url = new URL(endpoint, this.config.apiUrl);
    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ArchVD/1.0',
      ...options?.headers,
    };

    if (!options?.skipAuth && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    // Make request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      const duration = Date.now() - startTime;

      // Handle errors
      if (!response.ok) {
        return this.handleErrorResponse(response.status, responseText, endpoint);
      }

      // Parse response
      const responseData = responseText ? JSON.parse(responseText) : null;

      // Log request
      logger.apiRequest('[GOAT]', { method, endpoint }, duration, {
        status: response.status,
        dataSize: responseText.length,
      });

      return responseData;
    } catch (error) {
      clearTimeout(timeoutId);

      if ((error as Error).name === 'AbortError') {
        logger.error('[GOAT] Request timeout', { endpoint, timeout: this.config.timeout });
        throw new GoatApiException(
          408,
          'TIMEOUT',
          `Request to ${endpoint} timed out after ${this.config.timeout}ms`
        );
      }

      throw error;
    }
  }

  /**
   * Handle error response and throw appropriate exception
   */
  private handleErrorResponse(status: number, body: string, endpoint: string): never {
    let errorData: any;
    try {
      errorData = JSON.parse(body);
    } catch {
      errorData = { message: body };
    }

    const message = errorData.message || errorData.error || 'Unknown error';
    const code = errorData.code || `HTTP_${status}`;

    logger.error('[GOAT] API error', {
      endpoint,
      status,
      code,
      message,
      details: errorData,
    });

    switch (status) {
      case 401:
        throw new GoatAuthException(message, errorData);
      case 429:
        const retryAfter = parseInt(errorData.retryAfter || '60', 10);
        throw new GoatRateLimitException(retryAfter);
      case 400:
      case 422:
        throw new GoatValidationException(message, errorData.errors || errorData);
      default:
        throw new GoatApiException(status, code, message, errorData);
    }
  }

  /**
   * Check if error is retryable (5xx or network errors)
   */
  private isRetryableError(error: any): boolean {
    if (error instanceof GoatApiException) {
      return error.status >= 500;
    }
    // Network errors, timeouts
    return error.name === 'FetchError' || error.name === 'AbortError';
  }

  /**
   * Sleep utility for backoff/rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==========================================================================
  // Convenience Methods
  // ==========================================================================

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    return this.request<T>('GET', endpoint, undefined, { params });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>('POST', endpoint, data);
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>('PATCH', endpoint, data);
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>('PUT', endpoint, data);
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>('DELETE', endpoint);
  }
}

// ============================================================================
// Client Factory
// ============================================================================

/**
 * Create a GOAT client instance with default config
 */
export function createGoatClient(config?: Partial<GoatApiConfig>): GoatClient {
  const defaultConfig: GoatApiConfig = {
    apiUrl: process.env.GOAT_API_URL || 'https://www.goat.com/api/v1',
    accessToken: process.env.GOAT_ACCESS_TOKEN || '',
    timeout: 30000,
    retries: 3,
  };

  return new GoatClient({ ...defaultConfig, ...config });
}

/**
 * Create an authenticated GOAT client for a specific user
 * (retrieves token from database)
 */
export async function createUserGoatClient(userId: string): Promise<GoatClient> {
  // TODO: Fetch user's GOAT token from profiles table
  // const supabase = await createClient();
  // const { data: profile } = await supabase
  //   .from('profiles')
  //   .select('goat_access_token, goat_token_expires_at')
  //   .eq('id', userId)
  //   .single();

  // if (!profile?.goat_access_token) {
  //   throw new Error('User has not connected GOAT account');
  // }

  // const client = createGoatClient();
  // client.setAccessToken(profile.goat_access_token, profile.goat_token_expires_at);
  // return client;

  throw new Error('Not implemented: createUserGoatClient');
}
