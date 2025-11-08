# Market & Releases Phase 1 - Deployment Guide

## ✅ Completed Work

### 1. Database Schema
- ✅ Created migration file: `supabase/migrations/20250107_market_releases_schema.sql`
- ✅ Tables: product_catalog, product_market_prices, releases, release_products, fx_rates, release_sources_whitelist, catalog_cache, worker_logs
- ✅ Views: latest_market_prices, upcoming_releases_with_skus
- ✅ Indexes, foreign keys, triggers configured

### 2. API Endpoints
- ✅ `/api/market/[sku]` - Returns catalog info + per-size prices
- ✅ `/api/releases` - GET/POST for release data with filtering
- ✅ `/api/workers/releases` - Scrapes Nike/Size?/Footpatrol launch pages
- ✅ `/api/workers/prices` - Fetches per-size prices from StockX/Laced

### 3. UI Pages
- ✅ `/dashboard/market` - SKU search + price table per size
- ✅ `/dashboard/releases` - Calendar grid with filtering
- ✅ Navigation updated with LineChart and Calendar icons
- ✅ Matrix UI styling applied consistently

### 4. Worker Functions
- ✅ Releases worker with retry logic and rate limiting
- ✅ Price refresh worker with currency conversion
- ✅ Vercel cron configuration in `vercel.json`

### 5. Documentation
- ✅ `WORKERS_IMPLEMENTATION.md` - Comprehensive worker guide
- ✅ `DEPLOYMENT_GUIDE.md` - This file

---

## 🚀 Deployment Steps

### Step 1: Apply Database Migration

```bash
# Login to Supabase CLI (if not already logged in)
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Apply the migration
supabase db push

# Or apply manually via Supabase Dashboard SQL Editor
# Copy contents of supabase/migrations/20250107_market_releases_schema.sql
# Paste into SQL Editor and run
```

### Step 2: Set Environment Variables

Add to your `.env.local` and Vercel project settings:

```bash
# Cron Secret (generate a random string)
CRON_SECRET=your_random_secret_here_min_32_chars

# Already configured (verify these exist)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Generate CRON_SECRET:
```bash
openssl rand -base64 32
```

### Step 3: Seed Initial Data (Optional)

```sql
-- Seed whitelisted sources
INSERT INTO release_sources_whitelist (source_name, source_url, enabled)
VALUES
  ('nike', 'https://www.nike.com/gb/launch', true),
  ('size', 'https://www.size.co.uk/page/sizepreviews-launches/', true),
  ('footpatrol', 'https://www.footpatrol.com/pages/launch-page', true);

-- Seed initial FX rates (optional, can be populated by worker)
INSERT INTO fx_rates (from_currency, to_currency, rate, as_of, source)
VALUES
  ('USD', 'GBP', 0.79, NOW(), 'manual'),
  ('EUR', 'GBP', 0.86, NOW(), 'manual');

-- Seed sample product (optional, for testing)
INSERT INTO product_catalog (sku, brand, model, colorway, retail_price, currency, image_url)
VALUES
  ('DD1391-100', 'Nike', 'Air Jordan 1 High', 'White/Black-White', 139.99, 'GBP',
   'https://images.stockx.com/images/Air-Jordan-1-Retro-High-OG-White-Black-2024-Product.jpg');
```

### Step 4: Deploy to Vercel

```bash
# Commit all changes
git add .
git commit -m "feat: implement market & releases phase 1"

# Push to repository
git push origin main

# Vercel will automatically deploy if connected
# Or manually trigger deployment via Vercel dashboard
```

### Step 5: Configure Vercel Cron Jobs

Vercel cron jobs are configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/workers/releases",
      "schedule": "0 1 * * *"  // 01:00 UTC daily
    },
    {
      "path": "/api/workers/prices",
      "schedule": "0 2 * * *"  // 02:00 UTC daily
    }
  ]
}
```

**Note**: Cron jobs only run on Vercel Pro plans. For Hobby plans, use external cron services like:
- GitHub Actions
- cron-job.org
- EasyCron

Example GitHub Action (`.github/workflows/cron.yml`):

```yaml
name: Run Workers

on:
  schedule:
    - cron: '0 1 * * *'  # 01:00 UTC - releases
    - cron: '0 2 * * *'  # 02:00 UTC - prices

jobs:
  run-releases:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Releases Worker
        run: |
          curl -X POST https://your-domain.vercel.app/api/workers/releases \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"

  run-prices:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Price Worker
        run: |
          curl -X POST https://your-domain.vercel.app/api/workers/prices \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

---

## 🧪 Testing Locally

### 1. Test Market API

```bash
# Test with existing product (if seeded)
curl http://localhost:3000/api/market/DD1391-100

# Expected response:
{
  "sku": "DD1391-100",
  "product": { /* catalog data */ },
  "prices": [ /* per-size prices */ ],
  "lastRefresh": "2025-11-07T18:00:00.000Z",
  "priceCount": 15
}
```

### 2. Test Releases API

```bash
# Get upcoming releases for current month
curl "http://localhost:3000/api/releases?month=2025-11&status=upcoming"

