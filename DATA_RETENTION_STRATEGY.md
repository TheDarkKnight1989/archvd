# Data Retention Strategy - Best-in-Class Approach

## TL;DR: Tiered Retention with Smart Downsampling

**Keep granular data where it matters, downsample old data**. At scale (10,000+ products), you need:
1. **Recent data (< 3 months)**: Keep ALL hourly snapshots
2. **Medium data (3 months - 1 year)**: Downsample to daily aggregates
3. **Old data (> 1 year)**: Downsample to weekly aggregates
4. **Automatic monthly downsampling** via cron job

This gives you 95% storage savings on old data while keeping granularity where users care.

## Why Keep All Data Points?

### 1. **Flexibility**
```sql
-- Same raw data, different views
-- Hourly chart
SELECT snapshot_at, lowest_ask FROM master_market_data WHERE ...

-- Daily chart (aggregate on-the-fly)
SELECT DATE(snapshot_at), AVG(lowest_ask) FROM master_market_data WHERE ...

-- Weekly chart
SELECT DATE_TRUNC('week', snapshot_at), AVG(lowest_ask) FROM master_market_data WHERE ...
```

### 2. **Intraday Insights**
- **Flash sales**: Detect 10-minute price drops
- **Bot activity**: Identify automated listing patterns
- **Market manipulation**: See pump-and-dump schemes
- **Volatility tracking**: Calculate intraday standard deviation

### 3. **User Preferences**
Different users need different granularities:
- **Power traders**: Want hourly/real-time data
- **Casual sellers**: Want daily/weekly trends
- **Data analysts**: Want raw data for custom analysis

### 4. **Audit Trail**
- Regulatory compliance (may be required for financial transactions)
- Dispute resolution ("What was the price at 2pm on Tuesday?")
- Business intelligence (post-mortem on failed campaigns)

### 5. **Machine Learning**
Historical granularity improves:
- Price prediction models
- Anomaly detection
- Demand forecasting
- Seasonal pattern recognition

## Storage Math

Let's calculate actual storage needs:

### Current Setup (112 Products)

**Per sync**:
- 112 products
- 30 sizes per product = 3,360 variants
- 2 providers (Alias + StockX)
- 3 regions each = 6 data points per variant
- **Total: 3,360 × 6 = ~20,000 rows per full sync**

**With tiered syncing** (from [SCALING_ARCHITECTURE.md](SCALING_ARCHITECTURE.md)):
- Hot tier: 20 products × hourly = 480 syncs/day
- Warm tier: 50 products × every 6h = 200 syncs/day
- Cold tier: 42 products × daily = 42 syncs/day
- **Total: ~722 product syncs/day**

**Daily storage**:
- 722 product syncs × 30 sizes × 6 data points = ~130,000 rows/day
- Each row ≈ 500 bytes (with indexes)
- **~65 MB/day raw**

**With PostgreSQL compression** (TOAST):
- Compression ratio: ~60%
- **~26 MB/day compressed**

**Annual storage**:
- 26 MB/day × 365 days = **~9.5 GB/year**

### At Scale (1,000 Products)

**Annual storage**:
- 1,000 products ÷ 112 = ~9x
- 9.5 GB × 9 = **~85 GB/year**

### At Massive Scale (10,000 Products)

**Annual storage**:
- 10,000 products ÷ 112 = ~89x
- 9.5 GB × 89 = **~850 GB/year**

## Supabase Pricing

| Plan | Storage | Cost |
|------|---------|------|
| Free | 500 MB | $0 |
| Pro | 8 GB included | $25/month |
| Pro + additional | $0.125/GB | ~$10/month for 85 GB |

**For 112 products**: Pro plan ($25/month) covers **2+ years** of data ✅
**For 1,000 products**: Pro + 80 GB extra = ~$35/month total ✅
**For 10,000 products**: Pro + 840 GB extra = ~$130/month ✅

**Conclusion**: Storage is NOT a concern. Keep all data.

## Implementation Strategy

### Phase 1: Keep All Raw Data (NOW)
✅ Store every sync in `master_market_data`
✅ No deletion, no downsampling
✅ Query-time aggregation for charts

### Phase 2: Add Materialized Views (After 1 month)
When you have enough data to notice slow queries:

1. **Create daily summary view**:
   ```sql
   -- Already created in migration:
   -- supabase/migrations/20251207_create_daily_market_summary.sql
   ```

2. **Refresh nightly via cron**:
   ```json
   {
     "path": "/api/cron/refresh-daily-summary",
     "schedule": "0 2 * * *"  // 2am daily
   }
   ```

3. **Use in charts**:
   ```typescript
   // For daily chart (fast)
   const { data } = await supabase
     .from('daily_market_summary')
     .select('date, avg_lowest_ask')
     .eq('sku', sku)
     .order('date')
   ```

### Phase 3: Add Partitioning (After 6 months)
When you exceed 50M rows:

```sql
-- Partition by month for query performance
CREATE TABLE master_market_data (
  -- ... existing columns ...
  snapshot_at TIMESTAMPTZ NOT NULL
) PARTITION BY RANGE (snapshot_at);

-- Create monthly partitions
CREATE TABLE master_market_data_2025_01 PARTITION OF master_market_data
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE master_market_data_2025_02 PARTITION OF master_market_data
FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
```

**Benefits**:
- Queries only scan relevant partition (10x faster)
- Easy to archive old partitions
- DROP partition is instant (vs. DELETE which is slow)

