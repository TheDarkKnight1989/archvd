-- Fix materialized view refresh functions to handle initial population
-- Use exception handling to fall back to non-concurrent refresh

CREATE OR REPLACE FUNCTION refresh_market_price_daily_medians()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Try concurrent refresh first
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY market_price_daily_medians;
  EXCEPTION
    WHEN OTHERS THEN
      -- Fall back to regular refresh if concurrent fails (e.g., not populated yet)
      REFRESH MATERIALIZED VIEW market_price_daily_medians;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION refresh_portfolio_value_daily()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Try concurrent refresh first
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY portfolio_value_daily;
  EXCEPTION
    WHEN OTHERS THEN
      -- Fall back to regular refresh if concurrent fails
      REFRESH MATERIALIZED VIEW portfolio_value_daily;
  END;
END;
$$;
