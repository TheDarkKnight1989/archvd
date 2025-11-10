-- =============================================================================
-- Sprint: Alpha Polish - Watchlist Alerts + Activity Feed
-- Migration: Watchlist price alerts and portfolio activity logging
-- Date: 2025-11-13
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- A) WATCHLIST ALERTS SCHEMA
-- ─────────────────────────────────────────────────────────────────────────────

-- A1. Extend watchlist_items with alert tracking
ALTER TABLE public.watchlist_items
ADD COLUMN IF NOT EXISTS last_triggered_at timestamptz NULL;

COMMENT ON COLUMN public.watchlist_items.last_triggered_at IS
  'Last time this watchlist item triggered a price alert (when current price <= target price)';

-- A2. Index for efficient alert queries
CREATE INDEX IF NOT EXISTS idx_watchlist_items_triggered
  ON public.watchlist_items(last_triggered_at DESC NULLS LAST)
  WHERE last_triggered_at IS NOT NULL;

-- A3. Function to check and refresh watchlist alerts
CREATE OR REPLACE FUNCTION public.refresh_watchlist_alerts(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_triggered_items jsonb[] := '{}';
  v_item record;
  v_current_price numeric;
  v_delta_pct numeric;
BEGIN
  -- For each watchlist item (optionally filtered by user)
  FOR v_item IN
    SELECT
      wi.id,
      w.user_id,
      wi.sku,
      wi.size,
      wi.target_price,
      wi.currency,
      wi.last_triggered_at,
      w.name as watchlist_name
    FROM watchlist_items wi
    JOIN watchlists w ON wi.watchlist_id = w.id
    WHERE (p_user_id IS NULL OR w.user_id = p_user_id)
      AND wi.target_price IS NOT NULL
  LOOP
    -- Determine category from SKU pattern
    IF v_item.sku LIKE 'PKMN-%' THEN
      -- Pokémon: use tcg_latest_prices
      SELECT median_price INTO v_current_price
      FROM tcg_latest_prices
      WHERE sku = v_item.sku
        AND currency = v_item.currency
      ORDER BY as_of DESC
      LIMIT 1;
    ELSE
      -- Sneakers: use sneaker_latest_prices (default to UK9 if size not specified)
      SELECT median_price INTO v_current_price
      FROM sneaker_latest_prices
      WHERE sku = v_item.sku
        AND size = COALESCE(v_item.size, 'UK9')
        AND currency = v_item.currency
      ORDER BY as_of DESC
      LIMIT 1;
    END IF;

    -- Check if alert should trigger
    IF v_current_price IS NOT NULL AND v_current_price <= v_item.target_price THEN
      -- Calculate delta percentage
      v_delta_pct := ((v_current_price - v_item.target_price) / v_item.target_price) * 100;

      -- Update last_triggered_at
      UPDATE watchlist_items
      SET last_triggered_at = NOW()
      WHERE id = v_item.id;

      -- Add to triggered items
      v_triggered_items := array_append(
        v_triggered_items,
        jsonb_build_object(
          'id', v_item.id,
          'user_id', v_item.user_id,
          'sku', v_item.sku,
          'size', v_item.size,
          'watchlist_name', v_item.watchlist_name,
          'target_price', v_item.target_price,
          'current_price', v_current_price,
          'delta_pct', v_delta_pct,
          'currency', v_item.currency,
          'previously_triggered', v_item.last_triggered_at IS NOT NULL
        )
      );
    END IF;
  END LOOP;

  -- Build result summary
  v_result := jsonb_build_object(
    'triggered_count', array_length(v_triggered_items, 1),
    'triggered_items', to_jsonb(v_triggered_items)
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.refresh_watchlist_alerts IS
  'Checks all watchlist items against current market prices and updates last_triggered_at when target price is met. Returns summary of triggered alerts.';

-- ─────────────────────────────────────────────────────────────────────────────
-- B) PORTFOLIO ACTIVITY LOG
-- ─────────────────────────────────────────────────────────────────────────────

-- B1. Activity log table
CREATE TABLE IF NOT EXISTS public.portfolio_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('add', 'sale', 'price_update', 'alert', 'edit', 'delete')),
  sku text,
  item_name text,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_portfolio_activity_log_user_created
  ON public.portfolio_activity_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_activity_log_type
  ON public.portfolio_activity_log(type);

CREATE INDEX IF NOT EXISTS idx_portfolio_activity_log_created
  ON public.portfolio_activity_log(created_at DESC);

COMMENT ON TABLE public.portfolio_activity_log IS
  'Tracks user portfolio events (add, sale, alerts) for activity feed display';

-- B2. RLS Policies for activity log
ALTER TABLE public.portfolio_activity_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own activity
CREATE POLICY "Users can view own activity log"
  ON public.portfolio_activity_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own activity
CREATE POLICY "Users can insert own activity log"
  ON public.portfolio_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Service role can manage all activity
CREATE POLICY "Service role can manage activity log"
  ON public.portfolio_activity_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- B3. Helper function to log activity
