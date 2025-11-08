# Releases Worker - Implementation Status

## ✅ Completed

### 1. Worker Implementation
- **File**: `src/app/api/workers/releases/route.ts`
- **Runtime**: Node.js (required for cheerio HTML parsing)
- **Authentication**: Protected by CRON_SECRET (query param or header)
- **Parsers**: Domain-specific parsers for:
  - Nike Launch (`nike.com/gb/launch`)
  - Size? Previews (`size.co.uk/page/sizepreviews-launches/`)
  - Footpatrol Launch (`footpatrol.com/pages/launch-page`)

### 2. Features Implemented
- ✓ CRON_SECRET authentication (header or query parameter)
- ✓ Reads `release_sources_whitelist` for enabled sources
- ✓ Domain-specific HTML parsers with cheerio
- ✓ UK date parsing (`parseUkDate`)
- ✓ SKU extraction from titles/text (regex: `AA####-###`, `DZ####-###`)
- ✓ Title normalization (`normaliseTitle`)
- ✓ Brand/model/colorway parsing (`parseTitleParts`)
- ✓ Upserts to `releases` table
- ✓ Auto-creates SKUs in `product_catalog`
- ✓ Links releases to products via `release_products`
- ✓ Error collection without crashing
- ✓ Metrics logging to `worker_logs`
- ✓ Rate limiting (5 seconds between sources)
- ✓ Retry logic with exponential backoff
- ✓ Pagination handling (limited to 50 cards per source)

### 3. Dependencies Installed
- ✓ `cheerio` (^1.1.2) - HTML parsing
- ✓ `@types/cheerio` (^0.22.35) - TypeScript types

### 4. Environment Configuration
- ✓ `CRON_SECRET=dev-secret-change-in-production` added to `.env.local`

### 5. Vercel Cron Configuration
- ✓ `vercel.json` includes cron job for `/api/workers/releases` (daily at 1 AM)

---

## ⚠️ Pending: Database Migration

The worker is **fully implemented** but cannot run successfully until the database is migrated.

### Current Database Issues
1. **`release_sources_whitelist` table**: Has old column names
   - Current: `domain`, `name`
   - Required: `source_url`, `source_name`
   - **Impact**: Worker finds sources but gets NULL values

2. **`worker_logs` table**: Does not exist
   - **Impact**: Cannot log worker execution metrics

### Migration File Created
📄 **File**: `supabase/migrations/20250108_fix_release_sources_columns.sql`

---

## 🚀 Next Steps

### Step 1: Apply Database Migration

**Option A: Via Supabase SQL Editor (Recommended)**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → Your Project → SQL Editor
2. Click "New Query"
3. Copy the entire content of `supabase/migrations/20250108_fix_release_sources_columns.sql`
4. Paste into SQL Editor
5. Click "Run"
6. Verify success (should see "Success. No rows returned")

**Option B: Via psql (if you have connection string)**
```bash
# Get your connection string from Supabase Dashboard → Settings → Database
psql "YOUR_CONNECTION_STRING" < supabase/migrations/20250108_fix_release_sources_columns.sql
```

### Step 2: Verify Migration
```bash
node scripts/check-db-state.mjs
```

Expected output:
```
1. Checking release_sources_whitelist table:
   ✓ Found 3 sources
     - nike: https://www.nike.com/gb/launch (enabled: true)
     - size: https://www.size.co.uk/page/sizepreviews-launches/ (enabled: true)
     - footpatrol: https://www.footpatrol.com/pages/launch-page (enabled: true)

4. Checking worker_logs table:
   ✓ Found 0 log entries
```

### Step 3: Test Worker Locally
```bash
curl -X POST "http://localhost:3000/api/workers/releases?secret=dev-secret-change-in-production"
```

Expected response:
```json
{
  "inserted": 10,
  "updated": 0,
  "linked": 15,
  "errors": []
}
```

### Step 4: Monitor Execution
```bash
# Check worker logs
node scripts/check-db-state.mjs

# Or query directly
supabase# SELECT * FROM worker_logs WHERE worker_name = 'releases_worker' ORDER BY created_at DESC LIMIT 5;
```

### Step 5: Clean Up Temporary Files
After migration is successful:
```bash
rm src/app/api/admin/migrate/route.ts
rm scripts/run-migration.mjs
rm scripts/apply-migration.mjs
```

---

## 📊 Worker Response Format

### Success Response
```json
{
  "inserted": 25,    // New releases created
  "updated": 5,      // Existing releases updated
  "linked": 30,      // SKU linkages created
  "errors": []       // Empty if all successful
}
```

### Partial Success Response
```json
{
  "inserted": 20,
  "updated": 3,
  "linked": 25,
  "errors": [
    "nike - Air Jordan 1 High: Failed to parse date",
    "SKU DZ5485-100: Duplicate key violation"
  ]
}
```

