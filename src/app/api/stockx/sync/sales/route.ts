/**
 * StockX Sync Sales
 * Fetches recent StockX sales/orders and creates Sales records
 * POST /api/stockx/sync/sales?since=ISO_DATE
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

    // Get optional "since" parameter (default: last 7 days)
    const searchParams = request.nextUrl.searchParams;
    const since = searchParams.get('since') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get user-specific StockX client
    const client = getStockxClient(user.id);

    // Fetch user's orders/sales from StockX (v2 API)
    const response = await client.request(
      `/v2/selling/orders?status=HISTORICAL&pageSize=100`,
      {
        method: 'GET',
      }
    );

    if (!response || !Array.isArray(response.orders)) {
      logger.warn('[StockX Sync Sales] No orders returned', { userId: user.id, since });
      return NextResponse.json({
        success: true,
        fetched: 0,
        created: 0,
        updated: 0,
        duration_ms: Date.now() - startTime,
      });
    }

    // Filter orders by 'since' date client-side
    const orders = response.orders.filter((order: any) => {
      if (!order.sold_at) return false;
      return new Date(order.sold_at) >= new Date(since);
    });

    let fetchedCount = orders.length;
    let createdCount = 0;
    let updatedCount = 0;

    // Process each order
    for (const order of orders) {
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

      // Calculate net amount (payout after fees)
      const netAmount = total_payout || (sale_price - (commission_amount || 0) - (processing_fee || 0) - (shipping_cost || 0));

      // Try to find matching inventory item
      const { data: inventoryItems } = await supabase
        .from('Inventory')
        .select('id, purchase_price')
        .eq('sku', sku)
        .eq('size', size)
        .eq('user_id', user.id)
        .in('status', ['active', 'listed', 'sold'])
        .order('created_at', { ascending: false })
        .limit(1);

      const inventoryItem = inventoryItems?.[0];

      // Upsert into stockx_sales table
      const { error: stockxSaleError } = await supabase
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

      if (stockxSaleError) {
        logger.error('[StockX Sync Sales] Failed to upsert stockx_sales', {
          error: stockxSaleError.message,
          order_id: stockx_order_id,
        });
        continue;
      }

      // Check if we already have a Sales record for this StockX order
      const { data: existingSale } = await supabase
        .from('Sales')
        .select('id')
        .eq('stockx_order_id', stockx_order_id)
        .single();

      if (existingSale) {
        // Update existing Sales record
        const { error: updateError } = await supabase
          .from('Sales')
          .update({
            sold_price: sale_price,
            sold_date: sold_at,
            commission: commission_amount || 0,
            net_payout: netAmount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingSale.id);

        if (!updateError) {
          updatedCount++;

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
        }
      } else {
        // Create new Sales record
        const { error: createError } = await supabase
          .from('Sales')
          .insert({
            user_id: user.id,
            item_id: inventoryItem?.id || null,
            sku,
            brand: '', // Will be enriched from catalog
            model: '', // Will be enriched from catalog
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

        if (!createError) {
          createdCount++;

          // Mark inventory item as sold if we found one
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
    }

    const duration = Date.now() - startTime;

    logger.apiRequest(
      '/api/stockx/sync/sales',
      { userId: user.id, since },
      duration,
      {
        fetched: fetchedCount,
        created: createdCount,
        updated: updatedCount,
      }
    );

    return NextResponse.json({
      success: true,
      fetched: fetchedCount,
      created: createdCount,
      updated: updatedCount,
      duration_ms: duration,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    // Handle 429 rate limiting
    if (error.message?.includes('429')) {
      logger.warn('[StockX Sync Sales] Rate limited', {
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

    logger.error('[StockX Sync Sales] Error', {
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
