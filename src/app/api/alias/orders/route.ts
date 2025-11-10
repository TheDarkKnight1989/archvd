/**
 * Alias Orders API
 * GET /api/alias/orders?status=<status>&since=<since>&limit=<limit>
 * Fetches user's orders and upserts to alias_orders table
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAliasEnabled, isAliasFullyConfigured, isAliasMockMode } from '@/lib/config/alias';
import { createUserAliasService } from '@/lib/integrations/alias';
import { logger } from '@/lib/logger';
import path from 'path';
import { promises as fs } from 'fs';

export async function GET(request: NextRequest) {
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

    // 2. Check if mock mode is enabled
    if (isAliasMockMode()) {
      logger.info('[API /alias/orders] Mock mode active');

      // Authenticate user for database operations
      const supabase = await createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Parse query params
      const searchParams = request.nextUrl.searchParams;
      const status = searchParams.get('status') as
        | 'pending'
        | 'confirmed'
        | 'shipped'
        | 'delivered'
        | 'completed'
        | null;
      const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

      // Read mock fixture
      const fixturesPath = path.join(process.cwd(), 'fixtures', 'alias', 'orders.json');
      const fixtureData = await fs.readFile(fixturesPath, 'utf-8');
      const mockData = JSON.parse(fixtureData);

      // Filter by status if specified
      let filteredOrders = mockData.orders;
      if (status) {
        filteredOrders = mockData.orders.filter((order: any) => order.status === status);
      }

      // Upsert mock data to database
      const mockOrdersForDb = filteredOrders.map((order: any) => ({
        user_id: user.id,
        alias_account_id: null, // No real account in mock mode
        alias_order_id: order.id,
        order_number: order.orderNumber,
        alias_product_id: order.id,
        sku: order.sku,
        size: order.size,
        sale_price: order.salePrice,
        currency: order.currency || 'GBP',
        commission: order.commission,
        processing_fee: order.processingFee,
        net_payout: order.netPayout,
        status: order.status,
        tracking_number: order.trackingNumber || null,
        buyer_country: order.buyerCountry || null,
        sold_at: order.soldAt,
        synced_at: new Date().toISOString(),
      }));

      // Upsert to database
      if (mockOrdersForDb.length > 0) {
        const { error: upsertError } = await supabase
          .from('alias_orders')
          .upsert(mockOrdersForDb, {
            onConflict: 'alias_order_id',
            ignoreDuplicates: false,
          });

        if (upsertError) {
          logger.error('[API /alias/orders] Mock upsert failed', {
            error: upsertError.message,
          });
        }
      }

      const duration = Date.now() - startTime;

      return NextResponse.json({
        orders: filteredOrders.slice(0, limit),
        pagination: {
          limit,
          total: filteredOrders.length,
        },
        lastSync: new Date().toISOString(),
        _meta: {
          duration_ms: duration,
          freshlyFetched: filteredOrders.length,
          source: 'alias_mock',
          mode: 'mock',
        },
      });
    }

    if (!isAliasFullyConfigured()) {
      return NextResponse.json(
        {
          error: 'Not Implemented',
          message: 'Alias integration is not fully configured',
          code: 'ALIAS_NOT_CONFIGURED',
        },
        { status: 501 }
      );
    }

    // 3. Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Parse query params
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as
      | 'pending'
      | 'confirmed'
      | 'shipped'
      | 'delivered'
      | 'completed'
      | null;
    const since = searchParams.get('since') || '30d'; // Default last 30 days
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    // 4. Check if user has Alias account
    const { data: aliasAccount, error: accountError } = await supabase
      .from('alias_accounts')
      .select('id, status, last_sync_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (accountError || !aliasAccount) {
      logger.info('[API /alias/orders] User not connected', {
        user_id: user.id,
      });
      return NextResponse.json(
        {
          error: 'Not Implemented',
          message: 'Please connect your Alias (GOAT) account first',
          code: 'ALIAS_NOT_CONNECTED',
        },
        { status: 501 }
      );
    }

    // 5. Create Alias service for user
    const aliasService = await createUserAliasService(user.id);

    if (!aliasService) {
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Failed to initialize Alias service',
        },
        { status: 500 }
      );
    }

    // 6. Fetch orders from Alias API
    // TODO: Implement getOrders method in GoatOrdersService
    // For now, return TODO response
    logger.warn('[API /alias/orders] TODO: Implement orders fetch', {
      user_id: user.id,
    });

    // Placeholder: Return empty orders with TODO comment
    // TODO(auth): Implement GoatOrdersService.getSold() method
    const orders: any[] = [];

    // 7. Upsert to alias_orders table (when implemented)
    // const upsertedCount = await upsertOrders(supabase, user.id, aliasAccount.id, orders);

    // 8. Fetch from database
    const { data: dbOrders, error: dbError, count: totalCount } = await supabase
      .from('alias_orders')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('sold_at', { ascending: false })
      .limit(limit);

    if (dbError) {
      throw dbError;
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      orders: dbOrders || [],
      pagination: {
        limit,
        total: totalCount || 0,
      },
      lastSync: aliasAccount.last_sync_at,
      _meta: {
        duration_ms: duration,
        freshlyFetched: orders.length,
        source: 'alias_goat',
        todo: 'Implement GoatOrdersService for full orders sync',
      },
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('[API /alias/orders] Error', {
      error: error.message,
      stack: error.stack,
      duration,
    });

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error.message || 'Failed to fetch orders',
      },
      { status: 500 }
    );
  }
}

/**
 * Upsert orders to database (idempotent)
 * TODO: Implement when GoatOrder type is available
 */
async function upsertOrders(
  supabase: any,
  userId: string,
  aliasAccountId: string,
  orders: any[]
): Promise<number> {
  if (orders.length === 0) {
    return 0;
  }

  // TODO: Map GoatOrder to alias_orders schema
  const rows = orders.map((order: any) => ({
    user_id: userId,
    alias_account_id: aliasAccountId,
    alias_order_id: order.id,
    order_number: order.orderNumber,
    alias_product_id: order.productId,
    sku: order.sku,
    product_name: order.productName,
    size: order.size,
    condition: order.condition,
    sale_price: order.salePrice,
    currency: order.currency,
    commission: order.commission,
    processing_fee: order.processingFee,
    shipping_cost: order.shippingCost,
    net_payout: order.netPayout,
    status: order.status,
    payment_status: order.paymentStatus,
    tracking_number: order.trackingNumber || null,
    shipping_label_url: order.shippingLabelUrl || null,
    carrier: order.carrier || null,
    buyer_id: order.buyerId || null,
    buyer_country: order.buyerAddress?.country || null,
    sold_at: order.soldAt,
    confirmed_at: order.confirmedAt || null,
    shipped_at: order.shippedAt || null,
    delivered_at: order.deliveredAt || null,
    synced_at: new Date().toISOString(),
  }));

  const batchSize = 50;
  let upsertedCount = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    const { error } = await supabase.from('alias_orders').upsert(batch, {
      onConflict: 'alias_order_id',
      ignoreDuplicates: false,
    });

    if (error) {
      logger.error('[upsertOrders] Batch upsert failed', {
        batchIndex: i / batchSize,
        error: error.message,
      });
      throw error;
    }

    upsertedCount += batch.length;
  }

  return upsertedCount;
}
