/**
 * Alias Update Listing API Route
 * Update an existing listing on Alias marketplace
 *
 * ⚠️ MANUAL UPDATE ONLY - User must explicitly update each listing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAliasClient, updateAliasListing } from '@/lib/services/alias';
import { AliasAPIError, AliasAuthenticationError } from '@/lib/services/alias/errors';

export const dynamic = 'force-dynamic';

/**
 * Update an existing Alias listing
 * PATCH /api/alias/listings/[listingId]/update
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  try {
    const { listingId } = await params;
    const body = await request.json();

    // Validate price if provided (must be whole dollars)
    if (body.price_cents !== undefined && body.price_cents % 100 !== 0) {
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

    // Verify listing belongs to user
    const { data: existingListing, error: fetchError } = await supabase
      .from('alias_listings')
      .select('*')
      .eq('listing_id', listingId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existingListing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Listing not found or access denied',
        },
        { status: 404 }
      );
    }

    // Create Alias client
    const client = createAliasClient();

    // Update listing
    const result = await updateAliasListing(client, listingId, user.id, {
      price_cents: body.price_cents,
      condition: body.condition,
      packaging_condition: body.packaging_condition,
      defects: body.defects,
      additional_defects: body.additional_defects,
    });

    if (!result.success) {
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
      message: 'Listing updated successfully',
    });

  } catch (error) {
    console.error('[Alias Update Listing] Error:', error);

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
      return NextResponse.json(
        {
          success: false,
          error: 'Alias API Error',
          message: error.getUserMessage(),
          statusCode: error.statusCode,
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
