import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * Watchlist Check Targets API
 * Checks all watchlist items against current market prices and triggers alerts
 * POST /api/watchlists/check-targets
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call refresh_watchlist_alerts function for current user
    const { data, error } = await supabase.rpc('refresh_watchlist_alerts', {
      p_user_id: user.id
    });

    if (error) {
      logger.error('[Watchlist Check Targets] Error calling refresh function', {
        message: error.message,
        user_id: user.id,
      });
      throw error;
    }

    const result = data as {
      triggered_count: number;
      triggered_items: Array<{
        id: string;
        user_id: string;
        sku: string;
        size: string | null;
        watchlist_name: string;
        target_price: number;
        current_price: number;
        delta_pct: number;
        currency: string;
        previously_triggered: boolean;
      }>;
    };

    const triggeredCount = result?.triggered_count || 0;
    const triggeredItems = result?.triggered_items || [];

    // Calculate category breakdown
    const categoryBreakdown = triggeredItems.reduce((acc: any, item: any) => {
      const category = item.sku.startsWith('PKMN-') ? 'pokemon' : 'sneaker';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    // Log API request
    const duration = Date.now() - startTime;
    logger.apiRequest('/api/watchlists/check-targets',
      { user_id: user.id },
      duration,
      {
        triggeredCount,
        categoryBreakdown,
        newAlertsCount: triggeredItems.filter((i: any) => !i.previously_triggered).length,
      }
    );

    return NextResponse.json({
      success: true,
      triggered_count: triggeredCount,
      triggered_items: triggeredItems,
      _meta: {
        duration_ms: duration,
      },
    });

  } catch (error: any) {
    logger.error('[Watchlist Check Targets] Error', {
      message: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
