/**
 * StockX OAuth Disconnect
 * Removes stored tokens and disconnects StockX account
 * POST /api/stockx/oauth/disconnect
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Delete StockX account record
    // Use service role client to bypass RLS - ensures delete actually happens
    const adminSupabase = createServiceRoleClient();
    const { error: deleteError } = await adminSupabase
      .from('stockx_accounts')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      logger.error('[StockX OAuth Disconnect] Database error', {
        error: deleteError.message,
        userId: user.id,
      });

      return NextResponse.json(
        { error: 'Failed to disconnect StockX account', details: deleteError.message },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;

    logger.apiRequest(
      '/api/stockx/oauth/disconnect',
      { userId: user.id },
      duration,
      { success: true }
    );

    return NextResponse.json(
      { success: true, message: 'StockX account disconnected successfully' },
      { status: 200 }
    );

  } catch (error: any) {
    logger.error('[StockX OAuth Disconnect] Unexpected error', {
      message: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      { error: 'Failed to disconnect StockX account', details: error.message },
      { status: 500 }
    );
  }
}
