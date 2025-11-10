import { NextResponse } from 'next/server';
import { z } from 'zod';
import { itemSchema } from '@/lib/validation/item';
import { createClient } from '@/lib/supabase/server';

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

    return NextResponse.json({ ok: true, item: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}
