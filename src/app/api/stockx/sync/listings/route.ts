/**
 * StockX Sync Listings
 * Fetches user's StockX listings and maps to inventory
 * POST /api/stockx/sync/listings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStockxClient } from '@/lib/services/stockx/client';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Check if StockX is enabled
    if (process.env.NEXT_PUBLIC_STOCKX_ENABLE !== 'true') {
      return NextResponse.json(
        { error: 'StockX integration is not enabled' },
        { status: 400 }
      );
    }

    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has connected StockX account
    const { data: account, error: accountError } = await supabase
      .from('stockx_accounts')
      .select('user_id')
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'StockX account not connected. Please connect your account first.' },
        { status: 401 }
      );
    }

    // Get user-specific StockX client (will auto-load and refresh tokens)
    const client = getStockxClient(user.id);

    // Fetch user's listings from StockX
    // Note: Adjust endpoint based on actual StockX API
    const listings = await client.request('/api/v1/users/me/listings', {
      method: 'GET',
    });

    if (!listings || !Array.isArray(listings.data)) {
      logger.warn('[StockX Sync Listings] No listings returned', { userId: user.id });
      return NextResponse.json({
        success: true,
        fetched: 0,
        mapped: 0,
        duration_ms: Date.now() - startTime,
      });
    }

    let fetchedCount = listings.data.length;
    let mappedCount = 0;
    let upsertedProducts = 0;

    // Process listings
    for (const listing of listings.data) {
      const {
        id: stockx_listing_id,
        sku,
        size,
        condition = 'new',
        asking_price_amount,
        currency = 'USD',
        product,
      } = listing;

      // Upsert product catalog if we have product details
      if (product) {
        const { error: productError } = await supabase
          .from('stockx_products')
          .upsert(
            {
              sku: product.sku || sku,
              title: product.title,
              brand: product.brand,
              model: product.model,
              colorway: product.colorway,
              release_date: product.release_date,
              retail_price: product.retail_price,
              retail_currency: product.retail_currency || currency,
              image_url: product.image_url,
              category: 'sneaker',
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'sku',
              ignoreDuplicates: false,
            }
          );

        if (!productError) {
          upsertedProducts++;
        }
      }

      // Map to inventory by SKU + size
      const { data: inventoryItems } = await supabase
        .from('Inventory')
        .select('id')
        .eq('sku', sku)
        .eq('size', size)
        .eq('user_id', user.id)
        .in('status', ['active', 'listed']);

      if (inventoryItems && inventoryItems.length > 0) {
        for (const item of inventoryItems) {
          // Create inventory_market_links
          const { error: linkError } = await supabase
            .from('inventory_market_links')
            .upsert(
              {
                inventory_id: item.id,
                provider: 'stockx',
                provider_product_sku: sku,
                provider_listing_id: stockx_listing_id,
                updated_at: new Date().toISOString(),
              },
              {
                onConflict: 'inventory_id,provider',
                ignoreDuplicates: false,
              }
            );

          if (!linkError) {
            mappedCount++;
          }
        }
      }
    }

    const duration = Date.now() - startTime;

    logger.apiRequest(
      '/api/stockx/sync/listings',
      { userId: user.id },
      duration,
      {
        fetched: fetchedCount,
        mapped: mappedCount,
        upsertedProducts,
      }
    );

    return NextResponse.json({
      success: true,
      fetched: fetchedCount,
      mapped: mappedCount,
      upsertedProducts,
      duration_ms: duration,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    // Handle 429 rate limiting
    if (error.message?.includes('429')) {
      logger.warn('[StockX Sync Listings] Rate limited', {
        duration,
        error: error.message,
      });

      return NextResponse.json(
        {
          error: 'Rate limited by StockX. Please try again later.',
          retry_after: 60, // seconds
        },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
          },
        }
      );
    }

    logger.error('[StockX Sync Listings] Error', {
      message: error.message,
      stack: error.stack,
      duration,
    });

    return NextResponse.json(
      { error: 'Failed to sync StockX listings', details: error.message },
      { status: 500 }
    );
  }
}
