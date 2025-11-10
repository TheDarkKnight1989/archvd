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

    // Test 1: Try to get user profile
    try {
      const profile = await client.request('/api/v1/users/me');
      results.tests.user_profile = {
        success: true,
        endpoint: '/api/v1/users/me',
        data: profile,
      };
    } catch (error: any) {
      results.tests.user_profile = {
        success: false,
        endpoint: '/api/v1/users/me',
        error: error.message,
      };
    }

    // Test 2: Try to list inventory/listings
    try {
      const listings = await client.request('/api/v1/users/me/listings');
      results.tests.listings = {
        success: true,
        endpoint: '/api/v1/users/me/listings',
        count: Array.isArray(listings?.data) ? listings.data.length : 0,
        sample: Array.isArray(listings?.data) ? listings.data[0] : listings,
      };
    } catch (error: any) {
      results.tests.listings = {
        success: false,
        endpoint: '/api/v1/users/me/listings',
        error: error.message,
      };
    }

    // Test 3: Try to list orders/sales
    try {
      const orders = await client.request('/api/v1/users/me/orders');
      results.tests.orders = {
        success: true,
        endpoint: '/api/v1/users/me/orders',
        count: Array.isArray(orders?.data) ? orders.data.length : 0,
        sample: Array.isArray(orders?.data) ? orders.data[0] : orders,
      };
    } catch (error: any) {
      results.tests.orders = {
        success: false,
        endpoint: '/api/v1/users/me/orders',
        error: error.message,
      };
    }

    // Test 4: Try alternate endpoints
    const alternateEndpoints = [
      '/api/v1/inventory',
      '/api/v1/sales',
      '/api/v1/portfolio',
      '/v2/users/me',
      '/v2/inventory',
    ];

    results.tests.alternates = {};
    for (const endpoint of alternateEndpoints) {
      try {
        const response = await client.request(endpoint);
        results.tests.alternates[endpoint] = {
          success: true,
          response: response,
        };
      } catch (error: any) {
        results.tests.alternates[endpoint] = {
          success: false,
          error: error.message,
        };
      }
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
