/**
 * StockX Prices Cron Job
 * Queues StockX market price jobs for all connected users
 * Triggered: Hourly by Vercel Cron
 * GET /api/cron/stockx/prices
 *
 * DIRECTIVE COMPLIANCE:
 * - No live StockX API calls in this route
 * - V1 endpoints forbidden
 * - Worker + V2 + cached stockx_market_latest ONLY
 * - This route queues jobs via market_jobs table
 * - stockx-worker processes jobs with V2 services
 * - Results cached in stockx_market_latest view
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createMarketJobsBatch } from '@/lib/stockx/jobs';
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

    let totalJobsCreated = 0;
    let totalJobsSkipped = 0;
    const errors: { userId: string; error: string }[] = [];

    // Process each user
    for (const account of accounts) {
      try {
        const userId = account.user_id;

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

        // Queue market jobs in batch (replaces live V1 API calls)
        const jobParams = pairs.map(({ sku, size }) => ({
          sku,
          size,
          userId,
        }));

        const result = await createMarketJobsBatch(jobParams);

        totalJobsCreated += result.created;
        totalJobsSkipped += result.skipped;

        if (result.errors.length > 0) {
          logger.warn('[Cron StockX Prices] Some jobs failed to create', {
            userId,
            errors: result.errors,
          });
        }

        logger.info('[Cron StockX Prices] User complete', {
          userId,
          jobsCreated: result.created,
          jobsSkipped: result.skipped,
          totalPairs: pairs.length,
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

    const duration = Date.now() - startTime;

    logger.info('[Cron StockX Prices] Complete', {
      duration,
      accounts: accounts.length,
      jobsQueued: totalJobsCreated,
      jobsSkipped: totalJobsSkipped,
      errors: errors.length,
    });

    return NextResponse.json({
      success: true,
      status: 'ok',
      accounts: accounts.length,
      jobsQueued: totalJobsCreated,
      jobsSkipped: totalJobsSkipped,
      errors: errors.length > 0 ? errors : undefined,
      duration_ms: duration,
      message: `Queued ${totalJobsCreated} market jobs for background processing. Worker will fetch prices using V2 API and cache in stockx_market_latest.`,
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
