-- Fix RLS policies to allow public (anon) read access to market data
-- Market catalog and prices should be publicly viewable

-- product_catalog: Allow public reads
DROP POLICY IF EXISTS "Authenticated users can read catalog" ON public.product_catalog;
CREATE POLICY "Public users can read catalog"
  ON public.product_catalog FOR SELECT
  TO anon, authenticated
  USING (true);

-- product_market_prices: Allow public reads
DROP POLICY IF EXISTS "Authenticated users can read prices" ON public.product_market_prices;
CREATE POLICY "Public users can read prices"
  ON public.product_market_prices FOR SELECT
  TO anon, authenticated
  USING (true);

-- fx_rates: Allow public reads
DROP POLICY IF EXISTS "Authenticated users can read fx rates" ON public.fx_rates;
CREATE POLICY "Public users can read fx rates"
  ON public.fx_rates FOR SELECT
  TO anon, authenticated
  USING (true);

-- Verify policies are working
SELECT 'RLS policies updated for public read access' as status;