### Error Response (401)
```json
{
  "error": "Unauthorized"
}
```

---

## 🧪 Testing Checklist

- [ ] Apply database migration
- [ ] Verify migration with `check-db-state.mjs`
- [ ] Test worker locally with curl
- [ ] Verify releases appear in database
- [ ] Check worker_logs for metrics
- [ ] Test unauthorized access (should return 401)
- [ ] Test Releases page: `/dashboard/releases`
- [ ] Test Market deep linking from releases modal
- [ ] Deploy to Vercel
- [ ] Verify Vercel cron job runs daily

---

## 📝 Worker API Documentation

### Endpoint
`POST /api/workers/releases`

### Authentication
- **Header**: `Authorization: Bearer <CRON_SECRET>`
- **Query**: `?secret=<CRON_SECRET>`

### Parameters
None - reads configuration from `release_sources_whitelist` table

### Process Flow
1. Verify CRON_SECRET (401 if invalid)
2. Query `release_sources_whitelist` for enabled sources
3. For each source:
   - Fetch HTML from source_url
   - Parse with domain-specific parser
   - Extract: brand, model, colorway, date, image, SKUs
4. For each release:
   - Upsert into `releases` table
   - Ensure SKUs exist in `product_catalog`
   - Link via `release_products` junction table
5. Log metrics to `worker_logs`
6. Return summary JSON

### Rate Limits
- 5-second delay between sources
- 3 retries with exponential backoff for 429 responses
- User-Agent: `Mozilla/5.0 (compatible; ArchvdBot/1.0)`

---

## 🐛 Troubleshooting

### Worker returns `{"inserted":0,"updated":0,"linked":0,"errors":[]}`
- Migration not applied → Column names are wrong
- Run migration SQL in Supabase dashboard

### Worker shows "Unknown source: null"
- `source_name` column has NULL values
- Apply migration to rename `name` → `source_name`

### Worker fails with "table 'worker_logs' does not exist"
- Migration not applied
- Run migration SQL to create `worker_logs` table

### Parsers find 0 releases
- Retailer site structure changed
- Check browser dev tools to inspect current HTML structure
- Update parser selectors in `route.ts`

### SKU regex doesn't match
- Current regex: `/\b[A-Z]{2}\d{4}-\d{3}\b/g`
- Matches format: `AA2261-100`, `DZ5485-612`
- Update `extractSkuCandidates()` if format changes

---

## 📦 Files Created/Modified

### New Files
- `src/app/api/workers/releases/route.ts` - Main worker implementation
- `supabase/migrations/20250108_fix_release_sources_columns.sql` - Database fix
- `scripts/check-db-state.mjs` - Database diagnostic tool
- `scripts/apply-migration.mjs` - Migration helper
- `src/app/api/admin/migrate/route.ts` - Temporary migration checker (delete after use)
- `RELEASES_WORKER_STATUS.md` - This file

### Modified Files
- `.env.local` - Added CRON_SECRET
- `package.json` - Added cheerio dependencies
- `src/app/dashboard/releases/page.tsx` - Direct Supabase queries
- `src/app/dashboard/market/page.tsx` - Deep linking support
- `vercel.json` - Cron job configuration

---

## 🔒 Security Notes

- CRON_SECRET protects worker from unauthorized execution
- **Change default secret in production**: `CRON_SECRET=dev-secret-change-in-production`
- RLS is disabled on worker tables (server-side only access)
- No user authentication required (workers run as system)
- Worker logs may contain sensitive URLs/data
- Consider rate limiting at Vercel edge if public endpoint

---

## 🚀 Deployment to Vercel

1. Push changes to Git:
```bash
git add .
git commit -m "feat: releases worker implementation"
git push
```

2. Set environment variable in Vercel Dashboard:
   - Go to Project Settings → Environment Variables
   - Add `CRON_SECRET` with a strong random value (different from dev)
   - Add to Production, Preview, and Development

3. Deploy:
```bash
vercel --prod
```

4. Verify cron job:
   - Go to Vercel Dashboard → Deployments → Your Deployment → Cron Jobs
   - Should show: `POST /api/workers/releases` scheduled daily at 01:00 UTC

5. Test production endpoint:
```bash
curl -X POST "https://your-domain.vercel.app/api/workers/releases" \
  -H "Authorization: Bearer YOUR_PRODUCTION_CRON_SECRET"
```

---

## 📚 Related Documentation

- [Next.js 16.0 Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Cheerio Documentation](https://cheerio.js.org/)
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)

---

**Status**: Worker implementation complete ✅ | Database migration pending ⚠️
**Last Updated**: 2025-01-08
