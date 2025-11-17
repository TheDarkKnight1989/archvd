-- ============================================================================
-- StockX V2 Integration - Complete Database Schema
-- ============================================================================
-- This migration creates all tables needed for full StockX integration:
-- 1. Catalog tables (products, variants, market data)
-- 2. Listing management tables
-- 3. Order/sales tracking tables
-- 4. Batch operation tracking
-- 5. Mapping tables linking our inventory/watchlist to StockX
-- ============================================================================

-- ============================================================================
-- CLEANUP (Drop existing tables/views/functions if they exist)
-- ============================================================================
-- Note: Tables must be dropped in reverse order of dependencies

-- Drop views first
DROP VIEW IF EXISTS stockx_market_latest CASCADE;

-- Drop mapping tables
DROP TABLE IF EXISTS inventory_market_links CASCADE;
DROP TABLE IF EXISTS watchlist_market_links CASCADE;

-- Drop user-specific tables
DROP TABLE IF EXISTS stockx_batch_job_items CASCADE;
DROP TABLE IF EXISTS stockx_batch_jobs CASCADE;
DROP TABLE IF EXISTS stockx_orders CASCADE;
DROP TABLE IF EXISTS stockx_listings CASCADE;

-- Drop catalog tables
DROP TABLE IF EXISTS stockx_market_snapshots CASCADE;
DROP TABLE IF EXISTS stockx_variants CASCADE;
DROP TABLE IF EXISTS stockx_products CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS get_stockx_latest_price CASCADE;
DROP FUNCTION IF EXISTS find_stockx_by_gtin CASCADE;

-- ============================================================================
-- CATALOG TABLES (Shared data - No RLS)
-- ============================================================================

-- StockX Products (catalog)
CREATE TABLE stockx_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stockx_product_id TEXT NOT NULL UNIQUE,
  style_id TEXT NOT NULL, -- SKU
  title TEXT NOT NULL,
  brand TEXT NOT NULL,
  description TEXT,
  colorway TEXT,
  retail_price DECIMAL(10, 2),
  release_date TEXT,
  image_url TEXT,
  thumb_url TEXT,
  category TEXT,
  gender TEXT,
  condition TEXT,
  traits JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for products
CREATE INDEX idx_stockx_products_stockx_id ON stockx_products(stockx_product_id);
CREATE INDEX idx_stockx_products_style_id ON stockx_products(style_id);
CREATE INDEX idx_stockx_products_brand ON stockx_products(brand);
CREATE INDEX idx_stockx_products_category ON stockx_products(category);
CREATE INDEX idx_stockx_products_last_synced ON stockx_products(last_synced_at);

-- StockX Variants (sizes/colors for products)
CREATE TABLE stockx_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stockx_variant_id TEXT NOT NULL UNIQUE,
  stockx_product_id TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES stockx_products(id) ON DELETE CASCADE,
  variant_value TEXT NOT NULL, -- e.g., "10.5", "M", "OS"
  gtins TEXT[], -- Array of UPC/EAN barcodes
  hidden BOOLEAN DEFAULT false,
  size_chart JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(stockx_product_id, variant_value)
);

-- Add foreign key constraint after table creation
ALTER TABLE stockx_variants
  DROP CONSTRAINT IF EXISTS fk_stockx_variants_product_id;

ALTER TABLE stockx_variants
  ADD CONSTRAINT fk_stockx_variants_product_id
  FOREIGN KEY (stockx_product_id)
  REFERENCES stockx_products(stockx_product_id)
  ON DELETE CASCADE;

-- Indexes for variants
CREATE INDEX idx_stockx_variants_stockx_id ON stockx_variants(stockx_variant_id);
CREATE INDEX idx_stockx_variants_product_id ON stockx_variants(product_id);
CREATE INDEX idx_stockx_variants_stockx_product_id ON stockx_variants(stockx_product_id);
CREATE INDEX idx_stockx_variants_gtins ON stockx_variants USING GIN(gtins);
CREATE INDEX idx_stockx_variants_last_synced ON stockx_variants(last_synced_at);

