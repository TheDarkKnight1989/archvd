// Full market value refresh API (server-only)
// Refreshes all sneaker inventory for authenticated user

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fullLookup } from '@/lib/pricing';
import { TABLE_ITEMS } from '@/lib/portfolio/types';

type InventoryItem = {
  id: string;
  sku: string;
  category?: string;
  brand: string;
  model: string;
  market_value?: number | null;
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
      .select('id, sku, category, brand, model, market_value')
      .eq('user_id', userId)
      .in('status', ['active', 'listed', 'worn'])
      .not('sku', 'is', null);

    if (fetchError) {
      throw new Error(`Failed to fetch items: ${fetchError.message}`);
    }

    if (!items || items.length === 0) {
      return NextResponse.json({
        updated: 0,
        message: 'No sneaker items with SKUs found',
      });
    }

    console.log(`[Refresh] Processing ${items.length} sneaker items for user ${userId}`);

    let updated = 0;
    const errors: string[] = [];

    // Process in batches of 20
    const BATCH_SIZE = 20;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);

      for (const item of batch) {
        try {
          console.log(`[Refresh] Looking up SKU: ${item.sku}`);

          // Perform full lookup
          const result = await fullLookup(item.sku, item.category as any);

          if (!result.aggregated) {
            console.log(`[Refresh] No price data for SKU: ${item.sku}`);
            continue;
          }

          const { price, sources_used, confidence } = result.aggregated;

          // Update inventory item
          const { error: updateError } = await supabase
            .from(TABLE_ITEMS)
            .update({
              market_value: price,
              market_updated_at: new Date().toISOString(),
              market_meta: {
                sources_used,
                confidence,
              },
            })
            .eq('id', item.id);

          if (updateError) {
            errors.push(`${item.sku}: ${updateError.message}`);
            continue;
          }

          // Insert snapshot
          const today = new Date().toISOString().split('T')[0];
          const { error: snapshotError } = await supabase
            .from('item_valuation_snapshots')
            .upsert(
              {
                item_id: item.id,
                value: price,
                as_of: today,
                meta: {
                  sources_used,
                  confidence,
                  sku: item.sku,
                  brand: item.brand,
                  model: item.model,
                },
              },
              {
                onConflict: 'item_id,as_of',
              }
            );

          if (snapshotError) {
            console.error(`[Refresh] Snapshot error for ${item.sku}:`, snapshotError.message);
            // Don't fail entire operation if snapshot fails
          }

          updated++;
          console.log(`[Refresh] Updated ${item.sku}: £${price.toFixed(2)}`);

          // Rate limit: 2 seconds between items
          if (batch.indexOf(item) < batch.length - 1 || i + BATCH_SIZE < items.length) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

        } catch (itemError: any) {
          console.error(`[Refresh] Error processing ${item.sku}:`, itemError.message);
          errors.push(`${item.sku}: ${itemError.message}`);
        }
      }
    }

    // Calculate portfolio snapshot (daily total)
    const { data: allItems } = await supabase
      .from(TABLE_ITEMS)
      .select('market_value, sale_price, purchase_price')
      .eq('user_id', userId)
      .in('status', ['active', 'listed', 'worn']);

    const portfolioValue = (allItems || []).reduce((sum, item) => {
      const value = item.market_value || item.sale_price || item.purchase_price || 0;
      return sum + value;
    }, 0);

    // Store daily portfolio snapshot
    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('portfolio_snapshots')
      .upsert(
        {
          user_id: userId,
          as_of: today,
          total_value: portfolioValue,
          item_count: allItems?.length || 0,
        },
        {
          onConflict: 'user_id,as_of',
        }
      );

    return NextResponse.json({
      updated,
      total: items.length,
      portfolioValue,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully updated ${updated} of ${items.length} items`,
    });

  } catch (error: any) {
    console.error('[Refresh] Error:', error.message);

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