CREATE OR REPLACE FUNCTION public.log_portfolio_activity(
  p_user_id uuid,
  p_type text,
  p_message text,
  p_sku text DEFAULT NULL,
  p_item_name text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO portfolio_activity_log (user_id, type, sku, item_name, message, metadata)
  VALUES (p_user_id, p_type, p_sku, p_item_name, p_message, p_metadata)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.log_portfolio_activity IS
  'Helper function to log portfolio activity events. Returns the created activity ID.';

-- B4. Trigger function for inventory adds
CREATE OR REPLACE FUNCTION public.trigger_log_inventory_add()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM log_portfolio_activity(
    NEW.user_id,
    'add',
    'Added ' || COALESCE(NEW.brand || ' ' || NEW.model, NEW.sku) || ' to portfolio',
    NEW.sku,
    COALESCE(NEW.brand || ' ' || NEW.model, NEW.sku),
    jsonb_build_object(
      'purchase_price', NEW.purchase_price,
      'size', NEW.size_uk,
      'category', NEW.category
    )
  );
  RETURN NEW;
END;
$$;

-- B5. Trigger function for sales
CREATE OR REPLACE FUNCTION public.trigger_log_inventory_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only log when status changes to 'sold'
  IF NEW.status = 'sold' AND OLD.status != 'sold' AND NEW.sold_price IS NOT NULL THEN
    PERFORM log_portfolio_activity(
      NEW.user_id,
      'sale',
      'Sold ' || COALESCE(NEW.brand || ' ' || NEW.model, NEW.sku) || ' for ' || NEW.sold_price::text,
      NEW.sku,
      COALESCE(NEW.brand || ' ' || NEW.model, NEW.sku),
      jsonb_build_object(
        'sold_price', NEW.sold_price,
        'purchase_price', NEW.purchase_price,
        'margin', NEW.sold_price - (NEW.purchase_price + COALESCE(NEW.tax, 0) + COALESCE(NEW.shipping, 0)),
        'platform', NEW.platform
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- B6. Attach triggers to Inventory table
DROP TRIGGER IF EXISTS trigger_inventory_add ON "Inventory";
CREATE TRIGGER trigger_inventory_add
  AFTER INSERT ON "Inventory"
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_inventory_add();

DROP TRIGGER IF EXISTS trigger_inventory_sale ON "Inventory";
CREATE TRIGGER trigger_inventory_sale
  AFTER UPDATE ON "Inventory"
  FOR EACH ROW
  WHEN (NEW.status = 'sold' AND OLD.status IS DISTINCT FROM 'sold')
  EXECUTE FUNCTION trigger_log_inventory_sale();

-- B7. Enhanced alert logging via trigger on watchlist_items
CREATE OR REPLACE FUNCTION public.trigger_log_watchlist_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product_name text;
  v_current_price numeric;
BEGIN
  -- Only log if last_triggered_at changed from NULL or is >1 hour old
  IF NEW.last_triggered_at IS NOT NULL AND
     (OLD.last_triggered_at IS NULL OR
      NEW.last_triggered_at - OLD.last_triggered_at > INTERVAL '1 hour') THEN

    -- Fetch product name from catalog
    IF NEW.sku LIKE 'PKMN-%' THEN
      SELECT name, median_price INTO v_product_name, v_current_price
      FROM tcg_latest_prices
      WHERE sku = NEW.sku
      LIMIT 1;
    ELSE
      SELECT model, median_price INTO v_product_name, v_current_price
      FROM sneaker_latest_prices
      WHERE sku = NEW.sku AND size = COALESCE(NEW.size, 'UK9')
      LIMIT 1;
    END IF;

    -- Log alert activity
    PERFORM log_portfolio_activity(
      NEW.user_id,
      'alert',
      'Price alert: ' || COALESCE(v_product_name, NEW.sku) || ' now ' ||
        NEW.currency || v_current_price::text ||
        ' (target: ' || NEW.currency || NEW.target_price::text || ')',
      NEW.sku,
      COALESCE(v_product_name, NEW.sku),
      jsonb_build_object(
        'target_price', NEW.target_price,
        'current_price', v_current_price,
        'size', NEW.size,
        'currency', NEW.currency
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_watchlist_alert ON watchlist_items;
CREATE TRIGGER trigger_watchlist_alert
  AFTER UPDATE ON watchlist_items
  FOR EACH ROW
  WHEN (NEW.last_triggered_at IS NOT NULL)
  EXECUTE FUNCTION trigger_log_watchlist_alert();

-- ─────────────────────────────────────────────────────────────────────────────
-- C) PERMISSIONS
-- ─────────────────────────────────────────────────────────────────────────────

GRANT SELECT ON public.portfolio_activity_log TO authenticated;
GRANT INSERT ON public.portfolio_activity_log TO authenticated;
GRANT ALL ON public.portfolio_activity_log TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- D) SUCCESS MESSAGE
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20251113_watchlist_alerts_and_activity completed successfully';
  RAISE NOTICE '📦 Next steps:';
  RAISE NOTICE '   1. Test /api/watchlists/check-targets to trigger alerts';
  RAISE NOTICE '   2. Test /api/watchlists/alerts to fetch recent alerts';
  RAISE NOTICE '   3. Add items to portfolio and verify activity feed logs appear';
  RAISE NOTICE '   4. Mark items as sold and verify sale activity is logged';
END $$;
