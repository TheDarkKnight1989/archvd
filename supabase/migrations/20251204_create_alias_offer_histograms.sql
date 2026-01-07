-- Create table for Alias offer histogram (bid depth) data
-- This stores the complete bid ladder for each size, enabling depth chart visualization

CREATE TABLE IF NOT EXISTS alias_offer_histograms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Product identification
  catalog_id text NOT NULL,
  sku text NOT NULL,

  -- Size information
  size_value numeric NOT NULL,
  size_unit text DEFAULT 'US',

  -- Histogram bin data
  price_cents integer NOT NULL, -- Offer price in cents
  offer_count integer NOT NULL, -- Number of offers at this price point

  -- Region
  region_code text DEFAULT 'global',

  -- Conditions (always NEW + GOOD_CONDITION for now)
  product_condition text DEFAULT 'PRODUCT_CONDITION_NEW',
  packaging_condition text DEFAULT 'PACKAGING_CONDITION_GOOD_CONDITION',
  consigned boolean DEFAULT false,

  -- Snapshot metadata
  snapshot_at timestamptz NOT NULL,
  raw_snapshot_id uuid, -- References alias_raw_snapshots(id) if that table exists

  -- Audit fields
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_alias_offer_histograms_catalog_size
  ON alias_offer_histograms(catalog_id, size_value, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_alias_offer_histograms_sku
  ON alias_offer_histograms(sku, size_value, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_alias_offer_histograms_snapshot
  ON alias_offer_histograms(snapshot_at DESC);

-- Composite index for fetching latest histogram by catalog + size
CREATE INDEX IF NOT EXISTS idx_alias_offer_histograms_latest
  ON alias_offer_histograms(catalog_id, size_value, region_code, consigned, snapshot_at DESC);

-- Add comments
COMMENT ON TABLE alias_offer_histograms IS 'Stores Alias offer histogram (bid depth) data for visualization of bid ladders and market depth charts';
COMMENT ON COLUMN alias_offer_histograms.price_cents IS 'Offer price in cents';
COMMENT ON COLUMN alias_offer_histograms.offer_count IS 'Number of offers at this price point';
COMMENT ON COLUMN alias_offer_histograms.snapshot_at IS 'Timestamp when this histogram snapshot was captured';

-- Enable RLS
ALTER TABLE alias_offer_histograms ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated users to read histograms"
  ON alias_offer_histograms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow service role to manage histograms"
  ON alias_offer_histograms FOR ALL
  TO service_role
  USING (true);
