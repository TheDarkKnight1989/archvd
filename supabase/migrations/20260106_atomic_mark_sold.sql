-- Atomic Mark as Sold Migration
-- Creates RPCs for atomic item-to-sale transitions

-- 1. Add unique constraint on original_item_id to prevent duplicate sales
ALTER TABLE inventory_v4_sales
  ADD CONSTRAINT inventory_v4_sales_original_item_id_unique
  UNIQUE (original_item_id);

-- 2. RPC: Atomic Mark as Sold
-- Deletes item from inventory_v4_items and inserts into inventory_v4_sales
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
AS $$
DECLARE
  v_item RECORD;
  v_style RECORD;
  v_sale_id UUID;
  v_condition TEXT;
  v_sold_price_base NUMERIC;
BEGIN
  -- Fetch item with style catalog
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

  -- Validate item exists
  IF v_item.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_FOUND_V4_ITEM',
      'message', 'Item not found in inventory'
    );
  END IF;

  -- Validate ownership
  IF v_item.user_id != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'FORBIDDEN',
      'message', 'You do not own this item'
    );
  END IF;

  -- Check if already sold (idempotent)
  IF EXISTS (SELECT 1 FROM inventory_v4_sales WHERE original_item_id = p_item_id) THEN
    SELECT id INTO v_sale_id FROM inventory_v4_sales WHERE original_item_id = p_item_id;
    RETURN jsonb_build_object(
      'success', true,
      'already_sold', true,
      'sale_id', v_sale_id,
      'message', 'Item already marked as sold'
    );
  END IF;

  -- Map condition: lowercase (items) -> Title case (sales)
  v_condition := CASE v_item.condition
    WHEN 'new' THEN 'New'
    WHEN 'used' THEN 'Used'
    WHEN 'deadstock' THEN 'New'
    WHEN 'worn' THEN 'Worn'
    WHEN 'defect' THEN 'Defect'
    ELSE NULL
  END;

  -- Calculate base amount
  v_sold_price_base := p_sold_price * p_fx_rate;

  -- Insert into sales
  INSERT INTO inventory_v4_sales (
    user_id,
    style_id,
    sku,
    brand,
    model,
    colorway,
    image_url,
    category,
    size,
    size_unit,
    purchase_price,
    purchase_currency,
    purchase_date,
    purchase_total,
    condition,
    sold_price,
    sale_currency,
    sold_date,
    platform,
    sales_fee,
    shipping_cost,
    base_currency,
    fx_rate_to_base,
    sold_price_base,
    notes,
    original_item_id,
    location
  ) VALUES (
    p_user_id,
    v_item.style_id,
    v_item.style_id,
    v_item.brand,
    v_item.name,
    v_item.colorway,
    v_item.primary_image_url,
    v_item.product_category,
    COALESCE(v_item.size, 'N/A'),
    'UK',
    v_item.purchase_price,
    COALESCE(v_item.purchase_currency, 'GBP'),
    v_item.purchase_date,
    v_item.purchase_price,
    v_condition,
    p_sold_price,
    p_sale_currency,
    p_sold_date,
    p_platform,
    p_sales_fee,
    p_shipping_cost,
    p_base_currency,
    p_fx_rate,
    v_sold_price_base,
    p_notes,
    p_item_id,
    v_item.consignment_location
  )
  RETURNING id INTO v_sale_id;

  -- Delete from inventory
  DELETE FROM inventory_v4_items WHERE id = p_item_id;

  -- Also delete any listings for this item
  DELETE FROM inventory_v4_listings WHERE item_id = p_item_id;

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'item_id', p_item_id,
    'message', 'Item moved to sales'
  );
END;
$$;

-- 3. RPC: Atomic Undo Sold
-- Deletes sale from inventory_v4_sales and re-inserts into inventory_v4_items
CREATE OR REPLACE FUNCTION undo_item_sold(
  p_sale_id UUID,
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale RECORD;
  v_new_item_id UUID;
  v_condition TEXT;
BEGIN
  -- Fetch sale record
  SELECT * INTO v_sale
  FROM inventory_v4_sales
  WHERE id = p_sale_id;

  -- Validate sale exists
  IF v_sale.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_FOUND_SALE',
      'message', 'Sale record not found'
    );
  END IF;

  -- Validate ownership
  IF v_sale.user_id != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'FORBIDDEN',
      'message', 'You do not own this sale'
    );
  END IF;

  -- Map condition back: Title case (sales) -> lowercase (items)
  v_condition := CASE v_sale.condition
    WHEN 'New' THEN 'new'
    WHEN 'Used' THEN 'used'
    WHEN 'Worn' THEN 'used'
    WHEN 'Defect' THEN 'used'
    ELSE 'new'
  END;

  -- Determine item ID: prefer original_item_id, but generate new if it's taken
  -- This allows undo even if user re-added the item or had duplicates
  IF v_sale.original_item_id IS NOT NULL AND
     NOT EXISTS (SELECT 1 FROM inventory_v4_items WHERE id = v_sale.original_item_id) THEN
    -- Original ID is free, use it for clean restore
    v_new_item_id := v_sale.original_item_id;
  ELSE
    -- Original ID is taken or null, generate new
    v_new_item_id := gen_random_uuid();
  END IF;

  -- Re-insert into inventory
  INSERT INTO inventory_v4_items (
    id,
    user_id,
    style_id,
    size,
    purchase_price,
    purchase_currency,
    purchase_date,
    condition,
    consignment_location,
    notes,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_new_item_id,
    p_user_id,
    v_sale.style_id,
    v_sale.size,
    v_sale.purchase_price,
    COALESCE(v_sale.purchase_currency, 'GBP'),
    v_sale.purchase_date,
    v_condition,
    v_sale.location,
    v_sale.notes,
    'in_stock',
    NOW(),
    NOW()
  );

  -- Delete from sales
  DELETE FROM inventory_v4_sales WHERE id = p_sale_id;

  RETURN jsonb_build_object(
    'success', true,
    'item_id', v_new_item_id,
    'sale_id', p_sale_id,
    'message', 'Sale undone, item restored to inventory'
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION mark_item_sold TO authenticated;
GRANT EXECUTE ON FUNCTION undo_item_sold TO authenticated;