-- StockX Market Data Snapshots (time-series pricing data)
CREATE TABLE stockx_market_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stockx_product_id TEXT NOT NULL,
  stockx_variant_id TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES stockx_products(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES stockx_variants(id) ON DELETE CASCADE,
  currency_code TEXT NOT NULL DEFAULT 'USD',

  -- Sales statistics
  last_sale_price DECIMAL(10, 2),
  sales_last_72_hours INTEGER,
  total_sales_volume INTEGER,

  -- Current market
  lowest_ask DECIMAL(10, 2),
  highest_bid DECIMAL(10, 2),

  -- Historical ranges
  average_deadstock_price DECIMAL(10, 2),
  volatility DECIMAL(5, 2),
  price_premium DECIMAL(5, 2),

  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for market snapshots
CREATE INDEX idx_stockx_market_snapshots_product_id ON stockx_market_snapshots(product_id);
CREATE INDEX idx_stockx_market_snapshots_variant_id ON stockx_market_snapshots(variant_id);
CREATE INDEX idx_stockx_market_snapshots_stockx_product_id ON stockx_market_snapshots(stockx_product_id);
CREATE INDEX idx_stockx_market_snapshots_stockx_variant_id ON stockx_market_snapshots(stockx_variant_id);
CREATE INDEX idx_stockx_market_snapshots_snapshot_at ON stockx_market_snapshots(snapshot_at DESC);
CREATE INDEX idx_stockx_market_snapshots_currency ON stockx_market_snapshots(currency_code);

-- Composite index for efficient latest-price queries
CREATE INDEX idx_stockx_market_composite ON stockx_market_snapshots(
  stockx_product_id, stockx_variant_id, currency_code, snapshot_at DESC
);

-- Latest market data materialized view (for fast lookups)
-- Note: This must be refreshed periodically (e.g., via cron job)
CREATE MATERIALIZED VIEW stockx_market_latest AS
SELECT DISTINCT ON (stockx_product_id, stockx_variant_id, currency_code)
  id,
  stockx_product_id,
  stockx_variant_id,
  product_id,
  variant_id,
  currency_code,
  last_sale_price,
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

-- Index on materialized view for fast lookups
CREATE UNIQUE INDEX idx_stockx_market_latest_composite ON stockx_market_latest(
  stockx_product_id, stockx_variant_id, currency_code
);

-- ============================================================================
-- USER-SPECIFIC TABLES (With RLS)
-- ============================================================================

-- StockX Listings (user's active asks)
CREATE TABLE stockx_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stockx_listing_id TEXT UNIQUE, -- Null until created on StockX
  stockx_product_id TEXT NOT NULL,
  stockx_variant_id TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES stockx_products(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES stockx_variants(id) ON DELETE CASCADE,

  -- Pricing
  amount INTEGER NOT NULL, -- Price in cents
  currency_code TEXT NOT NULL DEFAULT 'USD',

  -- Status
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, ACTIVE, INACTIVE, CANCELLED, SOLD
  expires_at TIMESTAMPTZ,

  -- Soft delete
  deleted_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_listing_status CHECK (status IN ('PENDING', 'ACTIVE', 'INACTIVE', 'CANCELLED', 'SOLD'))
);

-- Indexes for listings
CREATE INDEX idx_stockx_listings_user_id ON stockx_listings(user_id);
CREATE INDEX idx_stockx_listings_stockx_listing_id ON stockx_listings(stockx_listing_id);
CREATE INDEX idx_stockx_listings_product_id ON stockx_listings(product_id);
CREATE INDEX idx_stockx_listings_variant_id ON stockx_listings(variant_id);
CREATE INDEX idx_stockx_listings_status ON stockx_listings(status);
CREATE INDEX idx_stockx_listings_created_at ON stockx_listings(created_at DESC);

-- Composite indexes for common query patterns
CREATE INDEX idx_stockx_listings_user_status ON stockx_listings(user_id, status)
  WHERE status IN ('ACTIVE', 'PENDING') AND deleted_at IS NULL;
CREATE INDEX idx_stockx_listings_deleted ON stockx_listings(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- RLS for listings
ALTER TABLE stockx_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own listings" ON stockx_listings;
CREATE POLICY "Users can view their own listings"
  ON stockx_listings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own listings" ON stockx_listings;
CREATE POLICY "Users can insert their own listings"
  ON stockx_listings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own listings" ON stockx_listings;
CREATE POLICY "Users can update their own listings"
  ON stockx_listings FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own listings" ON stockx_listings;
CREATE POLICY "Users can delete their own listings"
  ON stockx_listings FOR DELETE
  USING (auth.uid() = user_id);

-- StockX Orders (completed sales)
CREATE TABLE stockx_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stockx_order_id TEXT UNIQUE, -- Nullable until order confirmed on StockX
  stockx_listing_id TEXT NOT NULL,
  stockx_product_id TEXT NOT NULL,
  stockx_variant_id TEXT NOT NULL,
  listing_id UUID REFERENCES stockx_listings(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES stockx_products(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES stockx_variants(id) ON DELETE CASCADE,

  -- Sale details
  amount INTEGER NOT NULL, -- Sale price in cents
  currency_code TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, CANCELLED

  -- Dates
  sold_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  -- Payout information
  payout_amount INTEGER, -- Payout in cents
  payout_date TIMESTAMPTZ,
  processing_fee INTEGER, -- Fee in cents
  transaction_fee INTEGER, -- Fee in cents
  shipping_cost INTEGER, -- Cost in cents

  -- Shipping
  tracking_number TEXT,
  carrier TEXT,

  -- Soft delete
  deleted_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_order_status CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED'))
);

-- Indexes for orders
CREATE INDEX idx_stockx_orders_user_id ON stockx_orders(user_id);
CREATE INDEX idx_stockx_orders_stockx_order_id ON stockx_orders(stockx_order_id);
CREATE INDEX idx_stockx_orders_listing_id ON stockx_orders(listing_id);
CREATE INDEX idx_stockx_orders_product_id ON stockx_orders(product_id);
CREATE INDEX idx_stockx_orders_variant_id ON stockx_orders(variant_id);
CREATE INDEX idx_stockx_orders_status ON stockx_orders(status);
CREATE INDEX idx_stockx_orders_sold_at ON stockx_orders(sold_at DESC);
CREATE INDEX idx_stockx_orders_created_at ON stockx_orders(created_at DESC);

-- Composite indexes for common query patterns
CREATE INDEX idx_stockx_orders_user_sold ON stockx_orders(user_id, sold_at DESC)
  WHERE status = 'COMPLETED' AND deleted_at IS NULL;
CREATE INDEX idx_stockx_orders_user_status ON stockx_orders(user_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_stockx_orders_deleted ON stockx_orders(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- RLS for orders
ALTER TABLE stockx_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own orders" ON stockx_orders;
CREATE POLICY "Users can view their own orders"
  ON stockx_orders FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own orders" ON stockx_orders;
CREATE POLICY "Users can insert their own orders"
  ON stockx_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own orders" ON stockx_orders;
CREATE POLICY "Users can update their own orders"
  ON stockx_orders FOR UPDATE
  USING (auth.uid() = user_id);

-- StockX Batch Jobs (tracking bulk operations)
CREATE TABLE stockx_batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stockx_batch_id TEXT UNIQUE, -- Null until submitted to StockX
  operation TEXT NOT NULL, -- CREATE, UPDATE, DELETE
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, FAILED, PARTIAL

  -- Progress tracking
  total_items INTEGER NOT NULL,
  processed_items INTEGER DEFAULT 0,
  successful_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,

  -- Results (detailed success/failure per item)
  results JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_batch_operation CHECK (operation IN ('CREATE', 'UPDATE', 'DELETE')),
  CONSTRAINT valid_batch_status CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'PARTIAL'))
);

-- Indexes for batch jobs
CREATE INDEX idx_stockx_batch_jobs_user_id ON stockx_batch_jobs(user_id);
CREATE INDEX idx_stockx_batch_jobs_stockx_batch_id ON stockx_batch_jobs(stockx_batch_id);
CREATE INDEX idx_stockx_batch_jobs_status ON stockx_batch_jobs(status);
CREATE INDEX idx_stockx_batch_jobs_created_at ON stockx_batch_jobs(created_at DESC);

-- Composite index for common query patterns
CREATE INDEX idx_stockx_batch_jobs_user_status ON stockx_batch_jobs(user_id, status, created_at DESC);

-- RLS for batch jobs
ALTER TABLE stockx_batch_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own batch jobs" ON stockx_batch_jobs;
CREATE POLICY "Users can view their own batch jobs"
  ON stockx_batch_jobs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own batch jobs" ON stockx_batch_jobs;
CREATE POLICY "Users can insert their own batch jobs"
  ON stockx_batch_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own batch jobs" ON stockx_batch_jobs;
CREATE POLICY "Users can update their own batch jobs"
  ON stockx_batch_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- StockX Batch Job Items (detailed results for each item in a batch)
-- This table splits the JSONB results into individual rows for better performance at scale
CREATE TABLE stockx_batch_job_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_job_id UUID NOT NULL REFERENCES stockx_batch_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Item identifiers
  stockx_product_id TEXT NOT NULL,
  stockx_variant_id TEXT NOT NULL,
  stockx_listing_id TEXT, -- For update/delete operations

  -- Request data
  amount INTEGER, -- Requested price in cents (for create/update)
  currency_code TEXT,

  -- Result
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, SUCCESS, FAILED
  error_message TEXT,

  -- Response data
  response_listing_id TEXT, -- Returned listing ID on success

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_batch_item_status CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED'))
);

-- Indexes for batch job items
CREATE INDEX idx_stockx_batch_job_items_batch_job_id ON stockx_batch_job_items(batch_job_id);
CREATE INDEX idx_stockx_batch_job_items_user_id ON stockx_batch_job_items(user_id);
CREATE INDEX idx_stockx_batch_job_items_status ON stockx_batch_job_items(status);
CREATE INDEX idx_stockx_batch_job_items_product_variant ON stockx_batch_job_items(stockx_product_id, stockx_variant_id);

-- RLS for batch job items
ALTER TABLE stockx_batch_job_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own batch job items" ON stockx_batch_job_items;
CREATE POLICY "Users can view their own batch job items"
  ON stockx_batch_job_items FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own batch job items" ON stockx_batch_job_items;
CREATE POLICY "Users can insert their own batch job items"
  ON stockx_batch_job_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own batch job items" ON stockx_batch_job_items;
CREATE POLICY "Users can update their own batch job items"
  ON stockx_batch_job_items FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- MAPPING TABLES (Link our data to StockX)
-- ============================================================================

-- Link watchlist items to StockX market data
CREATE TABLE watchlist_market_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_item_id UUID NOT NULL,
  stockx_product_id TEXT NOT NULL,
  stockx_variant_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(watchlist_item_id)
);

-- Add foreign key to watchlist if table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'watchlist') THEN
    ALTER TABLE watchlist_market_links
      ADD CONSTRAINT fk_watchlist_market_links_watchlist
      FOREIGN KEY (watchlist_item_id)
      REFERENCES watchlist(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes for watchlist links
CREATE INDEX idx_watchlist_market_links_item_id ON watchlist_market_links(watchlist_item_id);
CREATE INDEX idx_watchlist_market_links_stockx_product_id ON watchlist_market_links(stockx_product_id);
CREATE INDEX idx_watchlist_market_links_stockx_variant_id ON watchlist_market_links(stockx_variant_id);

-- RLS for watchlist market links
ALTER TABLE watchlist_market_links ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies require 'watchlist' table to exist
-- If watchlist table doesn't exist yet, these policies will need to be created later
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'watchlist') THEN
    DROP POLICY IF EXISTS "Users can view watchlist market links for their items" ON watchlist_market_links;
    CREATE POLICY "Users can view watchlist market links for their items"
      ON watchlist_market_links FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM watchlist w
          WHERE w.id = watchlist_market_links.watchlist_item_id
          AND w.user_id = auth.uid()
        )
      );

    DROP POLICY IF EXISTS "Users can insert watchlist market links for their items" ON watchlist_market_links;
    CREATE POLICY "Users can insert watchlist market links for their items"
      ON watchlist_market_links FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM watchlist w
          WHERE w.id = watchlist_market_links.watchlist_item_id
          AND w.user_id = auth.uid()
        )
      );

    DROP POLICY IF EXISTS "Users can update watchlist market links for their items" ON watchlist_market_links;
    CREATE POLICY "Users can update watchlist market links for their items"
      ON watchlist_market_links FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM watchlist w
          WHERE w.id = watchlist_market_links.watchlist_item_id
          AND w.user_id = auth.uid()
        )
      );

    DROP POLICY IF EXISTS "Users can delete watchlist market links for their items" ON watchlist_market_links;
    CREATE POLICY "Users can delete watchlist market links for their items"
      ON watchlist_market_links FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM watchlist w
          WHERE w.id = watchlist_market_links.watchlist_item_id
          AND w.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Link inventory items to StockX listings and market data
