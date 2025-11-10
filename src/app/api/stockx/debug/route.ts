/**
 * StockX Debug Endpoint
 * Check if configuration is loaded correctly
 * GET /api/stockx/debug
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check environment variables
    const config = {
      NEXT_PUBLIC_STOCKX_ENABLE: process.env.NEXT_PUBLIC_STOCKX_ENABLE,
      NEXT_PUBLIC_STOCKX_MOCK: process.env.NEXT_PUBLIC_STOCKX_MOCK,
      STOCKX_API_BASE_URL: process.env.STOCKX_API_BASE_URL,
      STOCKX_CLIENT_ID: process.env.STOCKX_CLIENT_ID ? `${process.env.STOCKX_CLIENT_ID.slice(0, 8)}...` : '(not set)',
      STOCKX_CLIENT_SECRET: process.env.STOCKX_CLIENT_SECRET ? '***set***' : '(not set)',
      STOCKX_API_KEY: process.env.STOCKX_API_KEY ? `${process.env.STOCKX_API_KEY.slice(0, 8)}...${process.env.STOCKX_API_KEY.slice(-4)}` : '(not set)',
      STOCKX_OAUTH_TOKEN_URL: process.env.STOCKX_OAUTH_TOKEN_URL,
    };

    return NextResponse.json({
      environment: config,
      user_id: user.id,
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Debug failed',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