### Phase 4: Archive Old Data (After 1 year)
Move old partitions to cheaper cold storage:

```sql
-- Export partition to S3/R2
COPY master_market_data_2024_01 TO '/archive/2024_01.csv';

-- Drop from hot storage
DROP TABLE master_market_data_2024_01;

-- Keep metadata for reference
INSERT INTO archived_partitions VALUES
  ('2024-01', '/archive/2024_01.csv', NOW());
```

Or use Supabase's built-in archiving (Pro plan feature).

## Chart Query Examples

### Hourly Chart (Raw Data)
```typescript
const { data } = await supabase
  .from('master_market_data')
  .select('snapshot_at, lowest_ask, highest_bid')
  .eq('sku', 'DD1503-103')
  .eq('size_key', 'US 10')
  .eq('provider', 'alias')
  .gte('snapshot_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  .order('snapshot_at')
```

### Daily Chart (Aggregated)
```typescript
const { data } = await supabase
  .from('daily_market_summary')
  .select('date, avg_lowest_ask, min_lowest_ask, max_lowest_ask')
  .eq('sku', 'DD1503-103')
  .eq('size_key', 'US 10')
  .eq('provider', 'alias')
  .order('date')
```

### Weekly Chart (Custom Aggregation)
```sql
SELECT
  DATE_TRUNC('week', snapshot_at) as week,
  AVG(lowest_ask) as avg_lowest_ask,
  MIN(lowest_ask) as min_lowest_ask,
  MAX(lowest_ask) as max_lowest_ask
FROM master_market_data
WHERE sku = 'DD1503-103'
  AND size_key = 'US 10'
GROUP BY week
ORDER BY week;
```

## What Companies Actually Do

### StockX
- **Keep**: All historical price points (hourly since 2016)
- **Display**: Hourly, daily, weekly, monthly charts
- **Storage**: Estimated 500GB+ of market data
- **Why**: Volatility tracking, fraud detection, regulatory compliance

### eBay
- **Keep**: Every sold listing forever
- **Display**: Daily average sold prices
- **Storage**: Petabytes
- **Why**: Price guide accuracy, seller/buyer disputes, tax reporting

### Robinhood / Trading Platforms
- **Keep**: Every trade tick (millisecond-level)
- **Display**: 1min, 5min, 1h, 1d charts
- **Storage**: Massive (AWS S3 + Redshift)
- **Why**: SEC compliance, algorithmic trading, pattern detection

## Recommendation

**For your 112-product platform**:

1. ✅ **Keep all raw data** - No deletion
2. ✅ **Use query-time aggregation** - Works great up to 10M rows
3. ⏳ **Add materialized views** - After 1 month if queries slow
4. ⏳ **Add partitioning** - After 6 months / 50M rows
5. ⏳ **Archive old data** - After 1 year to cheaper storage

**Current cost**: $25/month (Supabase Pro)
**Storage for 2 years**: ~19 GB (well within 8GB + overages)
**Query performance**: Excellent with proper indexes

## Storage Cost With Downsampling

### At 10,000 Products (Your Scale Target)

**Without downsampling** (keep all hourly data):
- 850 GB/year × 3 years = **2.5 TB**
- Cost: **$130/month** ($1,560/year)
- ❌ **Not sustainable**

**With tiered downsampling**:
- Hourly data (3 months): 212 GB
- Daily data (9 months): 21 GB (95% reduction)
- Weekly data (2+ years): 8 GB (99% reduction)
- **Total: ~240 GB steady state**
- Cost: **$55/month** ($660/year)
- ✅ **Sustainable** - saves $900/year!

### Downsampling Savings Breakdown

| Data Age | Granularity | Storage | Reduction |
|----------|-------------|---------|-----------|
| < 3 months | Hourly | 212 GB | 0% (keep all) |
| 3-12 months | Daily | 21 GB | 95% |
| > 1 year | Weekly | 8 GB | 99% |
| **Total** | **Mixed** | **~240 GB** | **72% overall** |

## Implementation Timeline

### Phase 1: 0-3 Months (Current)
- ✅ Keep all raw hourly data
- ✅ Query-time aggregation for charts
- Storage: < 100 GB
- Cost: $25/month (Supabase Pro included storage)

### Phase 2: 3 Months In
- 🔧 Run first downsampling job
- Migrate data older than 3 months to daily aggregates
- Storage drops from ~210 GB → ~30 GB
- Cost stays at $25/month

### Phase 3: 1 Year In
- 🔧 Run weekly downsampling
- Migrate data older than 1 year to weekly aggregates
- Storage steady state: ~240 GB
- Cost: $55/month

### Phase 4: Ongoing
- 🔁 Monthly downsampling cron
- Automatic retention management
- Predictable costs at scale

## Cron Configuration

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-market-data?tier=hot",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/sync-market-data?tier=warm",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/sync-market-data?tier=cold",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/downsample-data",
      "schedule": "0 3 1 * *"
    }
  ]
}
```

Last cron runs **monthly** on the 1st at 3am to downsample old data.

## Summary

**Smart retention strategy for scale**:

1. ✅ Keep hourly granularity for recent data (what users actually view)
2. ✅ Downsample old data automatically (saves 95%+ storage)
3. ✅ No manual intervention - cron handles it
4. ✅ Costs stay predictable as you scale
5. ✅ Can always query across all time ranges

**At 10,000 products**: $55/month vs. $130/month = **$900/year savings**

This is the "best-in-class way" for production scale ✅