CREATE TABLE inventory_market_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL,
  stockx_product_id TEXT NOT NULL,
  stockx_variant_id TEXT NOT NULL,
  stockx_listing_id TEXT, -- Null if not listed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(item_id)
);

-- Add foreign key to items if table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'items') THEN
    ALTER TABLE inventory_market_links
      ADD CONSTRAINT fk_inventory_market_links_items
      FOREIGN KEY (item_id)
      REFERENCES items(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes for inventory market links
CREATE INDEX idx_inventory_market_links_item_id ON inventory_market_links(item_id);
CREATE INDEX idx_inventory_market_links_stockx_product_id ON inventory_market_links(stockx_product_id);
CREATE INDEX idx_inventory_market_links_stockx_variant_id ON inventory_market_links(stockx_variant_id);
CREATE INDEX idx_inventory_market_links_stockx_listing_id ON inventory_market_links(stockx_listing_id);

-- RLS for inventory market links
ALTER TABLE inventory_market_links ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies require 'items' table to exist
-- If items table doesn't exist yet, these policies will need to be created later
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'items') THEN
    DROP POLICY IF EXISTS "Users can view inventory market links for their items" ON inventory_market_links;
    CREATE POLICY "Users can view inventory market links for their items"
      ON inventory_market_links FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM items i
          WHERE i.id = inventory_market_links.item_id
          AND i.user_id = auth.uid()
        )
      );

    DROP POLICY IF EXISTS "Users can insert inventory market links for their items" ON inventory_market_links;
    CREATE POLICY "Users can insert inventory market links for their items"
      ON inventory_market_links FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM items i
          WHERE i.id = inventory_market_links.item_id
          AND i.user_id = auth.uid()
        )
      );

    DROP POLICY IF EXISTS "Users can update inventory market links for their items" ON inventory_market_links;
    CREATE POLICY "Users can update inventory market links for their items"
      ON inventory_market_links FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM items i
          WHERE i.id = inventory_market_links.item_id
          AND i.user_id = auth.uid()
        )
      );

    DROP POLICY IF EXISTS "Users can delete inventory market links for their items" ON inventory_market_links;
    CREATE POLICY "Users can delete inventory market links for their items"
      ON inventory_market_links FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM items i
          WHERE i.id = inventory_market_links.item_id
          AND i.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get latest market price for a product/variant
