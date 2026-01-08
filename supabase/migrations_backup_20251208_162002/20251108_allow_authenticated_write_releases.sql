-- Allow authenticated users to write to releases (for scraper API)
-- This is safe since the scraper API checks authentication

-- Drop old restrictive policies
DROP POLICY IF EXISTS "Service role can insert releases" ON releases;
DROP POLICY IF EXISTS "Service role can update releases" ON releases;

-- Allow authenticated users to insert/update releases
CREATE POLICY "Authenticated users can insert releases"
  ON releases FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update releases"
  ON releases FOR UPDATE
  TO authenticated
  USING (true);

-- Also allow authenticated to write to scrape_cache and logs
DROP POLICY IF EXISTS "Service role can manage scrape cache" ON scrape_cache;
CREATE POLICY "Authenticated users can manage scrape cache"
  ON scrape_cache FOR ALL
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role can insert ingest logs" ON release_ingest_logs;
CREATE POLICY "Authenticated users can insert ingest logs"
  ON release_ingest_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Keep service_role access too
CREATE POLICY "Service role can insert releases"
  ON releases FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update releases"
  ON releases FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Service role can manage scrape cache"
  ON scrape_cache FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert ingest logs"
  ON release_ingest_logs FOR INSERT
  TO service_role
  WITH CHECK (true);
