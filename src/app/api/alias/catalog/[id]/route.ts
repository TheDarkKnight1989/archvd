/**
 * Alias Get Catalog Item API Route
 * Fetch details for a specific catalog item by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAliasClient } from '@/lib/services/alias';
import {
  AliasAPIError,
  AliasAuthenticationError,
  AliasCatalogNotFoundError,
} from '@/lib/services/alias/errors';

export const dynamic = 'force-dynamic';

/**
 * Get catalog item by ID
 * GET /api/alias/catalog/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: catalogId } = await params;

    // Validate catalog ID
    if (!catalogId || catalogId.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'Catalog ID is required',
        },
        { status: 400 }
      );
    }

    // Create Alias client
    const client = createAliasClient();

    // Fetch catalog item
    const response = await client.getCatalogItem(catalogId.trim());

    // Return formatted response
    return NextResponse.json({
      success: true,
      item: response.catalog_item,
    });

  } catch (error) {
    console.error('[Alias Catalog] Error:', error);

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

    if (error instanceof AliasCatalogNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Catalog Item Not Found',
          message: error.message,
          catalogId: error.catalogId,
        },
        { status: 404 }
      );
    }

    if (error instanceof AliasAPIError) {
      console.error('[Alias Catalog] Alias API Error details:', {
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
