/**
 * StockX Sales Cron Job
 * Syncs StockX sales/orders for all connected users
 * Triggered: Every 30 minutes by Vercel Cron
 * GET /api/cron/stockx/sales
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
      logger.info('[Cron StockX Sales] No connected accounts', { count: 0 });
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No StockX accounts connected',
      });
    }

    logger.info('[Cron StockX Sales] Processing users', { count: accounts.length });

    // Fetch sales since 1 hour ago (cron runs every 30min, so this ensures overlap)
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    let totalFetched = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    const errors: { userId: string; error: string }[] = [];

    // Process each user
    for (const account of accounts) {
      try {
        const userId = account.user_id;
        const client = getStockxClient(userId);

        // Fetch user's orders/sales from StockX
        const ordersResponse = await client.request(
          `/api/v1/users/me/orders?since=${encodeURIComponent(since)}&type=sold`,
          { method: 'GET' }
        );

        if (!ordersResponse || !Array.isArray(ordersResponse.data)) {
          logger.warn('[Cron StockX Sales] No orders for user', { userId });
          continue;
        }

        let userFetched = ordersResponse.data.length;
        let userCreated = 0;
        let userUpdated = 0;

        // Process each order
        for (const order of ordersResponse.data) {
          const {
            id: stockx_order_id,
            sku,
            size,
            sale_price,
            currency = 'USD',
            commission_amount,
            commission_percent,
            processing_fee,
            shipping_cost,
            total_payout,
            sold_at,
            status,
          } = order;

          const netAmount = total_payout || (sale_price - (commission_amount || 0) - (processing_fee || 0) - (shipping_cost || 0));

          // Try to find matching inventory item
          const { data: inventoryItems } = await supabase
            .from('Inventory')
            .select('id, purchase_price')
            .eq('sku', sku)
            .eq('size', size)
            .eq('user_id', userId)
            .in('status', ['active', 'listed', 'sold'])
            .order('created_at', { ascending: false })
            .limit(1);

          const inventoryItem = inventoryItems?.[0];

          // Upsert into stockx_sales
          await supabase
            .from('stockx_sales')
            .upsert(
              {
                sku,
                size,
                currency,
                sale_price,
                sold_at,
                stockx_order_id,
                commission_amount,
                processing_fee,
                shipping_cost,
                net_payout: netAmount,
                status,
              },
              {
                onConflict: 'stockx_order_id',
                ignoreDuplicates: false,
              }
            );

          // Check if we already have a Sales record
          const { data: existingSale } = await supabase
            .from('Sales')
            .select('id')
            .eq('stockx_order_id', stockx_order_id)
            .single();

          if (existingSale) {
            // Update existing Sales record
            await supabase
              .from('Sales')
              .update({
                sold_price: sale_price,
                sold_date: sold_at,
                commission: commission_amount || 0,
                net_payout: netAmount,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingSale.id);

            userUpdated++;

            // Mark inventory item as sold if needed
            if (inventoryItem && status === 'completed') {
              await supabase
                .from('Inventory')
                .update({
                  status: 'sold',
                  sold_price: sale_price,
                  sold_date: sold_at,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', inventoryItem.id);
            }
          } else {
            // Create new Sales record
            await supabase
              .from('Sales')
              .insert({
                user_id: userId,
                item_id: inventoryItem?.id || null,
                sku,
                brand: '',
                model: '',
                size,
                purchase_price: inventoryItem?.purchase_price || 0,
                sold_price: sale_price,
                sold_date: sold_at,
                platform: 'StockX',
                commission: commission_amount || 0,
                net_payout: netAmount,
                stockx_order_id,
                created_at: new Date().toISOString(),
              });

            userCreated++;

            // Mark inventory item as sold
            if (inventoryItem && status === 'completed') {
              await supabase
                .from('Inventory')
                .update({
                  status: 'sold',
                  sold_price: sale_price,
                  sold_date: sold_at,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', inventoryItem.id);
            }
          }
        }

        totalFetched += userFetched;
        totalCreated += userCreated;
        totalUpdated += userUpdated;

        logger.info('[Cron StockX Sales] User complete', {
          userId,
          fetched: userFetched,
          created: userCreated,
          updated: userUpdated,
        });

      } catch (userError: any) {
        logger.error('[Cron StockX Sales] User error', {
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

    logger.info('[Cron StockX Sales] Complete', {
      duration,
      accounts: accounts.length,
      fetched: totalFetched,
      created: totalCreated,
      updated: totalUpdated,
      errors: errors.length,
    });

    return NextResponse.json({
      success: true,
      accounts: accounts.length,
      fetched: totalFetched,
      created: totalCreated,
      updated: totalUpdated,
      errors: errors.length > 0 ? errors : undefined,
      duration_ms: duration,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('[Cron StockX Sales] Error', {
      message: error.message,
      stack: error.stack,
      duration,
    });

    return NextResponse.json(
      { error: 'Failed to sync StockX sales', details: error.message },
      { status: 500 }
    );
  }
}
