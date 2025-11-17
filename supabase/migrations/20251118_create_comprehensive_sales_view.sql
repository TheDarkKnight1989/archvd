-- ============================================================================
-- Create comprehensive sales_view for Sales page
-- ============================================================================
-- This view provides all fields needed by the Sales table component
-- It joins Inventory with sales table and enriches with computed fields

DROP VIEW IF EXISTS public.sales_view CASCADE;

CREATE VIEW public.sales_view WITH (security_invoker = on) AS
SELECT
  -- Identity
  i.id,
  i.user_id,
  s.id AS sales_id,

  -- Product info
  i.sku,
  i.brand,
  i.model,
  i.colorway,
  i.size_uk,
  i.size,
  i.category,
  i.condition,
  i.image_url,

  -- Purchase info (cost basis)
  i.purchase_price,
  i.tax,
  i.shipping,
  i.purchase_total,
  i.purchase_date,
  i.place_of_purchase,
  i.order_number,

  -- Sale info
  i.sold_price,  -- The price the item was sold for (in sale currency)
  i.sold_date,   -- When it was sold
  i.sale_date,   -- Alias for sold_date
  i.platform,    -- Where it was sold (ebay, stockx, etc.)
  i.sales_fee,   -- Total fees (includes platform fees + shipping out)
  i.notes,

  -- StockX specific fields (if available)
  i.stockx_order_id,
  NULL::NUMERIC(12,2) AS commission,  -- Calculated from sales_fee if needed
  NULL::NUMERIC(12,2) AS net_payout,  -- Calculated: sold_price - commission

  -- Calculated fields for display
  -- Cost basis: purchase_price + tax + shipping
  COALESCE(i.purchase_total, i.purchase_price + COALESCE(i.tax, 0) + COALESCE(i.shipping, 0)) AS cost_basis,

  -- Margin in GBP: sold_price - cost_basis - fees
  (
    COALESCE(i.sold_price, 0) -
    COALESCE(i.purchase_total, i.purchase_price + COALESCE(i.tax, 0) + COALESCE(i.shipping, 0)) -
    COALESCE(i.sales_fee, 0)
  ) AS margin_gbp,

  -- Margin percentage: margin / cost_basis * 100
  CASE
    WHEN COALESCE(i.purchase_total, i.purchase_price + COALESCE(i.tax, 0) + COALESCE(i.shipping, 0)) > 0
    THEN (
      (COALESCE(i.sold_price, 0) -
       COALESCE(i.purchase_total, i.purchase_price + COALESCE(i.tax, 0) + COALESCE(i.shipping, 0)) -
       COALESCE(i.sales_fee, 0)) /
      COALESCE(i.purchase_total, i.purchase_price + COALESCE(i.tax, 0) + COALESCE(i.shipping, 0))
    )
    ELSE NULL
  END AS margin_percent,

  -- Metadata
  i.location,
  i.tags,
  i.custom_market_value,
  i.status,
  i.created_at,
  i.updated_at,

  -- Sales table fields (from the sales table join)
  s.sale_total_base,
  s.fees_base,
  s.purchase_total_base,
  s.profit_base,
  s.base_currency

FROM public."Inventory" i
LEFT JOIN public.sales s ON s.inventory_id = i.id
WHERE
  i.status = 'sold'
  AND i.user_id = auth.uid()
ORDER BY
  COALESCE(i.sold_date, i.sale_date) DESC NULLS LAST;

-- Grant access
GRANT SELECT ON public.sales_view TO authenticated;

-- Add comment
COMMENT ON VIEW public.sales_view IS 'Comprehensive sales view for Sales page with all display fields and calculated margins';
