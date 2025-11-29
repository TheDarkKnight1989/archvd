/**
 * Alias Create Listing API Route
 * Create a new listing on Alias marketplace
 *
 * ⚠️ MANUAL CREATION ONLY - User must explicitly create each listing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAliasClient, createAliasListing } from '@/lib/services/alias';
import { AliasAPIError, AliasAuthenticationError } from '@/lib/services/alias/errors';

export const dynamic = 'force-dynamic';

/**
 * Create a new Alias listing
 * POST /api/alias/listings/create
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = [
      'catalog_id',
      'price_cents',
      'size',
      'size_unit',
      'condition',
      'packaging_condition',
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          {
            success: false,
            error: `Missing required field: ${field}`,
          },
          { status: 400 }
        );
      }
    }

    // Validate price (must be whole dollars)
    if (body.price_cents % 100 !== 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Price must be in whole dollar increments (e.g., 25000 for $250.00)',
        },
        { status: 400 }
      );
    }

    // Get authenticated user
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

    // Log listing data
    console.log('[Alias Create Listing] Request body:', {
      catalog_id: body.catalog_id,
      price_cents: body.price_cents,
      size: body.size,
      size_unit: body.size_unit,
      condition: body.condition,
      packaging_condition: body.packaging_condition,
      activate: body.activate || false,
      inventory_id: body.inventory_id,
    });

    // Create listing
    const result = await createAliasListing(client, {
      user_id: user.id,
      catalog_id: body.catalog_id,
      price_cents: body.price_cents,
      size: body.size,
      size_unit: body.size_unit,
      condition: body.condition,
      packaging_condition: body.packaging_condition,
      activate: body.activate || false, // Default to inactive
      inventory_id: body.inventory_id, // Optional
      metadata: body.metadata,
      defects: body.defects,
      additional_defects: body.additional_defects,
    });

    if (!result.success) {
      console.error('[Alias Create Listing] Service returned error:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      listing: result.listing,
      message: result.listing?.status === 'LISTING_STATUS_ACTIVE'
        ? 'Listing created and activated'
        : 'Listing created (inactive)',
    });

  } catch (error) {
    console.error('[Alias Create Listing] Error:', error);

    if (error instanceof AliasAuthenticationError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Alias API authentication failed',
          message: error.message,
        },
        { status: 401 }
      );
    }

    if (error instanceof AliasAPIError) {
      console.error('[Alias Create Listing] Alias API Error details:', {
        message: error.message,
        statusCode: error.statusCode,
        userMessage: error.getUserMessage(),
        apiError: error.apiError,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Alias API Error',
          message: error.getUserMessage(),
          statusCode: error.statusCode,
          details: error.apiError,
        },
        { status: error.statusCode }
      );
    }

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
