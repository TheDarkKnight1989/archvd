import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * Portfolio Activity Feed API
 * Returns recent portfolio activity events for the authenticated user
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch recent activity
    const { data: activities, error: activityError } = await supabase
      .from('portfolio_activity_log')
      .select('id, type, sku, item_name, message, metadata, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 50)); // Max 50 items

    if (activityError) {
      logger.error('[Portfolio Activity] Error fetching activity', {
        message: activityError.message,
        user_id: user.id,
      });
      throw activityError;
    }

    // Calculate type breakdown
    const typeBreakdown = (activities || []).reduce((acc: any, activity: any) => {
      acc[activity.type] = (acc[activity.type] || 0) + 1;
      return acc;
    }, {});

    const duration = Date.now() - startTime;
    logger.apiRequest('/api/portfolio/activity',
      { user_id: user.id, limit },
      duration,
      {
        activityCount: activities?.length || 0,
        typeBreakdown,
      }
    );

    return NextResponse.json({
      activities: activities || [],
      count: activities?.length || 0,
      _meta: {
        duration_ms: duration,
        limit,
      },
    });

  } catch (error: any) {
    logger.error('[Portfolio Activity] Error', {
      message: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
