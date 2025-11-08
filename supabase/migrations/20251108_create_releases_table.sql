-- Create releases table for Matrix V2 releases pipeline
-- Sourced from thedropdate.com and other providers

-- Main releases table
CREATE TABLE IF NOT EXISTS releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source tracking
  source text NOT NULL, -- 'thedropdate', 'nike', 'size', etc.
  external_id text NOT NULL UNIQUE, -- stable slug or canonical URL for deduping

  -- Product info
  title text NOT NULL,
  brand text NOT NULL,
  model text NOT NULL,
  colorway text,
  sku text,

  -- Release timing
  release_date timestamptz, -- UTC; null if TBA

  -- Pricing
  price_gbp numeric(10, 2), -- null if TBA

  -- Media & links
  image_url text,
  product_url text, -- canonical release page on source site

  -- Structured data
  retailers jsonb DEFAULT '[]'::jsonb, -- [{name, url}]

  -- Status (computed)
  status text NOT NULL DEFAULT 'tba' CHECK (status IN ('upcoming', 'dropped', 'tba')),

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_releases_source ON releases(source);
CREATE INDEX IF NOT EXISTS idx_releases_external_id ON releases(external_id);
CREATE INDEX IF NOT EXISTS idx_releases_release_date ON releases(release_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_releases_brand ON releases(brand text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_releases_status ON releases(status);
CREATE INDEX IF NOT EXISTS idx_releases_created_at ON releases(created_at DESC);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_releases_search ON releases
  USING gin((
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(brand, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(model, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(sku, '')), 'C')
  ));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_releases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_releases_updated_at
  BEFORE UPDATE ON releases
  FOR EACH ROW
  EXECUTE FUNCTION update_releases_updated_at();

-- Function to auto-compute status based on release_date
CREATE OR REPLACE FUNCTION compute_release_status(release_date timestamptz)
RETURNS text AS $$
BEGIN
  IF release_date IS NULL THEN
    RETURN 'tba';
  ELSIF release_date > now() THEN
    RETURN 'upcoming';
  ELSE
    RETURN 'dropped';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-set status on insert/update
CREATE OR REPLACE FUNCTION auto_set_release_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.status = compute_release_status(NEW.release_date);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_set_release_status
  BEFORE INSERT OR UPDATE ON releases
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_release_status();

-- Scrape cache table for polite crawling
CREATE TABLE IF NOT EXISTS scrape_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE, -- e.g., 'thedropdate:page:1'
  html text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL, -- TTL (6 hours default)

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scrape_cache_key ON scrape_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_scrape_cache_expires ON scrape_cache(expires_at);

-- Ingest logs table for monitoring
CREATE TABLE IF NOT EXISTS release_ingest_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  run_at timestamptz NOT NULL DEFAULT now(),
  pages_fetched integer NOT NULL DEFAULT 0,
  items_inserted integer NOT NULL DEFAULT 0,
  items_updated integer NOT NULL DEFAULT 0,
  items_skipped integer NOT NULL DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb,
  duration_ms integer,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingest_logs_source ON release_ingest_logs(source);
CREATE INDEX IF NOT EXISTS idx_ingest_logs_run_at ON release_ingest_logs(run_at DESC);

-- RLS policies (allow authenticated read, service role write)
ALTER TABLE releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_ingest_logs ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read releases
CREATE POLICY "Authenticated users can read releases"
  ON releases FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can write/update
CREATE POLICY "Service role can insert releases"
  ON releases FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update releases"
  ON releases FOR UPDATE
  TO service_role
  USING (true);

-- Scrape cache: service role only
CREATE POLICY "Service role can manage scrape cache"
  ON scrape_cache FOR ALL
  TO service_role
  USING (true);

-- Ingest logs: authenticated can read, service role can write
CREATE POLICY "Authenticated users can read ingest logs"
  ON release_ingest_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert ingest logs"
  ON release_ingest_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON releases TO authenticated;
GRANT ALL ON releases TO service_role;
GRANT ALL ON scrape_cache TO service_role;
GRANT SELECT ON release_ingest_logs TO authenticated;
GRANT ALL ON release_ingest_logs TO service_role;

-- Sample data for testing (optional - remove in production)
-- INSERT INTO releases (source, external_id, title, brand, model, colorway, sku, release_date, price_gbp, image_url, product_url, retailers, status)
-- VALUES
--   ('thedropdate', 'nike-dunk-low-panda-2024', 'Nike Dunk Low Retro', 'Nike', 'Dunk Low Retro', 'Panda', 'DD1391-100', now() + interval '7 days', 110.00, 'https://example.com/image.jpg', 'https://thedropdate.com/releases/nike-dunk-low-panda', '[{"name": "Nike SNKRS", "url": "https://nike.com"}]'::jsonb, 'upcoming');
