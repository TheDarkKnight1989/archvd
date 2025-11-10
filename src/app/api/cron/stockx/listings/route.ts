/**
 * StockX Listings Cron Job
 * Syncs StockX listings for all connected users
 * Triggered: Daily at 3am by Vercel Cron
 * GET /api/cron/stockx/listings
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

    // Use service role client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all users with connected StockX accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('stockx_accounts')
      .select('user_id, account_email');

    if (accountsError || !accounts || accounts.length === 0) {
      logger.info('[Cron StockX Listings] No connected accounts', { count: 0 });
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No StockX accounts connected',
      });
    }

    logger.info('[Cron StockX Listings] Processing users', { count: accounts.length });

    let totalFetched = 0;
    let totalMapped = 0;
    const errors: { userId: string; error: string }[] = [];

    // Process each user
    for (const account of accounts) {
      try {
        const userId = account.user_id;
        const client = getStockxClient(userId);

        // Fetch user's listings from StockX
        const listingsResponse = await client.request(
          '/api/v1/users/me/listings?status=active',
          { method: 'GET' }
        );

        if (!listingsResponse || !Array.isArray(listingsResponse.data)) {
          logger.warn('[Cron StockX Listings] No listings for user', { userId });
          continue;
        }

        let userFetched = listingsResponse.data.length;
        let userMapped = 0;

        // Process each listing
        for (const listing of listingsResponse.data) {
          const {
            id: listing_id,
            sku,
            size,
            product,
            ask_price,
            currency = 'USD',
          } = listing;

          // Upsert product info into stockx_products
          if (product) {
            await supabase
              .from('stockx_products')
              .upsert(
                {
                  sku,
                  title: product.title || '',
                  brand: product.brand || '',
                  model: product.model || '',
                  colorway: product.colorway || '',
                  retail_price: product.retail_price || null,
                  release_date: product.release_date || null,
                  image_url: product.image_url || null,
                  updated_at: new Date().toISOString(),
                },
                {
                  onConflict: 'sku',
                  ignoreDuplicates: false,
                }
              );
          }

          // Find matching inventory items by SKU and size
          const { data: inventoryItems } = await supabase
            .from('Inventory')
            .select('id, status')
            .eq('sku', sku)
            .eq('size', size)
            .eq('user_id', userId)
            .in('status', ['active', 'listed', 'worn']);

          if (!inventoryItems || inventoryItems.length === 0) {
            logger.warn('[Cron StockX Listings] No matching inventory', { userId, sku, size });
            continue;
          }

          // Map each inventory item to StockX
          for (const item of inventoryItems) {
            await supabase
              .from('inventory_market_links')
              .upsert(
                {
                  inventory_id: item.id,
                  provider: 'stockx',
                  provider_product_sku: sku,
                  provider_listing_id: listing_id,
                  ask_price,
                  currency,
                  status: 'active',
                  updated_at: new Date().toISOString(),
                },
                {
                  onConflict: 'inventory_id,provider',
                  ignoreDuplicates: false,
                }
              );

            userMapped++;
          }

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        totalFetched += userFetched;
        totalMapped += userMapped;

        logger.info('[Cron StockX Listings] User complete', {
          userId,
          fetched: userFetched,
          mapped: userMapped,
        });

      } catch (userError: any) {
        logger.error('[Cron StockX Listings] User error', {
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

    logger.info('[Cron StockX Listings] Complete', {
      duration,
      accounts: accounts.length,
      fetched: totalFetched,
      mapped: totalMapped,
      errors: errors.length,
    });

    return NextResponse.json({
      success: true,
      accounts: accounts.length,
      fetched: totalFetched,
      mapped: totalMapped,
      errors: errors.length > 0 ? errors : undefined,
      duration_ms: duration,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('[Cron StockX Listings] Error', {
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
