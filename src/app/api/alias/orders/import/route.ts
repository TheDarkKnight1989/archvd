/**
 * Alias Import Sales API
 * POST /api/alias/orders/import
 * Imports Alias (GOAT) sales as Sales records
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAliasEnabled, isAliasMockMode } from '@/lib/config/alias';
import { logger } from '@/lib/logger';

interface ImportSalesRequest {
  orderIds?: string[]; // Specific order IDs to import, or all if not specified
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Check feature flag
    if (!isAliasEnabled()) {
      return NextResponse.json(
        {
          error: 'Not Implemented',
          message: 'Alias integration is not enabled',
          code: 'ALIAS_DISABLED',
        },
        { status: 501 }
      );
    }

    // 2. Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Parse request body
    const body: ImportSalesRequest = await request.json().catch(() => ({}));
    const { orderIds } = body;

    // 4. Check if mock mode is enabled
    if (isAliasMockMode()) {
      logger.info('[API /alias/orders/import] Mock mode active - importing sales', {
        orderIds,
      });

      // Fetch orders from alias_orders table
      let query = supabase
        .from('alias_orders')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .is('imported_to_sales_at', null); // Only import once

      if (orderIds && orderIds.length > 0) {
        query = query.in('alias_order_id', orderIds);
      }

      const { data: orders, error: ordersError } = await query;

      if (ordersError) {
        throw ordersError;
      }

      if (!orders || orders.length === 0) {
        return NextResponse.json({
          success: true,
          imported: 0,
          message: 'No new orders to import',
          _meta: {
            duration_ms: Date.now() - startTime,
            source: 'alias_mock',
            mode: 'mock',
          },
        });
      }

      // Convert orders to Sales records
      const salesRecords = orders.map((order) => ({
        user_id: user.id,
        sku: order.sku,
        size: order.size,
        sale_price: order.sale_price,
        currency: order.currency,
        sale_date: order.sold_at,
        platform: 'GOAT',
        platform_order_id: order.order_number,
        fees: order.commission + order.processing_fee,
        net_payout: order.net_payout,
        tracking_number: order.tracking_number,
        buyer_country: order.buyer_country,
        status: 'completed',
        created_at: new Date().toISOString(),
      }));

      // Insert into Sales table
      const { error: insertError } = await supabase
        .from('Sales')
        .insert(salesRecords);

      if (insertError) {
        logger.error('[API /alias/orders/import] Sales insert failed', {
          error: insertError.message,
        });
        throw insertError;
      }

      // Mark orders as imported
      const { error: updateError } = await supabase
        .from('alias_orders')
        .update({ imported_to_sales_at: new Date().toISOString() })
        .in(
          'alias_order_id',
          orders.map((o) => o.alias_order_id)
        );

      if (updateError) {
        logger.warn('[API /alias/orders/import] Failed to mark orders as imported', {
          error: updateError.message,
        });
        // Non-fatal - sales were imported
      }

      const duration = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        imported: orders.length,
        sales: salesRecords.map((s) => ({
          sku: s.sku,
          size: s.size,
          price: s.sale_price,
          date: s.sale_date,
        })),
        _meta: {
          duration_ms: duration,
          source: 'alias_mock',
          mode: 'mock',
        },
      });
    }

    // 5. Live mode (not yet implemented)
    return NextResponse.json(
      {
        error: 'Not Implemented',
        message: 'Live mode sales import not yet implemented',
        code: 'ALIAS_LIVE_NOT_IMPLEMENTED',
      },
      { status: 501 }
    );
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('[API /alias/orders/import] Error', {
      error: error.message,
      stack: error.stack,
      duration,
    });

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error.message || 'Failed to import sales',
      },
      { status: 500 }
    );
  }
}
