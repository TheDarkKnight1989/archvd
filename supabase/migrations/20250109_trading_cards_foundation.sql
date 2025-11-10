-- Phase A: Trading Card (Pokémon sealed) Live-Data Foundations
-- No vendor API calls yet; all connectors stubbed and disabled by default
-- Tables prefixed with trading_card_*, views with tcg_*

-- ============================================================================
-- A1.1: trading_card_catalog - Master catalog of sealed products
-- ============================================================================

CREATE TABLE IF NOT EXISTS trading_card_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  language text NOT NULL, -- 'EN', 'JP', etc.
  set_code text,
  set_name text,
  sealed_type text NOT NULL, -- 'booster_box', 'etb', 'booster_pack', 'collection_box', etc.
  name text NOT NULL,
  image_url text,
  retail_price numeric(10, 2),
  currency text DEFAULT 'GBP',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for catalog
CREATE INDEX IF NOT EXISTS idx_trading_card_catalog_sku ON trading_card_catalog(sku);
CREATE INDEX IF NOT EXISTS idx_trading_card_catalog_language ON trading_card_catalog(language);
CREATE INDEX IF NOT EXISTS idx_trading_card_catalog_sealed_type ON trading_card_catalog(sealed_type);
CREATE INDEX IF NOT EXISTS idx_trading_card_catalog_set_code ON trading_card_catalog(set_code);

COMMENT ON TABLE trading_card_catalog IS
  'Master catalog of sealed trading card products (Pokémon ETBs, booster boxes, packs, etc.). SKU is unique identifier across all languages.';

-- ============================================================================
-- A1.2: trading_card_market_listings - Individual vendor listings (raw data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS trading_card_market_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL REFERENCES trading_card_catalog(sku) ON DELETE CASCADE,
  source text NOT NULL, -- 'tcgplayer', 'ebay', 'cardmarket', etc.
  listing_id text, -- vendor's listing ID
  title text,
  price numeric(10, 2) NOT NULL,
  currency text DEFAULT 'GBP',
  condition text DEFAULT 'sealed', -- 'sealed', 'nm', 'lp', etc.
  shipping numeric(10, 2) DEFAULT 0,
  url text,
  seller_rating numeric(3, 2),
  scraped_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes for listings
CREATE INDEX IF NOT EXISTS idx_trading_card_market_listings_sku ON trading_card_market_listings(sku);
CREATE INDEX IF NOT EXISTS idx_trading_card_market_listings_source ON trading_card_market_listings(source);
CREATE INDEX IF NOT EXISTS idx_trading_card_market_listings_sku_source ON trading_card_market_listings(sku, source);
CREATE INDEX IF NOT EXISTS idx_trading_card_market_listings_scraped_at ON trading_card_market_listings(scraped_at DESC);

COMMENT ON TABLE trading_card_market_listings IS
  'Raw individual listings from vendors. Used to generate daily snapshots. Authenticated users can read for debugging.';

-- ============================================================================
-- A1.3: trading_card_market_snapshots - Daily rollup stats per SKU/source
-- ============================================================================

CREATE TABLE IF NOT EXISTS trading_card_market_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL REFERENCES trading_card_catalog(sku) ON DELETE CASCADE,
  source text NOT NULL, -- 'tcgplayer', 'ebay', etc.
  snapshot_date date NOT NULL,
  min_price numeric(10, 2),
  median_price numeric(10, 2),
  p75_price numeric(10, 2), -- 75th percentile
  max_price numeric(10, 2),
  listing_count integer DEFAULT 0,
  currency text DEFAULT 'GBP',
  metadata jsonb DEFAULT '{}'::jsonb, -- stores outlier removal details, raw stats, etc.
  created_at timestamptz DEFAULT now(),
  UNIQUE(sku, source, snapshot_date)
);

-- Indexes for snapshots
CREATE INDEX IF NOT EXISTS idx_trading_card_market_snapshots_sku ON trading_card_market_snapshots(sku);
CREATE INDEX IF NOT EXISTS idx_trading_card_market_snapshots_source ON trading_card_market_snapshots(source);
CREATE INDEX IF NOT EXISTS idx_trading_card_market_snapshots_sku_source ON trading_card_market_snapshots(sku, source);
CREATE INDEX IF NOT EXISTS idx_trading_card_market_snapshots_date ON trading_card_market_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_trading_card_market_snapshots_sku_date ON trading_card_market_snapshots(sku, snapshot_date DESC);

COMMENT ON TABLE trading_card_market_snapshots IS
  'Daily aggregated price statistics per SKU and source. Uses IQR outlier removal for clean medians. Primary data source for market values.';

-- ============================================================================
-- A1.4: trading_card_connectors - Connector config and status
-- ============================================================================

