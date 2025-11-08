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

-- 2. Drop legacy boolean instock if it exists
ALTER TABLE "Inventory"
  DROP COLUMN IF EXISTS instock;

-- 3. Drop dependent views temporarily (they'll be recreated later in this migration)
DROP VIEW IF EXISTS profit_loss_monthly_view CASCADE;
DROP VIEW IF EXISTS vat_margin_monthly_view CASCADE;
DROP VIEW IF EXISTS vat_margin_detail_view CASCADE;

-- 4. Create a new TEXT column, copy status values, drop old column (avoids all constraint issues)
ALTER TABLE "Inventory" ADD COLUMN status_new TEXT;
UPDATE "Inventory" SET status_new = status::text;
ALTER TABLE "Inventory" DROP COLUMN status;
ALTER TABLE "Inventory" RENAME COLUMN status_new TO status;

-- 5. Update status values to match new enum
UPDATE "Inventory" SET status = 'active' WHERE status IN ('in_stock', 'deadstock', 'reserved');
UPDATE "Inventory" SET status = 'sold' WHERE status = 'sold';
-- 'listed' and 'worn' should already be correct if they exist

-- 6. Convert status column to item_status enum with default
ALTER TABLE "Inventory"
  ALTER COLUMN status TYPE item_status USING status::item_status;
ALTER TABLE "Inventory"
  ALTER COLUMN status SET DEFAULT 'active'::item_status;

-- 7. Create sales_view for sold items only
CREATE OR REPLACE VIEW sales_view
WITH (security_invoker = on) AS
SELECT
  i.id,
  i.user_id,
  i.sku,
  i.brand,
  i.model,
  i.size_uk,
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
  i.platform,
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
  (COALESCE(i.sold_price, 0) - COALESCE(i.purchase_price, 0) - COALESCE(i.tax, 0) - COALESCE(i.shipping, 0))::numeric(12,2) AS margin_gbp,
  CASE
    WHEN COALESCE(i.purchase_price, 0) + COALESCE(i.tax, 0) + COALESCE(i.shipping, 0) > 0
    THEN ((COALESCE(i.sold_price, 0) - COALESCE(i.purchase_price, 0) - COALESCE(i.tax, 0) - COALESCE(i.shipping, 0)) / (COALESCE(i.purchase_price, 0) + COALESCE(i.tax, 0) + COALESCE(i.shipping, 0)) * 100)::numeric(12,2)
    ELSE 0
  END AS margin_percent
FROM "Inventory" i
WHERE i.status = 'sold';

-- 8. Create inventory_active_view for non-sold items
CREATE OR REPLACE VIEW inventory_active_view
WITH (security_invoker = on) AS
SELECT
  i.id,
  i.user_id,
  i.sku,
  i.brand,
  i.model,
  i.size_uk,
  i.condition,
  i.category,
  i.purchase_price,
  i.purchase_date,
  i.tax,
  i.shipping,
  i.place_of_purchase,
  i.order_number,
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
  (COALESCE(i.custom_market_value, 0) - COALESCE(i.purchase_price, 0) - COALESCE(i.tax, 0) - COALESCE(i.shipping, 0))::numeric(12,2) AS unrealised_profit_gbp
FROM "Inventory" i
WHERE i.status IN ('active', 'listed', 'worn');

-- 9. Ensure RLS is enabled and policies exist
ALTER TABLE "Inventory" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to recreate cleanly)
DROP POLICY IF EXISTS "Users can view own items" ON "Inventory";
DROP POLICY IF EXISTS "Users can insert own items" ON "Inventory";
DROP POLICY IF EXISTS "Users can update own items" ON "Inventory";
DROP POLICY IF EXISTS "Users can delete own items" ON "Inventory";

-- Recreate RLS policies
CREATE POLICY "Users can view own items"
  ON "Inventory" FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own items"
  ON "Inventory" FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own items"
  ON "Inventory" FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own items"
  ON "Inventory" FOR DELETE
  USING (auth.uid() = user_id);

-- 10. Ensure views use security_invoker
ALTER VIEW sales_view SET (security_invoker = on);
ALTER VIEW inventory_active_view SET (security_invoker = on);

