# Apply Seed Provider Patch

The seed bridge script requires the database to accept 'seed' as a provider value.

## Quick Fix - Apply via Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the SQL below
6. Click **Run**

```sql
-- Add meta column to market_products (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'market_products' AND column_name = 'meta'
  ) THEN
    ALTER TABLE market_products ADD COLUMN meta jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Update provider constraints to include 'seed'
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
```

## Then Run the Seed Script

```bash
npm run seed:market:bridge
```

This will populate your market data with realistic 7-day price series for all SKUs in your inventory and watchlists.
