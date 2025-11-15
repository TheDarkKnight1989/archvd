// WHY: Dashboard "Refresh Prices" now enqueues jobs instead of calling provider APIs directly
// This respects rate limits and prevents UI failures from API errors
// Priority 200 = manual user refresh (highest priority)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TABLE_ITEMS } from '@/lib/portfolio/types';
import { enqueueForItems } from '@/lib/market/enqueue';

type InventoryItem = {
  id: string;
  sku: string;
  size_uk: string | null;
  category?: string;
};

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

    // Fetch all items for user with SKUs (active, listed, or worn status)
    const { data: items, error: fetchError } = await supabase
      .from(TABLE_ITEMS)
      .select('id, sku, size_uk, category')
      .eq('user_id', userId)
      .in('status', ['active', 'listed', 'worn'])
      .not('sku', 'is', null);

    if (fetchError) {
      throw new Error(`Failed to fetch items: ${fetchError.message}`);
    }

    if (!items || items.length === 0) {
      return NextResponse.json({
        enqueued: 0,
        message: 'No items with SKUs found',
      });
    }

    console.log(`[Refresh] Enqueuing ${items.length} items for user ${userId}`);

    // WHY: Enqueue all items with priority 200 (manual refresh = highest priority)
    // Never call provider APIs directly from UI - always use queue to respect rate limits
    const enqueued = await enqueueForItems(
      items.map(item => ({ sku: item.sku, size: item.size_uk })),
      {
        provider: 'stockx', // Default to StockX for now
        priority: 200, // High priority - user manually requested refresh
        userId,
      }
    );

    const alreadyQueued = items.length - enqueued;

    console.log(`[Refresh] Enqueued ${enqueued} jobs, ${alreadyQueued} already queued`);

    return NextResponse.json({
      enqueued,
      alreadyQueued,
      total: items.length,
      message: `Enqueued ${enqueued} price refresh jobs${alreadyQueued > 0 ? ` (${alreadyQueued} already queued)` : ''}. Prices will update in ~1-2 minutes.`,
    });

  } catch (error: any) {
    console.error('[Refresh] Error:', error.message);

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
