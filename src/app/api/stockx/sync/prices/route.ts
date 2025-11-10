/**
 * StockX Sync Prices
 * Fetches latest market prices for owned SKUs and sizes
 * POST /api/stockx/sync/prices
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

    // Get user-specific StockX client
    const client = getStockxClient(user.id);

    // Fetch distinct (SKU, size) pairs from user's inventory
    const { data: inventoryItems, error: inventoryError } = await supabase
      .from('Inventory')
      .select('sku, size')
      .eq('user_id', user.id)
      .eq('category', 'sneaker')
      .in('status', ['active', 'listed', 'worn']);

    if (inventoryError || !inventoryItems || inventoryItems.length === 0) {
      logger.warn('[StockX Sync Prices] No inventory items found', { userId: user.id });
      return NextResponse.json({
        success: true,
        processed: 0,
        upserted: 0,
        skipped: 0,
        duration_ms: Date.now() - startTime,
      });
    }

    // Get unique (sku, size) combinations
    const uniquePairs = new Map<string, { sku: string; size: string }>();
    inventoryItems.forEach((item) => {
      const key = `${item.sku}:${item.size}`;
      if (!uniquePairs.has(key)) {
        uniquePairs.set(key, { sku: item.sku, size: item.size });
      }
    });

    const pairs = Array.from(uniquePairs.values());
    let processedCount = 0;
    let upsertedCount = 0;
    let skippedCount = 0;

    // Fetch prices for each (SKU, size) pair
    for (const { sku, size } of pairs) {
      try {
        // Note: Adjust endpoint based on actual StockX API
        // Example: GET /api/v1/products/{sku}/market-data?size={size}
        const marketData = await client.request(
          `/api/v1/products/${encodeURIComponent(sku)}/market-data?size=${encodeURIComponent(size)}`,
          {
            method: 'GET',
          }
        );

        processedCount++;

        if (!marketData || !marketData.data) {
          skippedCount++;
          continue;
        }

        const {
          lowest_ask,
          highest_bid,
          last_sale,
          currency = 'USD',
          as_of,
        } = marketData.data;

        // Upsert into stockx_market_prices
        const { error: priceError } = await supabase
          .from('stockx_market_prices')
          .insert({
            sku,
            size,
            currency,
            lowest_ask,
            highest_bid,
            last_sale,
            as_of: as_of || new Date().toISOString(),
            source: 'stockx',
          });

        if (priceError) {
          logger.error('[StockX Sync Prices] Failed to insert price', {
            error: priceError.message,
            sku,
            size,
          });
          skippedCount++;
        } else {
          upsertedCount++;
        }

        // Small delay to avoid rate limiting (100ms between requests)
        await new Promise((resolve) => setTimeout(resolve, 100));

      } catch (error: any) {
        logger.warn('[StockX Sync Prices] Failed to fetch price', {
          sku,
          size,
          error: error.message,
        });
        skippedCount++;
      }
    }

    const duration = Date.now() - startTime;

    logger.apiRequest(
      '/api/stockx/sync/prices',
      { userId: user.id },
      duration,
      {
        processed: processedCount,
        upserted: upsertedCount,
        skipped: skippedCount,
      }
    );

    return NextResponse.json({
      success: true,
      processed: processedCount,
      upserted: upsertedCount,
      skipped: skippedCount,
      duration_ms: duration,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    // Handle 429 rate limiting
    if (error.message?.includes('429')) {
      logger.warn('[StockX Sync Prices] Rate limited', {
        duration,
        error: error.message,
      });

      return NextResponse.json(
        {
          error: 'Rate limited by StockX. Please try again later.',
          retry_after: 60,
        },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
          },
        }
      );
    }

    logger.error('[StockX Sync Prices] Error', {
      message: error.message,
      stack: error.stack,
      duration,
    });

    return NextResponse.json(
      { error: 'Failed to sync StockX prices', details: error.message },
      { status: 500 }
    );
  }
}
