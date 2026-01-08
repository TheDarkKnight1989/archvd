-- ============================================================================
-- M2: Sales Split + FX Snapshots with Backwards Compatibility
-- Created: 2025-01-15
-- Purpose: Create dedicated sales table for realized transactions
-- ============================================================================

-- ============================================================================
-- 1. Add FX Snapshot Columns to Inventory (for purchases)
-- ============================================================================

DO $$
BEGIN
  -- purchase_total_base: purchase cost in user's base currency
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Inventory'
    AND column_name = 'purchase_total_base'
  ) THEN
    ALTER TABLE public."Inventory"
    ADD COLUMN purchase_total_base NUMERIC(12,2) NOT NULL DEFAULT 0;

    COMMENT ON COLUMN public."Inventory".purchase_total_base IS
    'Total purchase cost in user base currency (purchase_price + tax + shipping converted at purchase date FX rate)';
  END IF;

  -- fx_rate_at_purchase: exchange rate used for purchase conversion
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Inventory'
    AND column_name = 'fx_rate_at_purchase'
  ) THEN
    ALTER TABLE public."Inventory"
    ADD COLUMN fx_rate_at_purchase NUMERIC(12,6) NOT NULL DEFAULT 1.0;

    COMMENT ON COLUMN public."Inventory".fx_rate_at_purchase IS
    'FX rate from purchase currency to base currency at purchase date';
  END IF;
END $$;

-- Backfill purchase_total_base for existing items
UPDATE public."Inventory"
SET purchase_total_base = COALESCE(purchase_amount_base, purchase_price + COALESCE(tax, 0) + COALESCE(shipping, 0))
WHERE purchase_total_base = 0;

UPDATE public."Inventory"
SET fx_rate_at_purchase = COALESCE(purchase_fx_rate, 1.0)
WHERE fx_rate_at_purchase = 1.0;

-- ============================================================================
-- 2. Create Sales Table (Source of Truth for Realized Sales)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES public."Inventory"(id) ON DELETE SET NULL,

  -- Sale identification
  sold_date DATE NOT NULL,
  platform sale_platform NOT NULL DEFAULT 'other',

  -- Base currency accounting (REQUIRED - source of truth)
  base_currency CHAR(3) NOT NULL CHECK (base_currency IN ('GBP', 'EUR', 'USD')),
  fx_rate_at_sale NUMERIC(12,6) NOT NULL DEFAULT 1.0,

  -- Amounts in base currency (for P&L)
  sale_total_base NUMERIC(12,2) NOT NULL,
  fees_base NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_base NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Profit calculation (includes COGS from inventory)
  purchase_total_base NUMERIC(12,2) NOT NULL DEFAULT 0,
  profit_base NUMERIC(12,2) GENERATED ALWAYS AS (
    sale_total_base - purchase_total_base - fees_base - shipping_base
  ) STORED,

  -- Original amounts (for reference/audit)
  sale_price_original NUMERIC(12,2),
  sale_currency_original CHAR(3),
  fees_original NUMERIC(12,2),
  shipping_original NUMERIC(12,2),

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for sales table
CREATE INDEX IF NOT EXISTS idx_sales_user_date
ON public.sales(user_id, sold_date DESC);

CREATE INDEX IF NOT EXISTS idx_sales_inventory
ON public.sales(inventory_id) WHERE inventory_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_user_created
ON public.sales(user_id, created_at DESC);

-- Comments
COMMENT ON TABLE public.sales IS
'Realized sales transactions. Source of truth for P&L calculations using base currency amounts captured at sale time.';

COMMENT ON COLUMN public.sales.sale_total_base IS
'Total sale proceeds in base currency (converted at FX rate on sold_date)';

COMMENT ON COLUMN public.sales.fees_base IS
'Platform/transaction fees in base currency';

COMMENT ON COLUMN public.sales.shipping_base IS
'Shipping costs in base currency';

COMMENT ON COLUMN public.sales.profit_base IS
'Realized profit/loss: sale_total_base - purchase_total_base - fees_base - shipping_base';

