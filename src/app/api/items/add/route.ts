import { NextResponse } from 'next/server';
import { z } from 'zod';
import { itemSchema } from '@/lib/validation/item';
import { createClient } from '@/lib/supabase/server';
import { enqueueJob } from '@/lib/market/enqueue';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    // Auth guard
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse body
    const body = await req.json();
    const parsed = itemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.flatten() }, { status: 400 });
    }
    const input = parsed.data;

    // Build DB row (mirror insertItem logic server-side)
    const row = {
      user_id: session.user.id,
      sku: input.sku,
      brand: input.brand ?? null,
      model: input.model ?? null,
      colorway: input.colorway ?? null,
      style_id: input.style_id ?? null,
      size: input.size_uk ?? null,
      size_uk: input.size_uk ?? null,
      size_alt: input.size_alt ?? null,
      category: input.category ?? 'sneaker',
      condition: input.condition ?? null,
      purchase_price: input.purchase_price ?? 0,
      tax: input.tax ?? null,
      shipping: input.shipping ?? null,
      place_of_purchase: input.place_of_purchase ?? null,
      purchase_date: input.purchase_date ? new Date(input.purchase_date) : null,
      order_number: input.order_number ?? null,
      tags: input.tags ?? null,
      custom_market_value: input.custom_market_value ?? null,
      notes: input.notes ?? null,
      status: 'active',
    };

    const { data, error } = await supabase
      .from('Inventory')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      // Surface RLS/constraint issues cleanly
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }

    // Create purchase transaction record
    if (input.purchase_price && input.purchase_date) {
      const title = [input.brand, input.model, input.colorway]
        .filter(Boolean)
        .join(' ')

      const totalCost = (input.purchase_price || 0) + (input.tax || 0) + (input.shipping || 0)

      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: session.user.id,
          type: 'purchase',
          inventory_id: data.id,
          sku: input.sku || null,
          size_uk: input.size_uk || null,
          title: title || null,
          image_url: null, // Will be resolved by image fallback chain later
          qty: 1,
          unit_price: input.purchase_price,
          fees: (input.tax || 0) + (input.shipping || 0), // Combine tax+shipping as fees
          platform: input.place_of_purchase || null,
          notes: input.notes || null,
          occurred_at: input.purchase_date,
        })

      if (transactionError) {
        console.error('[Add Item] Transaction creation error:', transactionError)
        // Don't fail the request if transaction creation fails, just log the error
      }
    }

    // Note: inventory_market_links is now StockX-specific and should only be created
    // when the user explicitly maps an item to StockX, not automatically on item creation

    // WHY: Enqueue market data fetch for this item (priority 150 = hot, user just added)
    // Never call provider APIs directly from UI - always use queue to respect rate limits
    if (data.sku && data.size_uk) {
      await enqueueJob({
        provider: 'stockx', // Default to StockX for now
        sku: data.sku,
        size: data.size_uk,
        priority: 150, // Hot priority - user just added this item
        userId: session.user.id,
      });
    }

    return NextResponse.json({ ok: true, item: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}
