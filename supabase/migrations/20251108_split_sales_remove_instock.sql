-- Migration: Split Sales from Inventory, Remove in_stock boolean
-- Date: 2025-11-08
-- Purpose: Use status enum exclusively, create sales_view for sold items

-- 1. Ensure status enum exists with correct values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_status') THEN
    CREATE TYPE item_status AS ENUM ('active', 'listed', 'worn', 'sold');
  END IF;
END$$;

-- 2. Items table: drop legacy boolean instock if it exists
ALTER TABLE items
  DROP COLUMN IF EXISTS instock;

-- 3. Ensure status column exists and uses enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='items' AND column_name='status'
  ) THEN
    ALTER TABLE items ADD COLUMN status item_status NOT NULL DEFAULT 'active';
  ELSE
    -- Convert existing text status to enum if needed
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='items' AND column_name='status' AND udt_name <> 'item_status'
    ) THEN
      ALTER TABLE items
        ALTER COLUMN status TYPE item_status USING status::item_status;
    END IF;
  END IF;
END$$;

-- 4. Create sales_view for sold items only
CREATE OR REPLACE VIEW sales_view
WITH (security_invoker = on) AS
SELECT
  i.id,
  i.user_id,
  i.sku,
  i.brand,
  i.model,
  i.variant,
  i.colorway,
  i.size_uk,
  i.size_alt,
  i.condition,
  i.category,
  i.purchase_price,
  i.purchase_date,
  i.tax,
  i.shipping,
  i.place_of_purchase,
  i.order_number,
  i.sold_price,
  i.sold_date,
  i.sold_platform,
  i.sold_fees,
  i.market_value,
  i.market_updated_at,
  i.market_meta,
  i.location,
  i.image_url,
  i.tags,
  i.watchlist_id,
  i.custom_market_value,
  i.notes,
  i.status,
  i.created_at,
  i.updated_at,
  -- Derived metrics
  (COALESCE(i.sold_price, 0) - COALESCE(i.purchase_price, 0) - COALESCE(i.tax, 0) - COALESCE(i.shipping, 0) - COALESCE(i.sold_fees, 0))::numeric(12,2) AS margin_gbp,
  CASE
    WHEN COALESCE(i.purchase_price, 0) + COALESCE(i.tax, 0) + COALESCE(i.shipping, 0) > 0
    THEN ((COALESCE(i.sold_price, 0) - COALESCE(i.purchase_price, 0) - COALESCE(i.tax, 0) - COALESCE(i.shipping, 0) - COALESCE(i.sold_fees, 0)) / (COALESCE(i.purchase_price, 0) + COALESCE(i.tax, 0) + COALESCE(i.shipping, 0)) * 100)::numeric(12,2)
    ELSE 0
  END AS margin_percent
FROM items i
WHERE i.status = 'sold';

-- 5. Create inventory_active_view for non-sold items
CREATE OR REPLACE VIEW inventory_active_view
WITH (security_invoker = on) AS
SELECT
  i.id,
  i.user_id,
  i.sku,
  i.brand,
  i.model,
  i.variant,
  i.colorway,
  i.size_uk,
  i.size_alt,
  i.condition,
  i.category,
  i.purchase_price,
  i.purchase_date,
  i.tax,
  i.shipping,
  i.place_of_purchase,
  i.order_number,
  i.market_value,
  i.market_updated_at,
  i.market_meta,
  i.location,
  i.image_url,
  i.tags,
  i.watchlist_id,
  i.custom_market_value,
  i.notes,
  i.status,
  i.created_at,
  i.updated_at,
  -- Derived metrics
  (COALESCE(i.market_value, i.custom_market_value, 0) - COALESCE(i.purchase_price, 0) - COALESCE(i.tax, 0) - COALESCE(i.shipping, 0))::numeric(12,2) AS unrealised_profit_gbp
FROM items i
WHERE i.status IN ('active', 'listed', 'worn');

-- 6. Ensure RLS is enabled and policies exist
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to recreate cleanly)
DROP POLICY IF EXISTS "Users can view own items" ON items;
DROP POLICY IF EXISTS "Users can insert own items" ON items;
DROP POLICY IF EXISTS "Users can update own items" ON items;
DROP POLICY IF EXISTS "Users can delete own items" ON items;

-- Recreate RLS policies
CREATE POLICY "Users can view own items"
  ON items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own items"
  ON items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own items"
  ON items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own items"
  ON items FOR DELETE
  USING (auth.uid() = user_id);

-- 7. Ensure views use security_invoker
ALTER VIEW sales_view SET (security_invoker = on);
ALTER VIEW inventory_active_view SET (security_invoker = on);

-- 8. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_user_status ON items(user_id, status);
CREATE INDEX IF NOT EXISTS idx_items_sold_date ON items(sold_date) WHERE status = 'sold';

-- 9. Comment documentation
COMMENT ON VIEW sales_view IS 'Shows only sold items with calculated margin metrics';
COMMENT ON VIEW inventory_active_view IS 'Shows only active inventory (active, listed, worn) excluding sold items';
COMMENT ON COLUMN items.status IS 'Item status: active (owned), listed (for sale), worn (used but owned), sold (completed transaction)';
