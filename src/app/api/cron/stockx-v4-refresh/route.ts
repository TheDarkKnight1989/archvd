import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { refreshStockxProductByProductId } from '@/lib/services/stockx-v4/sync';

/**
 * Cron Job: Refresh StockX V4 Catalog Prices
 *
 * Runs every 6 hours to keep market data fresh.
 *
 * Strategy:
 * - Find products with stale market_data (older than 6 hours)
 * - Batch refresh with timeout handling (Vercel = 60s max)
 * - Process ~10 products per run (avg 3s per product = 30s total)
 * - Return stats for monitoring
 */

const REFRESH_THRESHOLD_HOURS = 6;
const MAX_PRODUCTS_PER_RUN = 10;
const TIMEOUT_BUFFER_MS = 5000; // Reserve 5s for response

export const runtime = 'nodejs';
export const maxDuration = 60; // Vercel Pro limit

type RefreshResult = {
  productId: string;
  styleId: string;
  success: boolean;
  variantsRefreshed?: number;
  error?: string;
  duration: number;
};

type CronSummary = {
  timestamp: string;
  refreshed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  results: RefreshResult[];
  staleProductsRemaining: number;
};

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret (Vercel Cron sends this header)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 1. Find stale products (market_data older than REFRESH_THRESHOLD_HOURS)
    const thresholdDate = new Date();
    thresholdDate.setHours(thresholdDate.getHours() - REFRESH_THRESHOLD_HOURS);

    console.log(`[Cron] Looking for market data older than ${thresholdDate.toISOString()}`);

    // Query market_data for stale records (join through variants to get product IDs)
    const { data: staleMarketData, error: queryError } = await supabase
      .from('inventory_v4_stockx_market_data')
      .select('stockx_variant_id, updated_at')
      .lt('updated_at', thresholdDate.toISOString())
      .order('updated_at', { ascending: true })
      .limit(MAX_PRODUCTS_PER_RUN * 20); // Get more variants, we'll group by product

    if (queryError) {
      console.error('[Cron] Failed to query stale market data:', queryError);
      return NextResponse.json(
        { error: 'Database query failed', details: queryError.message },
        { status: 500 }
      );
    }

    if (!staleMarketData || staleMarketData.length === 0) {
      console.log('[Cron] No stale market data found - all prices are fresh!');
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        message: 'No stale products found',
        refreshed: 0,
        failed: 0,
        skipped: 0,
        durationMs: Date.now() - startTime,
        results: [],
        staleProductsRemaining: 0,
      } as CronSummary);
    }

    console.log(`[Cron] Found ${staleMarketData.length} stale market data records`);

    // 2. Get variants to map to product IDs
    const variantIds = staleMarketData.map(md => md.stockx_variant_id);
    const { data: variants, error: variantsError } = await supabase
      .from('inventory_v4_stockx_variants')
      .select('stockx_variant_id, stockx_product_id')
      .in('stockx_variant_id', variantIds);

    if (variantsError) {
      console.error('[Cron] Failed to fetch variants:', variantsError);
      return NextResponse.json(
        { error: 'Failed to fetch variants', details: variantsError.message },
        { status: 500 }
      );
    }

    // 3. Get unique product IDs (multiple variants per product)
    const uniqueProductIds = Array.from(
      new Set((variants || []).map(v => v.stockx_product_id))
    ).slice(0, MAX_PRODUCTS_PER_RUN);

    if (uniqueProductIds.length === 0) {
      console.log('[Cron] No product IDs found from stale variants');
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        message: 'No stale products found',
        refreshed: 0,
        failed: 0,
        skipped: 0,
        durationMs: Date.now() - startTime,
        results: [],
        staleProductsRemaining: 0,
      } as CronSummary);
    }

    console.log(`[Cron] Found ${uniqueProductIds.length} unique products to refresh`);

    // 4. Fetch product details (style_id for logging)
    const { data: products, error: productsError } = await supabase
      .from('inventory_v4_stockx_products')
      .select('stockx_product_id, style_id')
      .in('stockx_product_id', uniqueProductIds);

    if (productsError) {
      console.error('[Cron] Failed to fetch product details:', productsError);
      return NextResponse.json(
        { error: 'Failed to fetch product details', details: productsError.message },
        { status: 500 }
      );
    }

    const productsToRefresh = products || [];

    if (productsToRefresh.length === 0) {
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        message: 'No stale products found',
        refreshed: 0,
        failed: 0,
        skipped: 0,
        durationMs: Date.now() - startTime,
        results: [],
        staleProductsRemaining: 0,
      } as CronSummary);
    }

    // 5. Refresh products with timeout protection
    const results: RefreshResult[] = [];
    let refreshed = 0;
    let failed = 0;
    let skipped = 0;

    for (const product of productsToRefresh) {
      // Check if we're approaching timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > (maxDuration * 1000 - TIMEOUT_BUFFER_MS)) {
        console.log(`[Cron] Approaching timeout, skipping remaining products`);
        skipped = productsToRefresh.length - results.length;
        break;
      }

      const productStartTime = Date.now();

      try {
        console.log(`[Cron] Refreshing ${product.style_id} (${product.stockx_product_id})`);

        const syncResult = await refreshStockxProductByProductId(
          product.stockx_product_id,
          'GBP'
        );

        results.push({
          productId: product.stockx_product_id,
          styleId: product.style_id,
          success: true,
          variantsRefreshed: syncResult.counts.marketDataRefreshed,
          duration: Date.now() - productStartTime,
        });

        refreshed++;
        console.log(`[Cron] ✅ ${product.style_id}: ${syncResult.counts.marketDataRefreshed} variants refreshed`);
      } catch (error) {
        results.push({
          productId: product.stockx_product_id,
          styleId: product.style_id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - productStartTime,
        });

        failed++;
        console.error(`[Cron] ❌ ${product.style_id}: ${error}`);
      }
    }

    // 6. Count remaining stale products (for monitoring)
    const { count: remainingStale } = await supabase
      .from('inventory_v4_stockx_market_data')
      .select('stockx_variant_id', { count: 'exact', head: true })
      .lt('updated_at', thresholdDate.toISOString());

    const summary: CronSummary = {
      timestamp: new Date().toISOString(),
      refreshed,
      failed,
      skipped,
      durationMs: Date.now() - startTime,
      results,
      staleProductsRemaining: Math.max(0, (remainingStale || 0) - refreshed),
    };

    console.log('[Cron] Summary:', {
      refreshed: summary.refreshed,
      failed: summary.failed,
      skipped: summary.skipped,
      duration: `${summary.durationMs}ms`,
      remaining: summary.staleProductsRemaining,
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error('[Cron] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
