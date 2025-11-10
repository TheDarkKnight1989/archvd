import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * System Watchlist Refresh API (Service Role Only)
 * Refreshes all watchlist alerts across all users
 * Intended for cron jobs or scheduled tasks
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify service role key
    const authHeader = request.headers.get('authorization');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!authHeader || !serviceKey) {
      logger.error('[System Refresh Watchlists] Missing credentials', {
        hasAuth: !!authHeader,
        hasServiceKey: !!serviceKey,
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract bearer token
    const token = authHeader.replace('Bearer ', '');
    if (token !== serviceKey) {
      logger.error('[System Refresh Watchlists] Invalid service role key');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Create supabase client with service role
    const supabase = await createClient();

    // Call refresh_watchlist_alerts for all users (p_user_id = NULL)
    const { data, error } = await supabase.rpc('refresh_watchlist_alerts', {
      p_user_id: null
    });

    if (error) {
      logger.error('[System Refresh Watchlists] Error calling refresh function', {
        message: error.message,
      });
      throw error;
    }

    const result = data as {
      triggered_count: number;
      triggered_items: any[];
    };

    const triggeredCount = result?.triggered_count || 0;
    const triggeredItems = result?.triggered_items || [];

    // Calculate user breakdown
    const userBreakdown = triggeredItems.reduce((acc: any, item: any) => {
      acc[item.user_id] = (acc[item.user_id] || 0) + 1;
      return acc;
    }, {});

    const duration = Date.now() - startTime;
    logger.apiRequest('/api/system/refresh-watchlists',
      { system: true },
      duration,
      {
        triggeredCount,
        affectedUsers: Object.keys(userBreakdown).length,
      }
    );

    return NextResponse.json({
      success: true,
      triggered_count: triggeredCount,
      affected_users: Object.keys(userBreakdown).length,
      _meta: {
        duration_ms: duration,
      },
    });

  } catch (error: any) {
    logger.error('[System Refresh Watchlists] Error', {
      message: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
