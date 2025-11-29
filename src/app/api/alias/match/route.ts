/**
 * Alias SKU Matching API Route
 * Match inventory items to Alias catalog (suggest-only)
 *
 * ⚠️ SUGGEST-ONLY - Does NOT write to database automatically
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAliasClient, matchInventoryToAliasCatalog } from '@/lib/services/alias';

export const dynamic = 'force-dynamic';

/**
 * Match inventory item to Alias catalog
 * POST /api/alias/match
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.sku && !body.productName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Either SKU or product name is required',
        },
        { status: 400 }
      );
    }

    // Get authenticated user (for rate limiting)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }

    // Create Alias client
    const client = createAliasClient();

    // Match item (suggest-only, no database writes)
    const result = await matchInventoryToAliasCatalog(client, {
      sku: body.sku,
      productName: body.productName,
      brand: body.brand,
    });

    return NextResponse.json({
      success: true,
      catalogId: result.catalogId,
      confidence: result.confidence,
      catalogItem: result.catalogItem,
      matchMethod: result.matchMethod,
      searchResults: result.searchResults,
    });

  } catch (error) {
    console.error('[Alias Match] Error:', error);

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
