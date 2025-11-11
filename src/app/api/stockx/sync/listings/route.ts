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

    logger.info('[StockX Sync Listings] Starting sync', {
      userId: user.id,
      endpoint: '/v2/selling/listings?pageSize=100',
    });

    // Fetch user's listings from StockX (v2 API)
    const response = await client.request('/v2/selling/listings?pageSize=100');

    if (!response || !Array.isArray(response.listings)) {
      logger.warn('[StockX Sync Listings] No listings returned', { userId: user.id });
      return NextResponse.json({
        success: true,
        fetched: 0,
        mapped: 0,
        duration_ms: Date.now() - startTime,
      });
    }

    const listings = response.listings;
    let fetchedCount = listings.length;
    let mappedCount = 0;
    let upsertedProducts = 0;

    // Process listings
    for (const listing of listings) {
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
        // Generate slug from SKU
        const productSku = product.sku || sku;
        const slug = productSku.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        const { error: productError } = await supabase
          .from('stockx_products')
          .upsert(
            {
              sku: productSku,
              slug: slug,
              name: product.title || product.name || `${product.brand} ${product.model}`,
              brand: product.brand || 'Unknown',
              model: product.model,
              colorway: product.colorway,
              release_date: product.release_date,
              retail_price: product.retail_price,
              image_url: product.image_url,
              meta: {
                retail_currency: product.retail_currency || currency,
                category: 'sneaker',
              },
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'sku',
              ignoreDuplicates: false,
            }
          );

        if (productError) {
          logger.error('[StockX Sync Listings] Product upsert error', {
            sku: productSku,
            error: productError.message,
          });
        } else {
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

    // Handle 401 authentication errors
    if (error.message?.includes('401')) {
      logger.error('[StockX Sync Listings] Authentication failed', {
        message: error.message,
        duration,
      });

      return NextResponse.json(
        {
          error: 'StockX authentication failed',
          details: 'Your StockX access token may have expired. Please try disconnecting and reconnecting your StockX account.',
        },
        { status: 401 }
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
