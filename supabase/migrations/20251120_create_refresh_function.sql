-- Create the refresh function for stockx_market_latest materialized view
-- This function is needed for Phase 3.5 fix

CREATE OR REPLACE FUNCTION refresh_stockx_market_latest()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY stockx_market_latest;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_stockx_market_latest IS 'Refresh the stockx_market_latest materialized view - called after writing snapshots';
