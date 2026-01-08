-- Alias Catalog Items Table
-- Stores cached product metadata from Alias catalog API
-- Primary use: Product images, names, brands for display

CREATE TABLE IF NOT EXISTS alias_catalog_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Alias identifiers
  catalog_id TEXT NOT NULL UNIQUE,

  -- Product metadata
  product_name TEXT NOT NULL,
  brand TEXT,
  sku TEXT,
  slug TEXT UNIQUE, -- For clean URLs: slugified-product-name-sku

  -- Images
  image_url TEXT, -- Primary product image
  thumbnail_url TEXT, -- Thumbnail/small image

  -- Additional metadata
  category TEXT,
  colorway TEXT,
  retail_price_cents INTEGER,
  release_date DATE,

  -- Cache management
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_fetched_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  CONSTRAINT alias_catalog_items_catalog_id_key UNIQUE (catalog_id),
  CONSTRAINT alias_catalog_items_slug_key UNIQUE (slug)
);

-- Index for slug lookups (for URL routing)
CREATE INDEX IF NOT EXISTS idx_alias_catalog_items_slug
  ON alias_catalog_items(slug);

-- Index for SKU lookups
CREATE INDEX IF NOT EXISTS idx_alias_catalog_items_sku
  ON alias_catalog_items(sku);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_alias_catalog_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER alias_catalog_items_updated_at
  BEFORE UPDATE ON alias_catalog_items
  FOR EACH ROW
  EXECUTE FUNCTION update_alias_catalog_items_updated_at();

-- RLS Policies (public read for catalog data)
ALTER TABLE alias_catalog_items ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read catalog items
CREATE POLICY "Catalog items are viewable by authenticated users"
  ON alias_catalog_items
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert/update catalog items
CREATE POLICY "Catalog items manageable by service role"
  ON alias_catalog_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add helpful comment
COMMENT ON TABLE alias_catalog_items IS
  'Cached Alias catalog metadata including product images, names, and slugs for clean URLs';
