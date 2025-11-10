/**
 * StockX API Test Endpoint
 * Tests basic API connectivity and explores available endpoints
 * GET /api/stockx/test
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStockxClient } from '@/lib/services/stockx/client';

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has connected StockX account
    const { data: account, error: accountError } = await supabase
      .from('stockx_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'StockX account not connected' },
        { status: 401 }
      );
    }

    // Get user-specific StockX client
    const client = getStockxClient(user.id);

    const results: any = {
      account_connected: true,
      account_email: account.account_email,
      token_expires_at: account.expires_at,
      has_refresh_token: !!account.refresh_token,
      tests: {},
    };

    // Test 1: Get all listings (CORRECT v2 API)
    try {
      const listings = await client.request('/v2/selling/listings?pageSize=10');
      results.tests.listings = {
        success: true,
        endpoint: '/v2/selling/listings',
        count: listings?.count || 0,
        pageSize: listings?.pageSize || 0,
        sample: listings?.listings?.[0] || null,
      };
    } catch (error: any) {
      results.tests.listings = {
        success: false,
        endpoint: '/v2/selling/listings',
        error: error.message,
      };
    }

    // Test 2: Get active orders (CORRECT v2 API)
    try {
      const orders = await client.request('/v2/selling/orders/active?pageSize=10');
      results.tests.active_orders = {
        success: true,
        endpoint: '/v2/selling/orders/active',
        count: orders?.count || 0,
        pageSize: orders?.pageSize || 0,
        sample: orders?.orders?.[0] || null,
      };
    } catch (error: any) {
      results.tests.active_orders = {
        success: false,
        endpoint: '/v2/selling/orders/active',
        error: error.message,
      };
    }

    // Test 3: Get historical orders (CORRECT v2 API)
    try {
      const history = await client.request('/v2/selling/orders/history?pageSize=10');
      results.tests.order_history = {
        success: true,
        endpoint: '/v2/selling/orders/history',
        count: history?.count || 0,
        pageSize: history?.pageSize || 0,
        sample: history?.orders?.[0] || null,
      };
    } catch (error: any) {
      results.tests.order_history = {
        success: false,
        endpoint: '/v2/selling/orders/history',
        error: error.message,
      };
    }

    // Test 4: Search catalog (CORRECT v2 API)
    try {
      const search = await client.request('/v2/catalog/search?query=jordan&pageSize=5');
      results.tests.catalog_search = {
        success: true,
        endpoint: '/v2/catalog/search',
        count: search?.count || 0,
        sample: search?.products?.[0] || null,
      };
    } catch (error: any) {
      results.tests.catalog_search = {
        success: false,
        endpoint: '/v2/catalog/search',
        error: error.message,
      };
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Test failed',
        details: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