CREATE TABLE IF NOT EXISTS trading_card_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL UNIQUE, -- 'tcgplayer', 'ebay', etc.
  enabled boolean DEFAULT false, -- all disabled by default (no live calls yet)
  config jsonb DEFAULT '{}'::jsonb, -- API keys, rate limits, etc.
  last_run_at timestamptz,
  last_run_status text, -- 'success', 'error', 'disabled'
  last_error text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Seed connectors as disabled
INSERT INTO trading_card_connectors (source, enabled, last_run_status)
VALUES
  ('tcgplayer', false, 'disabled'),
  ('ebay', false, 'disabled')
ON CONFLICT (source) DO NOTHING;

COMMENT ON TABLE trading_card_connectors IS
  'Configuration and status for trading card data connectors. All disabled by default to prevent live API calls.';

-- ============================================================================
-- A1.5: View - tcg_latest_prices (latest snapshot per SKU/source)
-- ============================================================================

CREATE OR REPLACE VIEW tcg_latest_prices
WITH (security_invoker = on) AS
SELECT DISTINCT ON (s.sku, s.source)
  s.sku,
  s.source,
  s.snapshot_date AS as_of,
  s.min_price,
  s.median_price,
  s.p75_price,
  s.max_price,
  s.listing_count,
  s.currency,
  c.language,
  c.set_code,
  c.set_name,
  c.sealed_type,
  c.name,
  c.image_url
FROM trading_card_market_snapshots s
JOIN trading_card_catalog c ON s.sku = c.sku
ORDER BY s.sku, s.source, s.snapshot_date DESC;

COMMENT ON VIEW tcg_latest_prices IS
  'Latest snapshot per SKU and source. Used for market data display and watchlist monitoring.';

-- ============================================================================
-- A1.6: View - tcg_portfolio_latest_prices (join to inventory)
-- ============================================================================

CREATE OR REPLACE VIEW tcg_portfolio_latest_prices
WITH (security_invoker = on) AS
SELECT
  i.id AS inventory_id,
  i.user_id,
  i.sku,
  i.purchase_price,
  i.purchase_date,
  i.status,
  l.source,
  l.median_price AS market_value,
  l.currency,
  l.as_of AS market_updated_at,
  (l.median_price - i.purchase_price) AS unrealized_gain,
  CASE
    WHEN i.purchase_price > 0
    THEN ((l.median_price - i.purchase_price) / i.purchase_price) * 100
    ELSE NULL
  END AS unrealized_gain_pct
FROM "Inventory" i
LEFT JOIN LATERAL (
  SELECT DISTINCT ON (source)
    source,
    median_price,
    currency,
    snapshot_date AS as_of
  FROM trading_card_market_snapshots
  WHERE sku = i.sku
  ORDER BY source, snapshot_date DESC
) l ON true
WHERE i.category = 'pokemon';

COMMENT ON VIEW tcg_portfolio_latest_prices IS
  'Portfolio view joining Inventory (category=pokemon) with latest market snapshots. Used for P/L calculations.';

-- ============================================================================
-- A1.7: RLS Policies
-- ============================================================================

-- Catalog: authenticated read, service role write
ALTER TABLE trading_card_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trading_card_catalog_read" ON trading_card_catalog
  FOR SELECT USING (true); -- public read for catalog

CREATE POLICY "trading_card_catalog_write" ON trading_card_catalog
  FOR ALL USING (auth.role() = 'service_role');

-- Listings: authenticated read (debugging), service role write
ALTER TABLE trading_card_market_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trading_card_market_listings_read" ON trading_card_market_listings
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "trading_card_market_listings_write" ON trading_card_market_listings
  FOR ALL USING (auth.role() = 'service_role');

-- Snapshots: authenticated read, service role write
ALTER TABLE trading_card_market_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trading_card_market_snapshots_read" ON trading_card_market_snapshots
  FOR SELECT USING (true); -- public read for market data

CREATE POLICY "trading_card_market_snapshots_write" ON trading_card_market_snapshots
  FOR ALL USING (auth.role() = 'service_role');

-- Connectors: authenticated read, service role write
ALTER TABLE trading_card_connectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trading_card_connectors_read" ON trading_card_connectors
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "trading_card_connectors_write" ON trading_card_connectors
  FOR ALL USING (auth.role() = 'service_role');

-- Grant SELECT on views to authenticated users
GRANT SELECT ON tcg_latest_prices TO authenticated;
GRANT SELECT ON tcg_portfolio_latest_prices TO authenticated;

-- ============================================================================
-- Migration complete
-- ============================================================================

COMMENT ON SCHEMA public IS
  'Phase A: Trading card foundations added. Tables: trading_card_catalog, trading_card_market_listings, trading_card_market_snapshots, trading_card_connectors. Views: tcg_latest_prices, tcg_portfolio_latest_prices. All connectors disabled by default.';
