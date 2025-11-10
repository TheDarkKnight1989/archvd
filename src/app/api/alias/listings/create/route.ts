/**
 * Alias Create Listing API
 * POST /api/alias/listings/create
 * Creates a new listing on Alias (GOAT)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAliasEnabled, isAliasMockMode } from '@/lib/config/alias';
import { logger } from '@/lib/logger';

interface CreateListingRequest {
  inventoryId: string;
  sku: string;
  size: string;
  price: number;
  currency?: string;
  condition?: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Check feature flag
    if (!isAliasEnabled()) {
      return NextResponse.json(
        {
          error: 'Not Implemented',
          message: 'Alias integration is not enabled',
          code: 'ALIAS_DISABLED',
        },
        { status: 501 }
      );
    }

    // 2. Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Parse request body
    const body: CreateListingRequest = await request.json();
    const { inventoryId, sku, size, price, currency = 'GBP', condition = 'New' } = body;

    if (!inventoryId || !sku || !size || !price) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Missing required fields: inventoryId, sku, size, price',
        },
        { status: 400 }
      );
    }

    // 4. Check if mock mode is enabled
    if (isAliasMockMode()) {
      logger.info('[API /alias/listings/create] Mock mode active - creating mock listing', {
        inventoryId,
        sku,
        size,
        price,
      });

      // Generate mock listing ID
      const mockListingId = `mock-listing-${Date.now()}`;
      const mockProductId = `mock-prod-${sku.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;

      // Create mock listing in database
      const mockListing = {
        user_id: user.id,
        alias_account_id: null, // No real account in mock mode
        alias_listing_id: mockListingId,
        alias_product_id: mockProductId,
        sku,
        size,
        condition,
        ask_price: price,
        currency,
        status: 'active',
        quantity: 1,
        views: 0,
        favorites: 0,
        listed_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
      };

      // Insert to database
      const { data: listing, error: insertError } = await supabase
        .from('alias_listings')
        .insert(mockListing)
        .select()
        .single();

      if (insertError) {
        logger.error('[API /alias/listings/create] Mock insert failed', {
          error: insertError.message,
        });
        throw insertError;
      }

      // Create inventory link
      const { error: linkError } = await supabase
        .from('inventory_alias_links')
        .insert({
          inventory_id: inventoryId,
          alias_listing_id: listing.id,
          inventory_purchase_price: null, // Will be fetched from inventory
          alias_ask_price: price,
        });

      if (linkError) {
        logger.warn('[API /alias/listings/create] Failed to create inventory link', {
          error: linkError.message,
        });
        // Non-fatal - listing was created
      }

      const duration = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        listing: {
          id: listing.alias_listing_id,
          sku,
          size,
          price,
          currency,
          status: 'active',
          listedAt: listing.listed_at,
        },
        _meta: {
          duration_ms: duration,
          source: 'alias_mock',
          mode: 'mock',
        },
      });
    }

    // 5. Live mode (not yet implemented)
    return NextResponse.json(
      {
        error: 'Not Implemented',
        message: 'Live mode listing creation not yet implemented',
        code: 'ALIAS_LIVE_NOT_IMPLEMENTED',
      },
      { status: 501 }
    );
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('[API /alias/listings/create] Error', {
      error: error.message,
      stack: error.stack,
      duration,
    });

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error.message || 'Failed to create listing',
      },
      { status: 500 }
    );
  }
}
