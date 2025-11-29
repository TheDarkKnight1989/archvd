/**
 * Alias API Test Endpoint
 * Verifies PAT connectivity and API access
 */

import { NextResponse } from 'next/server';
import { createAliasClient } from '@/lib/services/alias';
import { AliasAPIError, AliasAuthenticationError } from '@/lib/services/alias/errors';

export const dynamic = 'force-dynamic';

/**
 * Test Alias API connectivity
 * GET /api/alias/test
 */
export async function GET() {
  try {
    // Create client (will throw if ALIAS_PAT is not set)
    const client = createAliasClient();

    // Test the connection
    const response = await client.test();

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'Alias API connection successful',
        timestamp: new Date().toISOString(),
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Alias API test returned unexpected response',
          response,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Alias API test error:', error);

    if (error instanceof AliasAuthenticationError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication Error',
          message: error.message,
          hint: 'Check that ALIAS_PAT environment variable is set correctly',
        },
        { status: 401 }
      );
    }

    if (error instanceof AliasAPIError) {
      console.error('[Alias Test] Alias API Error details:', {
        endpoint: error.endpoint,
        statusCode: error.statusCode,
        message: error.message,
        responseBody: error.responseBody,
        apiError: error.apiError,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Alias API Error',
          message: error.message,
          statusCode: error.statusCode,
          endpoint: error.endpoint,
          aliasError: error.apiError,
          responseBody: error.responseBody,
          isAuthError: error.isAuthError(),
          isRateLimitError: error.isRateLimitError(),
        },
        { status: error.statusCode }
      );
    }

    // Unknown error
    return NextResponse.json(
      {
        success: false,
        error: 'Unknown Error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
