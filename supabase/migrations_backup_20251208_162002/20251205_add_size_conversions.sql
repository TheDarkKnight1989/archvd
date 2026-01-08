-- ============================================================================
-- Size Conversion Support
-- Date: 2025-12-05
-- Purpose: Add US ↔ UK ↔ EU size conversion mappings
-- ============================================================================

-- ============================================================================
-- 1. SIZE CONVERSION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.size_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Category
  category TEXT NOT NULL CHECK (category IN ('sneakers', 'apparel', 'accessories')),
  gender TEXT NOT NULL CHECK (gender IN ('men', 'women', 'youth', 'infant', 'unisex')),

  -- Size values in different systems
  us_size NUMERIC(5,1) NOT NULL,      -- US size (e.g., 10.5)
  uk_size NUMERIC(5,1) NULL,          -- UK size (e.g., 9.5)
  eu_size NUMERIC(5,1) NULL,          -- EU size (e.g., 44.5)
  jp_size NUMERIC(5,1) NULL,          -- JP/CM size (e.g., 28.5)

  -- Display labels (for cases like "OS" = One Size)
  us_display TEXT NOT NULL,           -- e.g., "10.5", "M", "OS"
  uk_display TEXT NULL,
  eu_display TEXT NULL,
  jp_display TEXT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one row per category/gender/us_size combination
CREATE UNIQUE INDEX idx_size_conversions_unique ON public.size_conversions (
  category,
  gender,
  us_size
);

-- Indexes for lookups
CREATE INDEX idx_size_conversions_category ON public.size_conversions(category);
CREATE INDEX idx_size_conversions_gender ON public.size_conversions(gender);
CREATE INDEX idx_size_conversions_us ON public.size_conversions(us_size);
CREATE INDEX idx_size_conversions_uk ON public.size_conversions(uk_size) WHERE uk_size IS NOT NULL;
CREATE INDEX idx_size_conversions_eu ON public.size_conversions(eu_size) WHERE eu_size IS NOT NULL;

COMMENT ON TABLE public.size_conversions IS 'Size conversion mappings for US ↔ UK ↔ EU ↔ JP sizes';

-- ============================================================================
-- 2. HELPER FUNCTIONS
-- ============================================================================

-- Function to convert US size to UK size
CREATE OR REPLACE FUNCTION convert_size(
  p_from_size NUMERIC,
  p_from_system TEXT,
  p_to_system TEXT,
  p_category TEXT DEFAULT 'sneakers',
  p_gender TEXT DEFAULT 'unisex'
)
RETURNS NUMERIC AS $$
DECLARE
  v_result NUMERIC;
BEGIN
  -- Validate inputs
  IF p_from_system NOT IN ('us', 'uk', 'eu', 'jp') THEN
    RAISE EXCEPTION 'Invalid from_system: %', p_from_system;
  END IF;

  IF p_to_system NOT IN ('us', 'uk', 'eu', 'jp') THEN
    RAISE EXCEPTION 'Invalid to_system: %', p_to_system;
  END IF;

  -- Look up conversion
  IF p_from_system = 'us' THEN
    EXECUTE format('SELECT %I FROM size_conversions WHERE category = $1 AND gender = $2 AND us_size = $3',
      p_to_system || '_size')
    INTO v_result
    USING p_category, p_gender, p_from_size;
  ELSIF p_from_system = 'uk' THEN
    EXECUTE format('SELECT %I FROM size_conversions WHERE category = $1 AND gender = $2 AND uk_size = $3',
      p_to_system || '_size')
    INTO v_result
    USING p_category, p_gender, p_from_size;
  ELSIF p_from_system = 'eu' THEN
    EXECUTE format('SELECT %I FROM size_conversions WHERE category = $1 AND gender = $2 AND eu_size = $3',
      p_to_system || '_size')
    INTO v_result
    USING p_category, p_gender, p_from_size;
  ELSIF p_from_system = 'jp' THEN
    EXECUTE format('SELECT %I FROM size_conversions WHERE category = $1 AND gender = $2 AND jp_size = $3',
      p_to_system || '_size')
    INTO v_result
    USING p_category, p_gender, p_from_size;
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION convert_size IS 'Convert size from one system to another (e.g., US 10.5 → UK 9.5)';