-- ============================================================================
-- 3. RLS Policies for Sales Table
-- ============================================================================

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sales
CREATE POLICY sales_select_own
ON public.sales
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own sales
CREATE POLICY sales_insert_own
ON public.sales
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own sales
CREATE POLICY sales_update_own
ON public.sales
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own sales
CREATE POLICY sales_delete_own
ON public.sales
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================================================
-- 4. Compatibility View: sales_view_compat
-- ============================================================================
-- Provides backwards-compatible interface for existing code that reads from
-- Inventory where status='sold'

CREATE OR REPLACE VIEW public.sales_view_compat
WITH (security_invoker = on) AS
SELECT
  i.id,
  i.user_id,
  i.sku,
  i.brand,
  i.model,
  i.size_uk,
  i.size,
  i.category,
  i.condition,
  i.purchase_price,
  i.purchase_total_base,
  i.sold_price,
  i.sold_date,
  i.platform,
  i.sales_fee,
  i.notes,
  i.status,
  i.created_at,
  i.updated_at,
  -- Computed fields for compatibility
  (i.sold_price - i.purchase_price - COALESCE(i.sales_fee, 0)) AS margin,
  CASE
    WHEN i.purchase_price > 0
    THEN ((i.sold_price - i.purchase_price - COALESCE(i.sales_fee, 0)) / i.purchase_price * 100)
    ELSE 0
  END AS margin_percent,
  -- Join to sales table if exists
  s.id AS sales_id,
  s.sale_total_base,
  s.fees_base,
  s.profit_base
FROM public."Inventory" i
LEFT JOIN public.sales s ON s.inventory_id = i.id
WHERE i.status = 'sold'
  AND i.user_id = auth.uid()
ORDER BY i.sold_date DESC NULLS LAST, i.created_at DESC;

COMMENT ON VIEW public.sales_view_compat IS
'@deprecated Use sales table directly. Compatibility view for legacy code reading sold items from Inventory.';

-- Grant access
GRANT SELECT ON public.sales_view_compat TO authenticated;

-- ============================================================================
-- 5. Function: Migrate Sold Item to Sales Table
-- ============================================================================
-- Helper function to migrate a sold inventory item to the sales table

