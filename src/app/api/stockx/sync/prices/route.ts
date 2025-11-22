/**
 * StockX V2 Sync Prices - Materialized View Refresh
 *
 * IMPORTANT: This endpoint ONLY refreshes the stockx_market_latest materialized view.
 * It does NOT fetch new market data from the StockX API.
 *
 * For actual market data sync (fetching fresh prices from StockX), use:
 * - /api/stockx/sync/inventory (recommended for UI sync buttons)
 * - /api/stockx/sync/item (for single item sync)
 *
 * This endpoint is primarily for:
 * - Cron jobs that run after market data has been fetched
 * - Manual view refresh when data is already in stockx_market_snapshots
 *
 * POST /api/stockx/sync/prices
 */

import { NextRequest, NextResponse } from 'next/server';
import { refreshStockxMarketLatestView } from '@/lib/providers/stockx-worker';
import { isStockxMockMode } from '@/lib/config/stockx';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('[StockX V2 Sync] Starting price sync');

    // Check if StockX is in mock mode
    if (isStockxMockMode()) {
      return NextResponse.json(
        {
          success: false,
          error: 'StockX is in mock mode. Real API calls are disabled.',
        },
        { status: 503 }
      );
    }

    // Optional: Verify authorization (add your auth check here)
    // const authHeader = request.headers.get('authorization');
    // if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // Run the market data refresh via worker
    const result = await refreshStockxMarketLatestView();

    const duration = Date.now() - startTime;

    console.log('[StockX V2 Sync] Completed:', result);

    return NextResponse.json({
      ...result,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error('[StockX V2 Sync] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error.message,
        duration_ms: duration,
      },
      { status: 500 }
    );
  }
}

// Also support GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request);
}
