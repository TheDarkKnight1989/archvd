/**
 * Alias Catalog Search API Route
 * Search the Alias catalog by SKU, product name, or brand
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAliasClient } from '@/lib/services/alias';
import { AliasAPIError, AliasAuthenticationError } from '@/lib/services/alias/errors';

export const dynamic = 'force-dynamic';

/**
 * Search Alias catalog
 * GET /api/alias/search?query=Air+Jordan&limit=10&pagination_token=xyz
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    const limit = searchParams.get('limit');
    const paginationToken = searchParams.get('pagination_token');

    // Validate required parameters
    if (!query || query.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'Query parameter is required',
        },
        { status: 400 }
      );
    }

    // Create Alias client
    const client = createAliasClient();

    // Search catalog
    const response = await client.searchCatalog(
      query.trim(),
      {
        limit: limit ? parseInt(limit, 10) : undefined,
        pagination_token: paginationToken || undefined,
      }
    );

    // Return formatted response
    return NextResponse.json({
      success: true,
      items: response.catalog_items,
      hasMore: response.has_more,
      nextToken: response.next_pagination_token,
      count: response.catalog_items.length,
    });

  } catch (error) {
    console.error('[Alias Search] Error:', error);

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
      return NextResponse.json(
        {
          success: false,
          error: 'Alias API Error',
          message: error.message,
          statusCode: error.statusCode,
          userMessage: error.getUserMessage(),
        },
        { status: error.statusCode }
      );
    }

    // Unknown error
    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
