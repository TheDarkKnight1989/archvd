/**
 * Alias Pricing Insights API Route
 * LOCKED to NEW + GOOD_CONDITION only - no variant selection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAliasClient } from '@/lib/services/alias';
import { getStandardAliasPricingParams } from '@/lib/services/alias/sync';
import {
  AliasAPIError,
  AliasAuthenticationError,
  AliasPricingError,
} from '@/lib/services/alias/errors';

export const dynamic = 'force-dynamic';

/**
 * Get pricing insights for a specific size
 * LOCKED to NEW + GOOD_CONDITION only
 * GET /api/alias/pricing/[catalogId]?size=10.5&region_id=US&save_snapshot=true
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ catalogId: string }> }
) {
  try {
    const { catalogId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const sizeParam = searchParams.get('size');
    const regionId = searchParams.get('region_id') || undefined;
    const saveSnapshot = searchParams.get('save_snapshot') === 'true';

    // Size is required
    if (!sizeParam) {
      return NextResponse.json(
        {
          success: false,
          error: 'Size parameter is required',
        },
        { status: 400 }
      );
    }

    const size = parseFloat(sizeParam);
    if (isNaN(size)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid size parameter',
        },
        { status: 400 }
      );
    }

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

    // Get standard pricing params - LOCKED to NEW + GOOD_CONDITION
    const pricingParams = getStandardAliasPricingParams(catalogId.trim(), size, regionId);

    // Fetch pricing insights for this exact variant only
    const response = await client.getPricingInsights(pricingParams);

    // Optionally save snapshot to database
    if (saveSnapshot && response.availability) {
      try {
        const supabase = await createClient();
        const snapshotTime = new Date().toISOString();
        const currency = 'USD';

        const snapshot = {
          catalog_id: catalogId,
          size,
          currency,
          lowest_ask_cents: response.availability.lowest_listing_price_cents
            ? parseInt(response.availability.lowest_listing_price_cents, 10)
            : null,
          highest_bid_cents: response.availability.highest_offer_price_cents
            ? parseInt(response.availability.highest_offer_price_cents, 10)
            : null,
          last_sold_price_cents: response.availability.last_sold_listing_price_cents
            ? parseInt(response.availability.last_sold_listing_price_cents, 10)
            : null,
          global_indicator_price_cents: response.availability.global_indicator_price_cents
            ? parseInt(response.availability.global_indicator_price_cents, 10)
            : null,
          snapshot_at: snapshotTime,
        };

        // Insert snapshot
        const { error: insertError } = await supabase
          .from('alias_market_snapshots')
          .upsert([snapshot], {
            onConflict: 'catalog_id,size,currency,snapshot_at',
          });

        if (insertError) {
          console.error('[Alias Pricing] Failed to save snapshot:', insertError);
          // Don't fail the request, just log the error
        } else {
          console.log(`[Alias Pricing] Saved market snapshot for ${catalogId} size ${size}`);
        }
      } catch (dbError) {
        console.error('[Alias Pricing] Database error:', dbError);
        // Don't fail the request, just log the error
      }
    }

    // Return formatted response
    return NextResponse.json({
      success: true,
      availability: response.availability,
      snapshotSaved: saveSnapshot,
    });

  } catch (error) {
    console.error('[Alias Pricing] Error:', error);

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

    if (error instanceof AliasPricingError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pricing Data Error',
          message: error.message,
          statusCode: error.statusCode,
          userMessage: error.getUserMessage(),
        },
        { status: error.statusCode }
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