CREATE OR REPLACE FUNCTION public.fn_migrate_sold_to_sales(
  p_inventory_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sales_id UUID;
  v_item RECORD;
  v_base_currency CHAR(3);
BEGIN
  -- Get the inventory item
  SELECT * INTO v_item
  FROM public."Inventory"
  WHERE id = p_inventory_id
    AND status = 'sold';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item % not found or not sold', p_inventory_id;
  END IF;

  -- Get user's base currency
  SELECT base_currency INTO v_base_currency
  FROM public.profiles
  WHERE id = v_item.user_id;

  -- Check if sales record already exists
  SELECT id INTO v_sales_id
  FROM public.sales
  WHERE inventory_id = p_inventory_id;

  IF v_sales_id IS NOT NULL THEN
    RETURN v_sales_id; -- Already migrated
  END IF;

  -- Insert into sales table
  INSERT INTO public.sales (
    user_id,
    inventory_id,
    sold_date,
    platform,
    base_currency,
    fx_rate_at_sale,
    sale_total_base,
    fees_base,
    shipping_base,
    purchase_total_base,
    sale_price_original,
    sale_currency_original,
    fees_original,
    notes
  ) VALUES (
    v_item.user_id,
    p_inventory_id,
    COALESCE(v_item.sold_date, CURRENT_DATE),
    COALESCE(v_item.platform::sale_platform, 'other'),
    COALESCE(v_item.sale_base_ccy, v_base_currency),
    COALESCE(v_item.sale_fx_rate, 1.0),
    COALESCE(v_item.sale_amount_base, v_item.sold_price),
    COALESCE(v_item.sales_fee, 0),
    0, -- shipping_base (not tracked separately in old schema)
    COALESCE(v_item.purchase_total_base, v_item.purchase_price),
    v_item.sold_price,
    v_item.sale_currency,
    v_item.sales_fee,
    v_item.notes
  )
  RETURNING id INTO v_sales_id;

  RETURN v_sales_id;
END;
$$;

COMMENT ON FUNCTION public.fn_migrate_sold_to_sales IS
'Migrates a sold inventory item to the sales table. Idempotent - returns existing sales_id if already migrated.';

-- ============================================================================
-- 6. Trigger: Auto-create Sales Record on Mark as Sold
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trg_inventory_mark_sold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_currency CHAR(3);
  v_sales_id UUID;
BEGIN
  -- Only act when status changes to 'sold'
  IF NEW.status = 'sold' AND (OLD.status IS NULL OR OLD.status != 'sold') THEN

    -- Get user's base currency
    SELECT base_currency INTO v_base_currency
    FROM public.profiles
    WHERE id = NEW.user_id;

    -- Check if sales record already exists
    SELECT id INTO v_sales_id
    FROM public.sales
    WHERE inventory_id = NEW.id;

    IF v_sales_id IS NULL THEN
      -- Create sales record
      INSERT INTO public.sales (
        user_id,
        inventory_id,
        sold_date,
        platform,
        base_currency,
        fx_rate_at_sale,
        sale_total_base,
        fees_base,
        shipping_base,
        purchase_total_base,
        sale_price_original,
        sale_currency_original,
        fees_original,
        notes
      ) VALUES (
        NEW.user_id,
        NEW.id,
        COALESCE(NEW.sold_date, CURRENT_DATE),
        COALESCE(NEW.platform::sale_platform, 'other'),
        COALESCE(NEW.sale_base_ccy, v_base_currency, 'GBP'),
        COALESCE(NEW.sale_fx_rate, 1.0),
        COALESCE(NEW.sale_amount_base, NEW.sold_price, 0),
        COALESCE(NEW.sales_fee, 0),
        0,
        COALESCE(NEW.purchase_total_base, NEW.purchase_price, 0),
        NEW.sold_price,
        NEW.sale_currency,
        NEW.sales_fee,
        NEW.notes
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_inventory_mark_sold ON public."Inventory";
CREATE TRIGGER trigger_inventory_mark_sold
  AFTER INSERT OR UPDATE OF status ON public."Inventory"
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_inventory_mark_sold();

COMMENT ON FUNCTION public.trg_inventory_mark_sold IS
'Automatically creates a sales record when inventory item is marked as sold';

-- ============================================================================
-- 7. Backfill: Migrate Existing Sold Items to Sales Table
-- ============================================================================

DO $$
DECLARE
  v_count INTEGER := 0;
  v_item RECORD;
BEGIN
  FOR v_item IN
    SELECT id
    FROM public."Inventory"
    WHERE status = 'sold'
      AND id NOT IN (SELECT inventory_id FROM public.sales WHERE inventory_id IS NOT NULL)
  LOOP
    BEGIN
      PERFORM public.fn_migrate_sold_to_sales(v_item.id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to migrate item %: %', v_item.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Migrated % sold items to sales table', v_count;
END $$;

-- ============================================================================
-- 8. Update Updated_at Trigger for Sales
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trg_update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sales_updated_at ON public.sales;
CREATE TRIGGER trigger_sales_updated_at
  BEFORE UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_update_updated_at();

-- ============================================================================
-- 9. Verification
-- ============================================================================

DO $$
DECLARE
  v_sales_count INTEGER;
  v_sold_inv_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_sales_count FROM public.sales;
  SELECT COUNT(*) INTO v_sold_inv_count FROM public."Inventory" WHERE status = 'sold';

  RAISE NOTICE 'Sales table: % records', v_sales_count;
  RAISE NOTICE 'Sold inventory items: %', v_sold_inv_count;
  RAISE NOTICE 'Coverage: %', CASE WHEN v_sold_inv_count > 0 THEN ROUND((v_sales_count::NUMERIC / v_sold_inv_count * 100), 2) ELSE 100 END || '%';
END $$;

-- ============================================================================
-- END OF M2 MIGRATION
-- ============================================================================