CREATE OR REPLACE FUNCTION get_stockx_latest_price(
  p_stockx_product_id TEXT,
  p_stockx_variant_id TEXT,
  p_currency_code TEXT DEFAULT 'USD'
)
RETURNS TABLE (
  last_sale_price DECIMAL(10, 2),
  lowest_ask DECIMAL(10, 2),
  highest_bid DECIMAL(10, 2),
  snapshot_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sml.last_sale_price,
    sml.lowest_ask,
    sml.highest_bid,
    sml.snapshot_at
  FROM stockx_market_latest sml
  WHERE sml.stockx_product_id = p_stockx_product_id
    AND sml.stockx_variant_id = p_stockx_variant_id
    AND sml.currency_code = p_currency_code
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to find StockX product by GTIN (barcode)
CREATE OR REPLACE FUNCTION find_stockx_by_gtin(p_gtin TEXT)
RETURNS TABLE (
  product_id UUID,
  variant_id UUID,
  stockx_product_id TEXT,
  stockx_variant_id TEXT,
  style_id TEXT,
  title TEXT,
  brand TEXT,
  variant_value TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS product_id,
    v.id AS variant_id,
    p.stockx_product_id,
    v.stockx_variant_id,
    p.style_id,
    p.title,
    p.brand,
    v.variant_value
  FROM stockx_products p
  JOIN stockx_variants v ON v.product_id = p.id
  WHERE p_gtin = ANY(v.gtins)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to refresh the materialized view
-- This should be called periodically (e.g., every 5 minutes via cron)
CREATE OR REPLACE FUNCTION refresh_stockx_market_latest()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY stockx_market_latest;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS (Auto-update timestamps)
-- ============================================================================

-- Update updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_stockx_products_updated_at ON stockx_products;
CREATE TRIGGER update_stockx_products_updated_at
  BEFORE UPDATE ON stockx_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stockx_variants_updated_at ON stockx_variants;
CREATE TRIGGER update_stockx_variants_updated_at
  BEFORE UPDATE ON stockx_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stockx_listings_updated_at ON stockx_listings;
CREATE TRIGGER update_stockx_listings_updated_at
  BEFORE UPDATE ON stockx_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stockx_orders_updated_at ON stockx_orders;
CREATE TRIGGER update_stockx_orders_updated_at
  BEFORE UPDATE ON stockx_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stockx_batch_jobs_updated_at ON stockx_batch_jobs;
CREATE TRIGGER update_stockx_batch_jobs_updated_at
  BEFORE UPDATE ON stockx_batch_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_market_links_updated_at ON inventory_market_links;
CREATE TRIGGER update_inventory_market_links_updated_at
  BEFORE UPDATE ON inventory_market_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stockx_batch_job_items_updated_at ON stockx_batch_job_items;
CREATE TRIGGER update_stockx_batch_job_items_updated_at
  BEFORE UPDATE ON stockx_batch_job_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE stockx_products IS 'StockX product catalog (shared across all users)';
COMMENT ON TABLE stockx_variants IS 'StockX product variants (sizes/colors) with GTIN barcode support';
COMMENT ON TABLE stockx_market_snapshots IS 'Time-series market data snapshots - consider partitioning by month for production';
COMMENT ON TABLE stockx_listings IS 'User-created StockX listings (asks) with soft delete support';
COMMENT ON TABLE stockx_orders IS 'Completed sales/orders from StockX with soft delete support';
COMMENT ON TABLE stockx_batch_jobs IS 'Tracking for bulk listing operations - summary only, items in separate table';
COMMENT ON TABLE stockx_batch_job_items IS 'Individual items within batch jobs - prevents JSONB bloat in parent table';
COMMENT ON TABLE watchlist_market_links IS 'Links watchlist items to StockX market data';
COMMENT ON TABLE inventory_market_links IS 'Links inventory items to StockX listings and market data';

COMMENT ON MATERIALIZED VIEW stockx_market_latest IS 'Latest market data snapshot for each product/variant/currency - refresh via refresh_stockx_market_latest()';

COMMENT ON FUNCTION get_stockx_latest_price IS 'Get latest market price for a StockX product/variant';
COMMENT ON FUNCTION find_stockx_by_gtin IS 'Find StockX product by GTIN/barcode';
COMMENT ON FUNCTION refresh_stockx_market_latest IS 'Refresh the materialized view - call via cron every 5 minutes';

-- ============================================================================
-- PERFORMANCE & SCALABILITY NOTES
-- ============================================================================
--
-- TABLE PARTITIONING (for production scale):
--
-- When stockx_market_snapshots grows beyond 10M rows, consider monthly partitioning:
--
-- 1. Convert to partitioned table:
--    ALTER TABLE stockx_market_snapshots RENAME TO stockx_market_snapshots_old;
--    CREATE TABLE stockx_market_snapshots (LIKE stockx_market_snapshots_old INCLUDING ALL)
--      PARTITION BY RANGE (snapshot_at);
--
-- 2. Create monthly partitions:
--    CREATE TABLE stockx_market_snapshots_2025_01 PARTITION OF stockx_market_snapshots
--      FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
--    CREATE TABLE stockx_market_snapshots_2025_02 PARTITION OF stockx_market_snapshots
--      FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
--    -- etc...
--
-- 3. Migrate data and drop old table:
--    INSERT INTO stockx_market_snapshots SELECT * FROM stockx_market_snapshots_old;
--    DROP TABLE stockx_market_snapshots_old;
--
-- 4. Set up automatic partition creation (pg_partman extension recommended)
--
-- MATERIALIZED VIEW REFRESH:
--
-- Set up cron job to refresh the materialized view every 5 minutes:
--   SELECT cron.schedule('refresh-stockx-market', '*/5 * * * *', 'SELECT refresh_stockx_market_latest()');
--
-- Or use Supabase Edge Functions with pg_cron extension
--
-- SOFT DELETES:
--
-- stockx_listings and stockx_orders support soft deletes via deleted_at column.
-- Set up archive job to permanently delete records after 90 days:
--   DELETE FROM stockx_listings WHERE deleted_at < now() - interval '90 days';
--   DELETE FROM stockx_orders WHERE deleted_at < now() - interval '90 days';
--
-- INDEXES:
--
-- All composite indexes use partial WHERE clauses to reduce index size.
-- Monitor query performance and add additional indexes as needed based on actual usage patterns.