-- 11. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_status ON "Inventory"(status);
CREATE INDEX IF NOT EXISTS idx_inventory_user_status ON "Inventory"(user_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_sold_date ON "Inventory"(sold_date) WHERE status = 'sold';

-- 12. Comment documentation
COMMENT ON VIEW sales_view IS 'Shows only sold items with calculated margin metrics';
COMMENT ON VIEW inventory_active_view IS 'Shows only active inventory (active, listed, worn) excluding sold items';
COMMENT ON COLUMN "Inventory".status IS 'Item status: active (owned), listed (for sale), worn (used but owned), sold (completed transaction)';

-- 13. Recreate P&L and VAT views (dropped in step 3)
CREATE OR REPLACE VIEW profit_loss_monthly_view AS
WITH sold_items AS (
  SELECT
    user_id,
    DATE_TRUNC('month', sold_date)::date AS month,
    sold_price AS revenue,
    purchase_price AS cogs,
    (sold_price - purchase_price) AS gross_profit
  FROM "Inventory"
  WHERE status = 'sold'
    AND sold_date IS NOT NULL
    AND sold_price IS NOT NULL
),
monthly_sales AS (
  SELECT
    user_id,
    month,
    SUM(revenue) AS total_revenue,
    SUM(cogs) AS total_cogs,
    SUM(gross_profit) AS total_gross_profit,
    COUNT(*) AS num_sales
  FROM sold_items
  GROUP BY user_id, month
),
monthly_expenses AS (
  SELECT
    user_id,
    DATE_TRUNC('month', date)::date AS month,
    SUM(amount) AS total_expenses
  FROM expenses
  GROUP BY user_id, month
)
SELECT
  COALESCE(s.user_id, e.user_id) AS user_id,
  COALESCE(s.month, e.month) AS month,
  COALESCE(s.total_revenue, 0) AS revenue,
  COALESCE(s.total_cogs, 0) AS cogs,
  COALESCE(s.total_gross_profit, 0) AS gross_profit,
  COALESCE(e.total_expenses, 0) AS expenses,
  (COALESCE(s.total_gross_profit, 0) - COALESCE(e.total_expenses, 0)) AS net_profit,
  COALESCE(s.num_sales, 0) AS num_sales
FROM monthly_sales s
FULL OUTER JOIN monthly_expenses e
  ON s.user_id = e.user_id AND s.month = e.month
ORDER BY month DESC;

ALTER VIEW profit_loss_monthly_view SET (security_invoker = on);
COMMENT ON VIEW profit_loss_monthly_view IS 'Monthly P&L aggregation per user. Revenue from sold items, COGS from purchase_price, expenses from expenses table.';

CREATE OR REPLACE VIEW vat_margin_monthly_view AS
WITH sold_items_margin AS (
  SELECT
    user_id,
    DATE_TRUNC('month', sold_date)::date AS month,
    id AS item_id,
    sku,
    brand,
    model,
    sold_date,
    purchase_price,
    sold_price,
    platform,
    (sold_price - purchase_price) AS margin,
    CASE
      WHEN (sold_price - purchase_price) > 0
      THEN (sold_price - purchase_price) / 6.0
      ELSE 0
    END AS vat_due
  FROM "Inventory"
  WHERE status = 'sold'
    AND sold_date IS NOT NULL
    AND sold_price IS NOT NULL
    AND purchase_price IS NOT NULL
)
SELECT
  user_id,
  month,
  COUNT(*) AS num_sales,
  SUM(sold_price) AS total_sales,
  SUM(margin) AS total_margin,
  SUM(CASE WHEN margin > 0 THEN margin ELSE 0 END) AS taxable_margin,
  SUM(vat_due) AS vat_due
FROM sold_items_margin
GROUP BY user_id, month
ORDER BY month DESC;

ALTER VIEW vat_margin_monthly_view SET (security_invoker = on);
COMMENT ON VIEW vat_margin_monthly_view IS 'Monthly VAT calculations under UK Margin Scheme. VAT due = positive margin / 6.';

CREATE OR REPLACE VIEW vat_margin_detail_view AS
SELECT
  user_id,
  id AS item_id,
  sku,
  brand,
  model,
  size_uk AS size,
  sold_date,
  purchase_price,
  sold_price,
  platform,
  (sold_price - purchase_price) AS margin,
  CASE
    WHEN (sold_price - purchase_price) > 0
    THEN (sold_price - purchase_price) / 6.0
    ELSE 0
  END AS vat_due,
  DATE_TRUNC('month', sold_date)::date AS month
FROM "Inventory"
WHERE status = 'sold'
  AND sold_date IS NOT NULL
  AND sold_price IS NOT NULL
  AND purchase_price IS NOT NULL
ORDER BY sold_date DESC;

ALTER VIEW vat_margin_detail_view SET (security_invoker = on);
COMMENT ON VIEW vat_margin_detail_view IS 'Item-level VAT margin details for exports and detailed reporting.';

GRANT SELECT ON profit_loss_monthly_view TO authenticated;
GRANT SELECT ON vat_margin_monthly_view TO authenticated;
GRANT SELECT ON vat_margin_detail_view TO authenticated;