-- ============================================================================
-- 3. SEED DATA - Men's Sneaker Sizes (Most Common)
-- ============================================================================

INSERT INTO public.size_conversions (category, gender, us_size, uk_size, eu_size, jp_size, us_display, uk_display, eu_display, jp_display)
VALUES
  -- Men's sneakers
  ('sneakers', 'men', 4.0, 3.5, 36.0, 23.0, '4', '3.5', '36', '23'),
  ('sneakers', 'men', 4.5, 4.0, 36.5, 23.5, '4.5', '4', '36.5', '23.5'),
  ('sneakers', 'men', 5.0, 4.5, 37.5, 23.5, '5', '4.5', '37.5', '23.5'),
  ('sneakers', 'men', 5.5, 5.0, 38.0, 24.0, '5.5', '5', '38', '24'),
  ('sneakers', 'men', 6.0, 5.5, 39.0, 24.0, '6', '5.5', '39', '24'),
  ('sneakers', 'men', 6.5, 6.0, 39.5, 24.5, '6.5', '6', '39.5', '24.5'),
  ('sneakers', 'men', 7.0, 6.5, 40.0, 25.0, '7', '6.5', '40', '25'),
  ('sneakers', 'men', 7.5, 7.0, 40.5, 25.5, '7.5', '7', '40.5', '25.5'),
  ('sneakers', 'men', 8.0, 7.5, 41.0, 26.0, '8', '7.5', '41', '26'),
  ('sneakers', 'men', 8.5, 8.0, 42.0, 26.5, '8.5', '8', '42', '26.5'),
  ('sneakers', 'men', 9.0, 8.5, 42.5, 27.0, '9', '8.5', '42.5', '27'),
  ('sneakers', 'men', 9.5, 9.0, 43.0, 27.5, '9.5', '9', '43', '27.5'),
  ('sneakers', 'men', 10.0, 9.5, 44.0, 28.0, '10', '9.5', '44', '28'),
  ('sneakers', 'men', 10.5, 10.0, 44.5, 28.5, '10.5', '10', '44.5', '28.5'),
  ('sneakers', 'men', 11.0, 10.5, 45.0, 29.0, '11', '10.5', '45', '29'),
  ('sneakers', 'men', 11.5, 11.0, 45.5, 29.5, '11.5', '11', '45.5', '29.5'),
  ('sneakers', 'men', 12.0, 11.5, 46.0, 30.0, '12', '11.5', '46', '30'),
  ('sneakers', 'men', 12.5, 12.0, 47.0, 30.5, '12.5', '12', '47', '30.5'),
  ('sneakers', 'men', 13.0, 12.5, 47.5, 31.0, '13', '12.5', '47.5', '31'),
  ('sneakers', 'men', 13.5, 13.0, 48.0, 31.5, '13.5', '13', '48', '31.5'),
  ('sneakers', 'men', 14.0, 13.5, 48.5, 32.0, '14', '13.5', '48.5', '32'),
  ('sneakers', 'men', 14.5, 14.0, 49.0, 32.5, '14.5', '14', '49', '32.5'),
  ('sneakers', 'men', 15.0, 14.5, 49.5, 33.0, '15', '14.5', '49.5', '33'),
  ('sneakers', 'men', 16.0, 15.5, 51.0, 34.0, '16', '15.5', '51', '34'),
  ('sneakers', 'men', 17.0, 16.5, 52.5, 35.0, '17', '16.5', '52.5', '35'),
  ('sneakers', 'men', 18.0, 17.5, 54.0, 36.0, '18', '17.5', '54', '36')
ON CONFLICT (category, gender, us_size) DO NOTHING;

-- ============================================================================
-- 4. GRANTS
-- ============================================================================

GRANT SELECT ON public.size_conversions TO authenticated, anon;
GRANT ALL ON public.size_conversions TO service_role;

-- ============================================================================
-- Done!
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Size conversion table created';
  RAISE NOTICE '📏 Seeded with men''s sneaker sizes (US 4-18)';
  RAISE NOTICE '🔄 Helper function: convert_size(from_size, from_system, to_system)';
  RAISE NOTICE '';
  RAISE NOTICE '📝 TODO: Add women''s, youth, and apparel size mappings';
END $$;
