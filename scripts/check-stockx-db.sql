-- ============================================================================
-- Check StockX Database Tables
-- ============================================================================
-- Run this in Supabase SQL Editor to verify StockX tables exist
-- https://supabase.com/dashboard/project/cjoucwhhwhpippksytoi/editor

-- 1. Check if StockX tables exist
SELECT
  tablename,
  schemaname
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE '%stockx%'
ORDER BY tablename;

-- Expected tables:
-- - stockx_accounts
-- - stockx_listings
-- - stockx_market_prices
-- - stockx_sales

-- 2. Check RLS policies are enabled
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE '%stockx%'
ORDER BY tablename;

-- All should show rls_enabled = true

-- 3. Count records in each table (should be 0 for new deployment)
SELECT 'stockx_accounts' AS table_name, COUNT(*) AS record_count FROM stockx_accounts
UNION ALL
SELECT 'stockx_listings', COUNT(*) FROM stockx_listings
UNION ALL
SELECT 'stockx_market_prices', COUNT(*) FROM stockx_market_prices
UNION ALL
SELECT 'stockx_sales', COUNT(*) FROM stockx_sales;
