/**
 * StockX Status
 * Returns connection status and sync timestamps
 * GET /api/stockx/status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // Check if StockX is enabled
    if (process.env.NEXT_PUBLIC_STOCKX_ENABLE !== 'true') {
      return NextResponse.json({
        connected: false,
        mode: 'disabled',
        lastSyncListings: null,
        lastSyncSales: null,
        lastSyncPrices: null,
        accountEmail: null,
      });
    }

    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        connected: false,
        mode: process.env.NEXT_PUBLIC_STOCKX_MOCK === 'true' ? 'mock' : 'disabled',
        lastSyncListings: null,
        lastSyncSales: null,
        lastSyncPrices: null,
        accountEmail: null,
      });
    }

    // Check if user has connected StockX account
    const { data: account, error: accountError } = await supabase
      .from('stockx_accounts')
      .select('account_email, created_at, updated_at')
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json({
        connected: false,
        mode: process.env.NEXT_PUBLIC_STOCKX_MOCK === 'true' ? 'mock' : 'disabled',
        lastSyncListings: null,
        lastSyncSales: null,
        lastSyncPrices: null,
        accountEmail: null,
      });
    }

    // Get last sync timestamps (from market prices, sales, and product links)
    const { data: lastPriceSync } = await supabase
      .from('stockx_market_prices')
      .select('as_of')
      .order('as_of', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: lastSaleSync } = await supabase
      .from('stockx_sales')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: lastListingsSync } = await supabase
      .from('inventory_market_links')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      connected: true,
      mode: process.env.NEXT_PUBLIC_STOCKX_MOCK === 'true' ? 'mock' : 'live',
      lastSyncListings: lastListingsSync?.updated_at || null,
      lastSyncSales: lastSaleSync?.created_at || null,
      lastSyncPrices: lastPriceSync?.as_of || null,
      accountEmail: account.account_email,
    });

  } catch (error: any) {
    console.error('[StockX Status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch StockX status', details: error.message },
      { status: 500 }
    );
  }
}
