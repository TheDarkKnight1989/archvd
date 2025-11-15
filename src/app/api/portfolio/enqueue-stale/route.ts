// WHY: Portfolio load should enqueue stale items (>6h old) with priority 100 (background)
// This ensures prices stay fresh without blocking the UI
// Debounced to run max once per hour per user

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TABLE_ITEMS } from '@/lib/portfolio/types';
import { enqueueForItems } from '@/lib/market/enqueue';

const STALE_THRESHOLD_HOURS = 6;

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: sessionData, error: authError } = await supabase.auth.getSession();

    if (authError || !sessionData.session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = sessionData.session.user.id;

    // WHY: Check if we've enqueued stale items for this user recently (debounce to 1 hour)
    // This prevents spamming the queue every time the user refreshes the page
    const { data: recentRun } = await supabase
      .from('market_jobs')
      .select('created_at')
      .eq('user_id', userId)
      .eq('priority', 100) // Background priority
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (recentRun) {
      const lastRunTime = new Date(recentRun.created_at).getTime();
      const oneHourAgo = Date.now() - (60 * 60 * 1000);

      if (lastRunTime > oneHourAgo) {
        // Already enqueued stale items recently, skip
        return NextResponse.json({
          enqueued: 0,
          message: 'Background refresh already scheduled',
          debounced: true,
        });
      }
    }

    // Fetch items with stale prices (older than 6 hours)
    const staleThreshold = new Date(Date.now() - (STALE_THRESHOLD_HOURS * 60 * 60 * 1000)).toISOString();

    const { data: items, error: fetchError } = await supabase
      .from(TABLE_ITEMS)
      .select('id, sku, size_uk')
      .eq('user_id', userId)
      .in('status', ['active', 'listed', 'worn'])
      .not('sku', 'is', null)
      .or(`market_price_updated_at.is.null,market_price_updated_at.lt.${staleThreshold}`);

    if (fetchError) {
      throw new Error(`Failed to fetch items: ${fetchError.message}`);
    }

    if (!items || items.length === 0) {
      return NextResponse.json({
        enqueued: 0,
        message: 'No stale prices found',
      });
    }

    console.log(`[Enqueue Stale] Found ${items.length} items with stale prices for user ${userId}`);

    // WHY: Enqueue with priority 100 (background refresh = lowest priority)
    // These will be processed after manual refreshes (200) and hot items (150)
    const enqueued = await enqueueForItems(
      items.map(item => ({ sku: item.sku, size: item.size_uk })),
      {
        provider: 'stockx',
        priority: 100, // Background priority
        userId,
      }
    );

    console.log(`[Enqueue Stale] Enqueued ${enqueued} stale items`);

    return NextResponse.json({
      enqueued,
      total: items.length,
      message: `Background refresh scheduled for ${enqueued} items`,
    });

  } catch (error: any) {
    console.error('[Enqueue Stale] Error:', error.message);

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
