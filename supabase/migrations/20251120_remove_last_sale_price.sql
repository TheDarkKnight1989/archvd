-- ============================================================================
-- Remove last_sale_price from StockX tables
-- ============================================================================
-- Reason: StockX V2 API no longer provides lastSale data
-- This migration removes the deprecated column to avoid confusion
-- ============================================================================

-- Drop the view first (it depends on the column)
DROP VIEW IF EXISTS stockx_market_latest CASCADE;

-- Remove last_sale_price column from snapshots table
ALTER TABLE stockx_market_snapshots
DROP COLUMN IF EXISTS last_sale_price CASCADE;

-- Recreate the view without last_sale_price
CREATE VIEW stockx_market_latest AS
SELECT DISTINCT ON (stockx_product_id, stockx_variant_id, currency_code)
  id,
  stockx_product_id,
  stockx_variant_id,
  product_id,
  variant_id,
  currency_code,
  sales_last_72_hours,
  total_sales_volume,
  lowest_ask,
  highest_bid,
  average_deadstock_price,
  volatility,
  price_premium,
  snapshot_at,
  created_at
FROM stockx_market_snapshots
ORDER BY stockx_product_id, stockx_variant_id, currency_code, snapshot_at DESC;

COMMENT ON VIEW stockx_market_latest IS 'Latest market data snapshot for each product/variant/currency (excludes last_sale_price as StockX V2 API no longer provides it)';
