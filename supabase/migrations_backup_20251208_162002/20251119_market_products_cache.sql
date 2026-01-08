-- WHY: Cache product metadata (brand, model, colorway, image_url) to avoid repeated lookups
-- and ensure UI always has fallback data even if provider APIs are slow/down

CREATE TABLE IF NOT EXISTS public.market_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('stockx', 'alias', 'ebay', 'seed')),
  product_sku TEXT NOT NULL,

  -- Product metadata
  brand TEXT NULL,
  model TEXT NULL,
  colorway TEXT NULL,
  image_url TEXT NULL,
  product_name TEXT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one product per (provider, sku)
  UNIQUE (provider, product_sku)
);

-- Index for fast lookups by provider + SKU
CREATE INDEX IF NOT EXISTS ix_market_products_lookup
  ON market_products (provider, product_sku);

-- RLS: Allow authenticated users to read cached product metadata
ALTER TABLE market_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read on market_products"
  ON market_products
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role can write
CREATE POLICY "Allow service role write on market_products"
  ON market_products
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE market_products IS 'Cached product metadata from market providers - brand, model, colorway, images';
