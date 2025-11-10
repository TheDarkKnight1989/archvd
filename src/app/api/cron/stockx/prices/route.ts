/**
 * StockX Prices Cron Job
 * Syncs StockX market prices for all connected users
 * Triggered: Hourly by Vercel Cron
 * GET /api/cron/stockx/prices
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStockxClient } from '@/lib/services/stockx/client';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if StockX is enabled
    if (process.env.NEXT_PUBLIC_STOCKX_ENABLE !== 'true') {
      return NextResponse.json({ success: true, message: 'StockX is disabled' });
    }

    // Use service role client to access all users
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all users with connected StockX accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('stockx_accounts')
      .select('user_id, account_email');

    if (accountsError || !accounts || accounts.length === 0) {
      logger.info('[Cron StockX Prices] No connected accounts', { count: 0 });
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No StockX accounts connected',
      });
    }

    logger.info('[Cron StockX Prices] Processing users', { count: accounts.length });

    let totalProcessed = 0;
    let totalUpserted = 0;
    let totalSkipped = 0;
    const errors: { userId: string; error: string }[] = [];

    // Process each user
    for (const account of accounts) {
      try {
        const userId = account.user_id;
        const client = getStockxClient(userId);

        // Fetch distinct (SKU, size) pairs from user's inventory
        const { data: inventoryItems, error: inventoryError } = await supabase
          .from('Inventory')
          .select('sku, size')
          .eq('user_id', userId)
          .eq('category', 'sneaker')
          .in('status', ['active', 'listed', 'worn']);

        if (inventoryError || !inventoryItems || inventoryItems.length === 0) {
          logger.info('[Cron StockX Prices] No inventory for user', { userId });
          continue;
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
        let userProcessed = 0;
        let userUpserted = 0;
        let userSkipped = 0;

        // Fetch prices for each (SKU, size) pair
        for (const { sku, size } of pairs) {
          try {
            const marketData = await client.request(
              `/api/v1/products/${encodeURIComponent(sku)}/market-data?size=${encodeURIComponent(size)}`,
              { method: 'GET' }
            );

            userProcessed++;

            if (!marketData || !marketData.data) {
              userSkipped++;
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
              logger.error('[Cron StockX Prices] Failed to insert price', {
                error: priceError.message,
                sku,
                size,
              });
              userSkipped++;
            } else {
              userUpserted++;
            }

            // Small delay to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 100));

          } catch (error: any) {
            logger.warn('[Cron StockX Prices] Failed to fetch price', {
              sku,
              size,
              error: error.message,
            });
            userSkipped++;
          }
        }

        totalProcessed += userProcessed;
        totalUpserted += userUpserted;
        totalSkipped += userSkipped;

        logger.info('[Cron StockX Prices] User complete', {
          userId,
          processed: userProcessed,
          upserted: userUpserted,
          skipped: userSkipped,
        });

      } catch (userError: any) {
        logger.error('[Cron StockX Prices] User error', {
          userId: account.user_id,
          error: userError.message,
        });
        errors.push({
          userId: account.user_id,
          error: userError.message,
        });
      }
    }

    // Refresh materialized views after price sync
    try {
      await supabase.rpc('refresh_sneaker_daily_medians');
      await supabase.rpc('refresh_portfolio_value_daily');
      logger.info('[Cron StockX Prices] Materialized views refreshed');
    } catch (mvError: any) {
      logger.warn('[Cron StockX Prices] Failed to refresh materialized views', {
        error: mvError.message,
      });
    }

    const duration = Date.now() - startTime;

    logger.info('[Cron StockX Prices] Complete', {
      duration,
      accounts: accounts.length,
      processed: totalProcessed,
      upserted: totalUpserted,
      skipped: totalSkipped,
      errors: errors.length,
    });

    return NextResponse.json({
      success: true,
      accounts: accounts.length,
      processed: totalProcessed,
      upserted: totalUpserted,
      skipped: totalSkipped,
      errors: errors.length > 0 ? errors : undefined,
      duration_ms: duration,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('[Cron StockX Prices] Error', {
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
