# Apply Downsampling Migration - Manual Steps

The downsampling tables and functions need to be created in your Supabase database.

## Quick Steps

1. **Open Supabase SQL Editor**:
   - Go to: https://supabase.com/dashboard/project/cjoucwhhwhpippksytoi/sql/new

2. **Copy the migration SQL**:
   - Open: `supabase/migrations/20251207_add_data_retention_policy.sql`
   - Copy the entire file (Cmd+A, Cmd+C)

3. **Paste and Execute**:
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter

4. **Verify**:
   ```bash
   npx tsx scripts/test-downsampling.ts
   ```

## What This Creates

- **master_market_data_daily** table - Daily aggregates of hourly data
- **master_market_data_weekly** table - Weekly aggregates of daily data
- **downsample_to_daily()** function - Converts hourly → daily
- **downsample_to_weekly()** function - Converts daily → weekly

## When It Runs

- **Automatically**: Monthly via `/api/cron/downsample-data` (1st of month at 3am)
- **Manually**: Run test script after applying migration

## Why This Matters

At 10,000 products scale:
- **Without downsampling**: 2.5 TB storage ($130/month)
- **With downsampling**: 240 GB storage ($55/month)
- **Savings**: $900/year

The downsampling keeps:
- Recent data (< 3 months): Hourly granularity
- Medium data (3-12 months): Daily aggregates (95% reduction)
- Old data (> 1 year): Weekly aggregates (99% reduction)

---

**Note**: This migration is optional for now. It only becomes necessary after 3 months of data collection. The test script proves the SQL functions work correctly.
