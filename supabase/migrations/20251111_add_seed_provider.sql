-- ============================================================================
-- Add 'seed' provider support + meta column to market_products
-- Patch to allow seed/demo data in market tables
-- ============================================================================

-- 1. Add meta column to market_products (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'market_products' AND column_name = 'meta'
  ) THEN
    ALTER TABLE market_products ADD COLUMN meta jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 2. Drop and recreate constraints to add 'seed' provider
ALTER TABLE market_products DROP CONSTRAINT IF EXISTS market_products_provider_check;
ALTER TABLE market_products ADD CONSTRAINT market_products_provider_check
  CHECK (provider IN ('stockx', 'alias', 'ebay', 'seed'));

ALTER TABLE market_prices DROP CONSTRAINT IF EXISTS market_prices_provider_check;
ALTER TABLE market_prices ADD CONSTRAINT market_prices_provider_check
  CHECK (provider IN ('stockx', 'alias', 'ebay', 'seed'));

ALTER TABLE inventory_market_links DROP CONSTRAINT IF EXISTS inventory_market_links_provider_check;
ALTER TABLE inventory_market_links ADD CONSTRAINT inventory_market_links_provider_check
  CHECK (provider IN ('stockx', 'alias', 'ebay', 'seed'));

ALTER TABLE market_orders DROP CONSTRAINT IF EXISTS market_orders_provider_check;
ALTER TABLE market_orders ADD CONSTRAINT market_orders_provider_check
  CHECK (provider IN ('stockx', 'alias', 'ebay', 'seed'));
