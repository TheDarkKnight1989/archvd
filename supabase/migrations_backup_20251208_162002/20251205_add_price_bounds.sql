-- ============================================================================
-- Add Price Bounds to Product Catalog
-- Date: 2025-12-05
-- Purpose: Store min/max allowed listing prices for validation and UX guidance
-- ============================================================================

-- Add price bound columns to product_catalog
ALTER TABLE public.product_catalog
  ADD COLUMN IF NOT EXISTS min_listing_price INTEGER,  -- In pennies/cents
  ADD COLUMN IF NOT EXISTS max_listing_price INTEGER;  -- In pennies/cents

-- Add indexes for price range queries
CREATE INDEX IF NOT EXISTS idx_product_catalog_price_range
  ON public.product_catalog(min_listing_price, max_listing_price)
  WHERE min_listing_price IS NOT NULL AND max_listing_price IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.product_catalog.min_listing_price IS 'Minimum allowed listing price in pennies (for validation)';
COMMENT ON COLUMN public.product_catalog.max_listing_price IS 'Maximum allowed listing price in pennies (for validation)';

-- ============================================================================
-- Helper function to validate price is within bounds
-- ============================================================================

CREATE OR REPLACE FUNCTION is_price_within_bounds(
  p_sku TEXT,
  p_price_pennies INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_min_price INTEGER;
  v_max_price INTEGER;
BEGIN
  SELECT min_listing_price, max_listing_price
  INTO v_min_price, v_max_price
  FROM public.product_catalog
  WHERE sku = p_sku;

  -- If bounds not set, allow any price
  IF v_min_price IS NULL OR v_max_price IS NULL THEN
    RETURN true;
  END IF;

  -- Check if price is within bounds
  RETURN p_price_pennies >= v_min_price AND p_price_pennies <= v_max_price;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION is_price_within_bounds IS 'Check if a listing price is within allowed bounds for a SKU';

-- ============================================================================
-- Helper function to get price guidance text
-- ============================================================================

CREATE OR REPLACE FUNCTION get_price_guidance(
  p_sku TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_min_price INTEGER;
  v_max_price INTEGER;
  v_currency TEXT;
BEGIN
  SELECT min_listing_price, max_listing_price
  INTO v_min_price, v_max_price
  FROM public.product_catalog
  WHERE sku = p_sku;

  -- If bounds not set, return null
  IF v_min_price IS NULL OR v_max_price IS NULL THEN
    RETURN NULL;
  END IF;

  -- Format as price range (assuming GBP pennies)
  v_currency := '£';
  RETURN v_currency || (v_min_price / 100.0)::TEXT || ' - ' || v_currency || (v_max_price / 100.0)::TEXT;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_price_guidance IS 'Get human-readable price range guidance for a SKU';

-- ============================================================================
-- Done!
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Price bounds columns added to product_catalog';
  RAISE NOTICE '📏 Helper functions created:';
  RAISE NOTICE '   - is_price_within_bounds(sku, price_pennies)';
  RAISE NOTICE '   - get_price_guidance(sku)';
  RAISE NOTICE '';
  RAISE NOTICE 'Example usage:';
  RAISE NOTICE '  SELECT is_price_within_bounds(''DZ5485-410'', 15000);  -- Check if £150 is valid';
  RAISE NOTICE '  SELECT get_price_guidance(''DZ5485-410'');  -- Get "£142 - £280"';
END $$;