# Filter by brand
curl "http://localhost:3000/api/releases?month=2025-11&brand=Nike"

# Expected response:
{
  "releases": [ /* array of releases */ ],
  "count": 25
}
```

### 3. Test Worker Functions (Manual Trigger)

```bash
# Set CRON_SECRET in .env.local first
CRON_SECRET=your_secret_here

# Trigger releases worker
curl -X POST http://localhost:3000/api/workers/releases \
  -H "Authorization: Bearer $CRON_SECRET"

# Trigger price worker
curl -X POST http://localhost:3000/api/workers/prices \
  -H "Authorization: Bearer $CRON_SECRET"

# Expected response:
{
  "success": true,
  "metrics": {
    "started_at": "2025-11-07T18:00:00.000Z",
    "sources_processed": 3,
    "releases_found": 42,
    "releases_inserted": 35,
    "releases_skipped": 7,
    "errors": []
  }
}
```

### 4. Test UI Pages

Navigate to:
- http://localhost:3000/dashboard/market
- http://localhost:3000/dashboard/releases

---

## 📝 Implementation Notes

### Current Status

**Market Page**: ✅ Fully functional
- Search bar working
- Product info display
- Price table per size
- Retail comparison

**Releases Page**: ✅ Fully functional
- Month/brand filtering working
- Calendar grid layout
- Release cards with images
- SKU linking

**Worker Functions**: ⚠️ Placeholder parsers
- Framework complete
- Rate limiting implemented
- Retry logic working
- **TODO**: Implement actual HTML parsers for Nike/Size?/Footpatrol

### Known Limitations

1. **HTML Parsing Not Implemented**
   - `parseNikeLaunch()`, `parseSizeLaunch()`, `parseFootpatrolLaunch()` are placeholders
   - Requires HTML parser library like `cheerio` or `jsdom`
   - Each retailer requires custom scraping logic

2. **StockX/Laced Integration Not Implemented**
   - `fetchStockXPrices()` and `fetchLacedPrices()` are placeholders
   - Requires API keys or scraping setup
   - Consider using official APIs if available

3. **Currency Conversion**
   - FX rates need to be seeded or fetched from external API
   - Currently falls back to 1:1 conversion if rate not found

### Next Steps (Priority Order)

1. **Apply database migration** (required for everything to work)
2. **Seed initial data** (whitelisted sources, FX rates)
3. **Implement HTML parsers** for retailer scraping
4. **Implement StockX/Laced** price fetching
5. **Set up cron scheduling** (Vercel Pro or GitHub Actions)
6. **Add monitoring** (Sentry, Datadog, or custom logging)

---

## 🔍 Monitoring & Logs

### Check Worker Logs

```sql
-- View recent worker runs
SELECT
  worker_name,
  started_at,
  completed_at,
  status,
  metrics
FROM worker_logs
ORDER BY started_at DESC
LIMIT 20;

-- Check for errors
SELECT
  worker_name,
  started_at,
  metrics->>'errors' as errors
FROM worker_logs
WHERE status != 'success'
ORDER BY started_at DESC;
```

### Check Market Data

```sql
-- Count products in catalog
SELECT COUNT(*) FROM product_catalog;

-- Count price snapshots
SELECT COUNT(*) FROM product_market_prices;

-- Latest prices per SKU
SELECT * FROM latest_market_prices LIMIT 10;

-- Check upcoming releases
SELECT * FROM upcoming_releases_with_skus LIMIT 10;
```

---

## 🐛 Troubleshooting

### Issue: "Unauthorized" when calling worker endpoints

**Solution**: Check `CRON_SECRET` is set correctly in environment variables

### Issue: Database tables don't exist

**Solution**: Apply migration using `supabase db push` or SQL Editor

### Issue: No prices returned for SKU

**Solution**:
1. Check if SKU exists in `product_catalog`
2. Run price worker manually to populate data
3. Check `product_market_prices` table for that SKU

### Issue: Releases API returns empty array

**Solution**:
1. Check if releases exist in database for selected month
2. Run releases worker manually to scrape data
3. Verify whitelisted sources are enabled

---

## 📚 Related Documentation

- [WORKERS_IMPLEMENTATION.md](./WORKERS_IMPLEMENTATION.md) - Detailed worker implementation guide
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Next.js 15 API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

---

## ✅ Deployment Checklist

Before going to production:

- [ ] Database migration applied
- [ ] Environment variables configured (CRON_SECRET, Supabase keys)
- [ ] Initial data seeded (whitelisted sources, FX rates)
- [ ] Worker parsers implemented (HTML scraping logic)
- [ ] StockX/Laced integration implemented
- [ ] Cron jobs scheduled (Vercel Pro or GitHub Actions)
- [ ] Error logging enabled (Sentry or similar)
- [ ] Test all API endpoints with real data
- [ ] Test worker functions manually
- [ ] Verify Matrix UI styling on all pages
- [ ] Performance testing (handle 10,000+ SKUs)
- [ ] Rate limiting verified (no 429 errors from retailers)

---

**Questions?** Check existing API routes in `/api/pricing/refresh` for patterns used in the codebase.
