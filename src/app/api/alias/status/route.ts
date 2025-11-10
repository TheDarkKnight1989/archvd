/**
 * Alias Status API
 * GET /api/alias/status
 * Returns Alias integration connection status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAliasEnabled, getAliasMode } from '@/lib/config/alias';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // 1. Check if Alias is enabled
    if (!isAliasEnabled()) {
      return NextResponse.json({
        enabled: false,
        mode: 'disabled',
        connected: false,
        lastSync: null,
        username: null,
        listings: 0,
        orders: 0,
      });
    }

    // 2. Get mode
    const mode = getAliasMode();

    // 3. Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          enabled: true,
          mode,
          connected: false,
          lastSync: null,
          username: null,
          listings: 0,
          orders: 0,
        },
        { status: 200 }
      );
    }

    // 4. Check connection status
    if (mode === 'mock') {
      // In mock mode, check if user has any mock listings/orders
      const { count: listingsCount } = await supabase
        .from('alias_listings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const { count: ordersCount } = await supabase
        .from('alias_orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      return NextResponse.json({
        enabled: true,
        mode: 'mock',
        connected: true, // Always connected in mock mode
        lastSync: new Date().toISOString(),
        username: 'Mock User',
        listings: listingsCount || 0,
        orders: ordersCount || 0,
      });
    }

    // 5. Live mode - check alias_accounts table
    const { data: aliasAccount, error: accountError } = await supabase
      .from('alias_accounts')
      .select('id, status, last_sync_at, alias_username')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (accountError || !aliasAccount) {
      return NextResponse.json({
        enabled: true,
        mode: 'live',
        connected: false,
        lastSync: null,
        username: null,
        listings: 0,
        orders: 0,
      });
    }

    // 6. Get stats
    const { count: listingsCount } = await supabase
      .from('alias_listings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'active');

    const { count: ordersCount } = await supabase
      .from('alias_orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    return NextResponse.json({
      enabled: true,
      mode: 'live',
      connected: true,
      lastSync: aliasAccount.last_sync_at,
      username: aliasAccount.alias_username || null,
      listings: listingsCount || 0,
      orders: ordersCount || 0,
    });
  } catch (error: any) {
    logger.error('[API /alias/status] Error', {
      error: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error.message || 'Failed to fetch Alias status',
      },
      { status: 500 }
    );
  }
}
