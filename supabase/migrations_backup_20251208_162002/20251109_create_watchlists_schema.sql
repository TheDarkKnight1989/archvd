-- Create Watchlists Schema
-- This migration creates the watchlists and watchlist_items tables with RLS policies

-- =============================================================================
-- WATCHLISTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT watchlist_name_not_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT watchlist_name_length CHECK (length(name) <= 100)
);

-- Create index for faster user-based queries
CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON public.watchlists(user_id);

-- Create index for sorting by name
CREATE INDEX IF NOT EXISTS idx_watchlists_name ON public.watchlists(user_id, name);

-- =============================================================================
-- WATCHLIST_ITEMS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id UUID NOT NULL REFERENCES public.watchlists(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  size TEXT,
  target_price NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT watchlist_item_sku_not_empty CHECK (length(trim(sku)) > 0),
  CONSTRAINT watchlist_item_target_price_positive CHECK (target_price IS NULL OR target_price > 0),

  -- Prevent duplicate SKU+size in same watchlist
  CONSTRAINT unique_watchlist_sku_size UNIQUE (watchlist_id, sku, size)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist_id ON public.watchlist_items(watchlist_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_sku ON public.watchlist_items(sku);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_created_at ON public.watchlist_items(watchlist_id, created_at DESC);

-- =============================================================================
-- UPDATED_AT TRIGGER FOR WATCHLISTS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_watchlist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_watchlist_updated_at
  BEFORE UPDATE ON public.watchlists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_watchlist_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on watchlists table
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;

-- Enable RLS on watchlist_items table
ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;

-- Watchlists Policies:
-- Users can only see their own watchlists
CREATE POLICY "Users can view own watchlists"
  ON public.watchlists
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own watchlists
CREATE POLICY "Users can insert own watchlists"
  ON public.watchlists
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own watchlists
CREATE POLICY "Users can update own watchlists"
  ON public.watchlists
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own watchlists
CREATE POLICY "Users can delete own watchlists"
  ON public.watchlists
  FOR DELETE
  USING (auth.uid() = user_id);

-- Watchlist Items Policies:
-- Users can view items in their own watchlists
CREATE POLICY "Users can view items in own watchlists"
  ON public.watchlist_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.watchlists
      WHERE watchlists.id = watchlist_items.watchlist_id
      AND watchlists.user_id = auth.uid()
    )
  );

-- Users can insert items into their own watchlists
CREATE POLICY "Users can insert items into own watchlists"
  ON public.watchlist_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.watchlists
      WHERE watchlists.id = watchlist_items.watchlist_id
      AND watchlists.user_id = auth.uid()
    )
  );

-- Users can update items in their own watchlists
CREATE POLICY "Users can update items in own watchlists"
  ON public.watchlist_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.watchlists
      WHERE watchlists.id = watchlist_items.watchlist_id
      AND watchlists.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.watchlists
      WHERE watchlists.id = watchlist_items.watchlist_id
      AND watchlists.user_id = auth.uid()
    )
  );

-- Users can delete items from their own watchlists
CREATE POLICY "Users can delete items from own watchlists"
  ON public.watchlist_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.watchlists
      WHERE watchlists.id = watchlist_items.watchlist_id
      AND watchlists.user_id = auth.uid()
    )
  );

-- =============================================================================
-- HELPER VIEW: Watchlists with item counts
-- =============================================================================

CREATE OR REPLACE VIEW public.watchlists_with_counts AS
SELECT
  w.id,
  w.user_id,
  w.name,
  w.created_at,
  w.updated_at,
  COUNT(wi.id) as item_count
FROM public.watchlists w
LEFT JOIN public.watchlist_items wi ON w.id = wi.watchlist_id
GROUP BY w.id, w.user_id, w.name, w.created_at, w.updated_at;

-- Grant access to the view
GRANT SELECT ON public.watchlists_with_counts TO authenticated;

-- =============================================================================
-- SEED DATA: Create a default watchlist for testing (optional)
-- =============================================================================

-- Note: This will only work after a user is created
-- Uncomment and replace user_id when testing

-- INSERT INTO public.watchlists (user_id, name)
-- VALUES
--   ('YOUR_USER_ID_HERE', 'My Watchlist')
-- ON CONFLICT DO NOTHING;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify tables were created
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('watchlists', 'watchlist_items')
ORDER BY table_name;

-- Verify indexes were created
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('watchlists', 'watchlist_items')
ORDER BY tablename, indexname;

-- Verify RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('watchlists', 'watchlist_items');

-- Verify policies were created
SELECT
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('watchlists', 'watchlist_items')
ORDER BY tablename, policyname;
