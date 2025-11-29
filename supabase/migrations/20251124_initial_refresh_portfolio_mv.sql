-- ============================================================================
-- Initial Refresh of portfolio_value_daily Materialized View
-- ============================================================================
-- The materialized view needs an initial population before CONCURRENTLY can be used

-- Do initial refresh without CONCURRENTLY
REFRESH MATERIALIZED VIEW portfolio_value_daily;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20251124_initial_refresh_portfolio_mv completed successfully';
  RAISE NOTICE '📊 portfolio_value_daily materialized view has been populated';
END $$;
