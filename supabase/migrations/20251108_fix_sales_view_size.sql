-- Migration: Fix sales_view to include legacy size column as fallback
-- Date: 2025-11-08
-- Purpose: Use COALESCE to get size from either size_uk or size column

CREATE OR REPLACE VIEW sales_view
WITH (security_invoker = on) AS
SELECT
  i.id,
  i.user_id,
  i.sku,
  i.brand,
  i.model,
  COALESCE(i.size_uk, i.size) AS size_uk,
  i.condition,
  i.category,
  i.purchase_price,
  i.purchase_date,
  i.tax,
  i.shipping,
  i.place_of_purchase,
  i.order_number,
  i.sold_price,
  i.sold_date,
  i.platform,
  i.location,
  i.image_url,
  i.tags,
  i.custom_market_value,
  i.notes,
  i.status,
  i.created_at,
  i.updated_at,
  -- Derived metrics
  (COALESCE(i.sold_price, 0) - COALESCE(i.purchase_price, 0) - COALESCE(i.tax, 0) - COALESCE(i.shipping, 0))::numeric(12,2) AS margin_gbp,
  CASE
    WHEN COALESCE(i.purchase_price, 0) + COALESCE(i.tax, 0) + COALESCE(i.shipping, 0) > 0
    THEN ((COALESCE(i.sold_price, 0) - COALESCE(i.purchase_price, 0) - COALESCE(i.tax, 0) - COALESCE(i.shipping, 0)) / (COALESCE(i.purchase_price, 0) + COALESCE(i.tax, 0) + COALESCE(i.shipping, 0)) * 100)::numeric(12,2)
    ELSE 0
  END AS margin_percent
FROM "Inventory" i
WHERE i.status = 'sold';

COMMENT ON VIEW sales_view IS 'Shows only sold items with calculated margin metrics. Uses size_uk with size as fallback for legacy data.';
