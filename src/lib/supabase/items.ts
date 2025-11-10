'use client';

import { supabase } from '@/lib/supabase/client';
import type { NewItemInput } from '@/lib/validation/item';
import type { NormalisedRow } from '@/lib/import/types';

const TABLE = 'Inventory';

export async function insertItem(input: NewItemInput) {
  // 1) Get session user (RLS requires user_id match)
  const { data: { session }, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) throw sessErr;
  const userId = session?.user?.id;
  if (!userId) throw new Error('Not authenticated');

  // 2) Normalize payload to DB columns
  const row = {
    user_id: userId,
    sku: input.sku,
    brand: input.brand ?? null,
    model: input.model ?? null,
    colorway: input.colorway ?? null,
    style_id: input.style_id ?? null,
    // name is stored as model when present; keep "name" only for UI
    size: input.size_uk ?? null, // legacy column compatibility
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
    watchlist_id: input.watchlist_id ?? null,
    custom_market_value: input.custom_market_value ?? null,
    notes: input.notes ?? null,
    status: 'active',
  };

  // purchase_total is a generated column in the DB

  const { data, error } = await supabase
    .from(TABLE)
    .insert(row)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function insertBatch(
  inputs: NormalisedRow[],
  importBatchId: string,
  userId: string
) {
  // Fetch user's base currency
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('base_currency')
    .eq('id', userId)
    .single();

  if (profileError) {
    console.error('[insertBatch] Profile fetch error:', profileError);
  }

  const baseCurrency = profile?.base_currency || 'GBP';

  // Map NormalisedRow to DB rows with FX snapshots
  const rowsWithFX = await Promise.all(inputs.map(async (input) => {
    const purchasePrice = input.purchase_price ?? 0;
    const purchaseDate = input.purchase_date ? new Date(input.purchase_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const purchaseCurrency = 'GBP'; // Default to GBP for CSV imports, can be made configurable later

    // Calculate FX rate using database function
    let fxRate = 1.0;
    let amountBase = purchasePrice;

    try {
      const { data: fxData, error: fxError } = await supabase
        .rpc('fx_rate_for', {
          date_in: purchaseDate,
          from_ccy: purchaseCurrency,
          to_ccy: baseCurrency
        });

      if (!fxError && fxData) {
        fxRate = fxData;
        amountBase = purchasePrice * fxRate;
      }
    } catch (err) {
      console.error('[insertBatch] FX rate calculation error:', err);
      // Continue with default rate if FX calculation fails
    }

    return {
      user_id: userId,
      sku: input.sku,
      brand: input.brand ?? null,
      model: input.model ?? null,
      colorway: null,
      style_id: null,
      size: input.size_uk?.toString() ?? null,
      size_uk: input.size_uk?.toString() ?? null,
      size_alt: null,
      category: 'sneaker',
      condition: input.condition === 'deadstock' ? 'New' : input.condition === 'worn' ? 'Worn' : null,
      purchase_price: purchasePrice,
      tax: null,
      shipping: null,
      place_of_purchase: input.location ?? null,
      order_number: null,
      tags: null,
      watchlist_id: null,
      custom_market_value: null,
      notes: null,
      status: input.status ?? 'active',
      // FX snapshot fields
      purchase_currency: purchaseCurrency,
      purchase_date: purchaseDate,
      purchase_base_ccy: baseCurrency,
      purchase_fx_rate: fxRate,
      purchase_amount_base: amountBase,
      purchase_fx_source: 'auto',
    };
  }));

  const { data, error } = await supabase
    .from(TABLE)
    .insert(rowsWithFX)
    .select('*');

  if (error) throw error;

  return {
    inserted: data?.length ?? 0,
    skipped: 0,
    importBatchId,
  };
}

export async function listWatchlists() {
  const { data, error } = await supabase
    .from('watchlists')
    .select('id, name')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
