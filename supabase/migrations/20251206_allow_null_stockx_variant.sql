-- Fix BUG #2: Allow NULL stockx_variant_id for trading cards
-- Trading cards don't have size variants, so variant_id should be optional

ALTER TABLE inventory_market_links
  ALTER COLUMN stockx_variant_id DROP NOT NULL;

-- Add comment explaining when this is NULL
COMMENT ON COLUMN inventory_market_links.stockx_variant_id IS
  'StockX variant ID for size-based products. NULL for products without variants (e.g., trading cards, one-size items).';
