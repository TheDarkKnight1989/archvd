#!/usr/bin/env node
/**
 * Apply Atomic Mark Sold Migration
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function run() {
  console.log('Applying atomic mark-sold migration...\n')

  // Step 1: Add unique constraint
  console.log('1. Adding unique constraint on original_item_id...')
  const { error: err1 } = await supabase.rpc('exec_raw_sql', {
    sql: `
      ALTER TABLE inventory_v4_sales
      ADD CONSTRAINT inventory_v4_sales_original_item_id_unique
      UNIQUE (original_item_id);
    `
  })
  if (err1) {
    if (err1.message?.includes('already exists')) {
      console.log('   Constraint already exists (OK)')
    } else {
      console.log('   Error:', err1.message)
    }
  } else {
    console.log('   Done')
  }

  // Step 2: Create mark_item_sold function
  console.log('\n2. Creating mark_item_sold RPC...')
  const markSoldSQL = `
CREATE OR REPLACE FUNCTION mark_item_sold(
  p_item_id UUID,
  p_user_id UUID,
  p_sold_price NUMERIC,
  p_sold_date DATE,
  p_sale_currency TEXT DEFAULT 'GBP',
  p_platform TEXT DEFAULT NULL,
  p_sales_fee NUMERIC DEFAULT 0,
  p_shipping_cost NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL,
  p_fx_rate NUMERIC DEFAULT 1.0,
  p_base_currency TEXT DEFAULT 'GBP'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_item RECORD;
  v_sale_id UUID;
  v_condition TEXT;
  v_sold_price_base NUMERIC;
BEGIN
  SELECT
    i.*,
    s.brand,
    s.name,
    s.colorway,
    s.primary_image_url,
    s.product_category
  INTO v_item
  FROM inventory_v4_items i
  LEFT JOIN inventory_v4_style_catalog s ON s.style_id = i.style_id
  WHERE i.id = p_item_id;

  IF v_item.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND_V4_ITEM', 'message', 'Item not found');
  END IF;

  IF v_item.user_id != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'You do not own this item');
  END IF;

  IF EXISTS (SELECT 1 FROM inventory_v4_sales WHERE original_item_id = p_item_id) THEN
    SELECT id INTO v_sale_id FROM inventory_v4_sales WHERE original_item_id = p_item_id;
    RETURN jsonb_build_object('success', true, 'already_sold', true, 'sale_id', v_sale_id);
  END IF;

  v_condition := CASE v_item.condition
    WHEN 'new' THEN 'New'
    WHEN 'used' THEN 'Used'
    WHEN 'deadstock' THEN 'New'
    WHEN 'worn' THEN 'Worn'
    WHEN 'defect' THEN 'Defect'
    ELSE NULL
  END;

  v_sold_price_base := p_sold_price * p_fx_rate;

  INSERT INTO inventory_v4_sales (
    user_id, style_id, sku, brand, model, colorway, image_url, category,
    size, size_unit, purchase_price, purchase_currency, purchase_date, purchase_total,
    condition, sold_price, sale_currency, sold_date, platform, sales_fee, shipping_cost,
    base_currency, fx_rate_to_base, sold_price_base, notes, original_item_id, location
  ) VALUES (
    p_user_id, v_item.style_id, v_item.style_id, v_item.brand, v_item.name, v_item.colorway,
    v_item.primary_image_url, v_item.product_category, COALESCE(v_item.size, 'N/A'), 'UK',
    v_item.purchase_price, COALESCE(v_item.purchase_currency, 'GBP'), v_item.purchase_date,
    v_item.purchase_price, v_condition, p_sold_price, p_sale_currency, p_sold_date, p_platform,
    p_sales_fee, p_shipping_cost, p_base_currency, p_fx_rate, v_sold_price_base, p_notes,
    p_item_id, v_item.consignment_location
  )
  RETURNING id INTO v_sale_id;

  DELETE FROM inventory_v4_items WHERE id = p_item_id;
  DELETE FROM inventory_v4_listings WHERE item_id = p_item_id;

  RETURN jsonb_build_object('success', true, 'sale_id', v_sale_id, 'item_id', p_item_id, 'message', 'Item moved to sales');
END;
$func$;
  `
  const { error: err2 } = await supabase.rpc('exec_raw_sql', { sql: markSoldSQL })
  if (err2) {
    console.log('   Error:', err2.message)
  } else {
    console.log('   Done')
  }

  // Step 3: Create undo_item_sold function
  console.log('\n3. Creating undo_item_sold RPC...')
  const undoSoldSQL = `
CREATE OR REPLACE FUNCTION undo_item_sold(
  p_sale_id UUID,
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_sale RECORD;
  v_new_item_id UUID;
  v_condition TEXT;
BEGIN
  SELECT * INTO v_sale FROM inventory_v4_sales WHERE id = p_sale_id;

  IF v_sale.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND_SALE', 'message', 'Sale not found');
  END IF;

  IF v_sale.user_id != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'You do not own this sale');
  END IF;

  v_condition := CASE v_sale.condition
    WHEN 'New' THEN 'new'
    WHEN 'Used' THEN 'used'
    WHEN 'Worn' THEN 'used'
    WHEN 'Defect' THEN 'used'
    ELSE 'new'
  END;

  -- Prefer original_item_id, but generate new if it's taken
  IF v_sale.original_item_id IS NOT NULL AND
     NOT EXISTS (SELECT 1 FROM inventory_v4_items WHERE id = v_sale.original_item_id) THEN
    v_new_item_id := v_sale.original_item_id;
  ELSE
    v_new_item_id := gen_random_uuid();
  END IF;

  INSERT INTO inventory_v4_items (
    id, user_id, style_id, size, purchase_price, purchase_currency, purchase_date,
    condition, consignment_location, notes, status, created_at, updated_at
  ) VALUES (
    v_new_item_id, p_user_id, v_sale.style_id, v_sale.size, v_sale.purchase_price,
    COALESCE(v_sale.purchase_currency, 'GBP'), v_sale.purchase_date, v_condition,
    v_sale.location, v_sale.notes, 'in_stock', NOW(), NOW()
  );

  DELETE FROM inventory_v4_sales WHERE id = p_sale_id;

  RETURN jsonb_build_object('success', true, 'item_id', v_new_item_id, 'sale_id', p_sale_id, 'message', 'Item restored');
END;
$func$;
  `
  const { error: err3 } = await supabase.rpc('exec_raw_sql', { sql: undoSoldSQL })
  if (err3) {
    console.log('   Error:', err3.message)
  } else {
    console.log('   Done')
  }

  // Step 4: Grant permissions
  console.log('\n4. Granting permissions...')
  const { error: err4 } = await supabase.rpc('exec_raw_sql', {
    sql: `
      GRANT EXECUTE ON FUNCTION mark_item_sold TO authenticated;
      GRANT EXECUTE ON FUNCTION undo_item_sold TO authenticated;
    `
  })
  if (err4) {
    console.log('   Error:', err4.message)
  } else {
    console.log('   Done')
  }

  console.log('\n=== Migration Complete ===')
}

run().catch(console.error)
