-- Fix stockx_latest_prices view with SECURITY DEFINER
-- The view wasn't respecting RLS policies properly

DROP VIEW IF EXISTS public.stockx_latest_prices;

CREATE OR REPLACE VIEW public.stockx_latest_prices
WITH (security_invoker = false)
AS
SELECT DISTINCT ON (sku, size, currency)
  sku,
  size,
  currency,
  lowest_ask,
  highest_bid,
  last_sale,
  average_price,
  volatility,
  sales_last_72h,
  as_of
FROM public.stockx_market_prices
ORDER BY sku, size, currency, as_of DESC;

COMMENT ON VIEW public.stockx_latest_prices IS 'Latest market price for each SKU + size combination (security definer)';

-- Grant access to authenticated and anon users
GRANT SELECT ON public.stockx_latest_prices TO authenticated, anon;
