# Market Queue System Documentation

## Overview

The Market Queue System is a robust, rate-limit-aware job queue for fetching market data from providers (StockX, Alias, eBay) without hitting API rate limits or causing failures in the UI.

**Key Principles:**
- Never call provider APIs directly from UI
- Batch and schedule API calls through a job queue
- Token bucket rate limiting per provider
- Strong caching layer
- Observability and monitoring

## Architecture

### Components

1. **Job Queue** (`market_jobs` table)
   - Stores pending/running/completed jobs
   - Deduplication via `dedupe_key` (provider|sku|size)
   - Priority levels: 200 (manual), 150 (hot), 100 (background)

2. **Scheduler** (`/api/market/scheduler/run`)
   - Runs every 15 minutes via Vercel cron
   - Ensures provider budgets exist
   - Selects jobs that fit within rate limits
   - Forwards batches to worker

3. **Worker** (`/api/market/worker/fetch`)
   - Processes batches by provider
   - Executes provider-specific workers
   - Updates budgets and logs metrics

4. **Provider Workers** (`src/lib/providers/*-worker.ts`)
   - StockX: Implemented ✅
   - Alias: TODO
   - eBay: TODO

5. **Rate Limiting** (`market_budgets` table)
   - Token bucket per provider per hour
   - StockX: 100 calls/hour
   - Alias: 200 calls/hour
   - eBay: 150 calls/hour

6. **Observability**
   - `market_job_runs`: Scheduler run logs
   - `market_provider_metrics`: Per-batch metrics
   - Admin UI: `/portfolio/admin/market-jobs`

## Database Schema

### market_jobs
```sql
CREATE TABLE market_jobs (
  id UUID PRIMARY KEY,
  user_id UUID NULL,
  provider TEXT NOT NULL,
  sku TEXT NOT NULL,
  size TEXT NULL,
  priority INT DEFAULT 100,
  status job_status DEFAULT 'pending',
  error_message TEXT,
  retry_count INT DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  dedupe_key TEXT GENERATED, -- provider|sku|size
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### market_budgets
```sql
CREATE TABLE market_budgets (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL,
  hour_window TIMESTAMPTZ NOT NULL, -- start of hour
  rate_limit INT NOT NULL,
  used INT DEFAULT 0,
  UNIQUE (provider, hour_window)
);
```

## Setup

### 1. Environment Variables

Add to `.env.local`:

```bash
# Existing Supabase variables (should already exist)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# New variables for queue system
CRON_SECRET=<generate-random-secret>
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # or production URL

# StockX API
STOCKX_API_KEY=<your-stockx-api-key>
```

Generate a secure cron secret:
```bash
openssl rand -hex 32
```

### 2. Database Migration

Apply the queue system migration:

```bash
# If you have DATABASE_URL set:
node scripts/apply-migration.mjs 20251118_market_queue.sql

# Or run SQL directly in Supabase Dashboard
# Copy contents of supabase/migrations/20251118_market_queue.sql
```

### 3. Vercel Cron Setup

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/market/scheduler/run",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

Set environment variable in Vercel dashboard:
- `CRON_SECRET` = (same secret from .env.local)

### 4. Test Locally

```bash
# 1. Start dev server
npm run dev

# 2. Trigger scheduler manually (in another terminal)
curl -X POST http://localhost:3000/api/market/scheduler/run \
  -H "x-cron-secret: YOUR_CRON_SECRET"

# 3. View admin UI
open http://localhost:3000/portfolio/admin/market-jobs
```

## Usage

### Enqueue Jobs Programmatically

```typescript
import { enqueueJob, enqueueForItems, enqueueRefresh } from '@/lib/market/enqueue'

// Enqueue single job
await enqueueJob({
  provider: 'stockx',
  sku: 'DD1391-100',
  size: '10',
  priority: 100,
})

// Enqueue from inventory items
const items = [{ sku: 'DD1391-100', size_uk: '10', ... }]
await enqueueForItems(items, 'stockx', 150) // priority 150

// Manual refresh (high priority)
await enqueueRefresh([
  { sku: 'DD1391-100', size: '10' }
], 'stockx')
```

### Integration Points

#### 1. When user adds item to inventory
```typescript
// In add item API/action
await enqueueJob({
  provider: 'stockx',
  sku: item.sku,
  size: item.size_uk,
  priority: 150, // hot - user just added
})
```

#### 2. On portfolio page load
```typescript
// Check for stale prices, enqueue background refresh
const staleItems = items.filter(item =>
  !item.market_price_updated_at ||
  isStale(item.market_price_updated_at, 60) // 60 minutes
)

await enqueueForItems(staleItems, 'stockx', 100)
```

#### 3. Manual refresh button
```typescript
// High priority
await enqueueRefresh(selectedItems, 'stockx')
```

## Monitoring

### Admin UI

Visit `/portfolio/admin/market-jobs` to see:
- Current hour rate limit budgets
- Pending/running/failed jobs
- Recent scheduler runs
- Provider batch metrics

### Actions Available

- **Trigger Scheduler**: Manually run scheduler
- **Reset Failed**: Move failed jobs back to pending
- **Refresh**: Reload all data

### Metrics

Monitor in `market_provider_metrics` table:
- Batch size
- Success/failure/deferred counts
- Per-run performance

## Troubleshooting

### No jobs processing

1. Check scheduler is running:
   ```bash
   # Check recent runs
   SELECT * FROM market_job_runs ORDER BY started_at DESC LIMIT 5;
   ```

2. Check budgets:
   ```bash
   SELECT * FROM market_budgets
   WHERE hour_window = date_trunc('hour', NOW());
   ```

3. Trigger manually:
   ```bash
   curl -X POST https://your-app.vercel.app/api/market/scheduler/run \
     -H "x-cron-secret: YOUR_CRON_SECRET"
   ```

### Jobs stuck in "running"

Reset via admin UI "Reset Failed" button, or SQL:

```sql
UPDATE market_jobs
SET status = 'pending', started_at = NULL
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '10 minutes';
```

### Rate limit exceeded

Check budget usage:

```sql
SELECT provider, used, rate_limit,
  ROUND(100.0 * used / rate_limit, 1) as pct_used
FROM market_budgets
WHERE hour_window = date_trunc('hour', NOW());
```

If consistently hitting limits, either:
- Reduce batch size in scheduler (MAX_BATCH_SIZE)
- Increase delay in worker (DELAY_MS)
- Contact provider to increase rate limits

### StockX API errors

Common issues:
- **401 Unauthorized**: Check `STOCKX_API_KEY` and access token in `stockx_accounts` table
- **404 Not Found**: SKU doesn't exist in StockX catalog
- **429 Rate Limited**: Worker will defer remaining jobs
- **504 Gateway Timeout**: Retry will happen automatically

## Next Steps

1. **Implement Alias Worker** (`src/lib/providers/alias-worker.ts`)
2. **Implement eBay Worker** (`src/lib/providers/ebay-worker.ts`)
3. **Add Caching Layer**: Redis or memory cache for search/catalog
4. **Monitoring Alerts**: Alert on high failure rates
5. **Catalog Enrichment**: Backfill missing product names/images

## References

- Scheduler: `src/app/api/market/scheduler/run/route.ts`
- Worker: `src/app/api/market/worker/fetch/route.ts`
- StockX Worker: `src/lib/providers/stockx-worker.ts`
- Enqueue Helpers: `src/lib/market/enqueue.ts`
- Admin UI: `src/app/portfolio/admin/market-jobs/page.tsx`
