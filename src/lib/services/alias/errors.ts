/**
 * Alias API Error Handling
 */

import type { AliasError } from './types';

export class AliasAPIError extends Error {
  public readonly statusCode: number;
  public readonly apiError?: AliasError;
  public readonly response?: Response;
  public readonly endpoint?: string;
  public readonly responseBody?: string;

  constructor(
    message: string,
    statusCode: number,
    apiError?: AliasError,
    response?: Response,
    endpoint?: string,
    responseBody?: string
  ) {
    super(message);
    this.name = 'AliasAPIError';
    this.statusCode = statusCode;
    this.apiError = apiError;
    this.response = response;
    this.endpoint = endpoint;
    this.responseBody = responseBody;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AliasAPIError);
    }
  }

  /**
   * Creates an AliasAPIError from a fetch Response
   */
  static async fromResponse(response: Response): Promise<AliasAPIError> {
    let apiError: AliasError | undefined;
    let message = `Alias API error: ${response.status} ${response.statusText}`;

    try {
      const errorData = await response.json();
      apiError = errorData as AliasError;
      if (apiError.message) {
        message = apiError.message;
      }
    } catch {
      // Failed to parse error response, use default message
    }

    return new AliasAPIError(message, response.status, apiError, response);
  }

  /**
   * Check if error is due to authentication failure
   */
  isAuthError(): boolean {
    return this.statusCode === 401 || this.statusCode === 403;
  }

  /**
   * Check if error is due to rate limiting
   */
  isRateLimitError(): boolean {
    return this.statusCode === 429;
  }

  /**
   * Check if error is due to resource not found
   */
  isNotFoundError(): boolean {
    return this.statusCode === 404;
  }

  /**
   * Check if error is a server error (5xx)
   */
  isServerError(): boolean {
    return this.statusCode >= 500 && this.statusCode < 600;
  }

  /**
   * Check if error is a client error (4xx)
   */
  isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500;
  }

  /**
   * Get a user-friendly error message
   */
  getUserMessage(): string {
    if (this.isAuthError()) {
      return 'Authentication failed. Please check your Alias credentials.';
    }
    if (this.isRateLimitError()) {
      return 'Rate limit exceeded. Please try again later.';
    }
    if (this.isNotFoundError()) {
      return 'The requested resource was not found.';
    }
    if (this.isServerError()) {
      return 'Alias service is temporarily unavailable. Please try again later.';
    }
    return this.message;
  }
}

/**
 * Error thrown when PAT token is missing or invalid
 */
export class AliasAuthenticationError extends Error {
  constructor(message = 'Alias PAT token is missing or invalid') {
    super(message);
    this.name = 'AliasAuthenticationError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AliasAuthenticationError);
    }
  }
}

/**
 * Error thrown when catalog item is not found
 */
export class AliasCatalogNotFoundError extends AliasAPIError {
  public readonly catalogId: string;

  constructor(catalogId: string) {
    super(
      `Catalog item not found: ${catalogId}`,
      404,
      {
        code: 404,
        message: 'Catalog item not found',
      }
    );
    this.name = 'AliasCatalogNotFoundError';
    this.catalogId = catalogId;
  }
}

/**
 * Error thrown when listing operation fails
 */
export class AliasListingError extends AliasAPIError {
  constructor(
    message: string,
    statusCode: number,
    apiError?: AliasError
  ) {
    super(message, statusCode, apiError);
    this.name = 'AliasListingError';
  }
}

/**
 * Error thrown when pricing data is unavailable
 */
export class AliasPricingError extends AliasAPIError {
  constructor(
    message: string,
    statusCode: number,
    apiError?: AliasError
  ) {
    super(message, statusCode, apiError);
    this.name = 'AliasPricingError';
  }
}
