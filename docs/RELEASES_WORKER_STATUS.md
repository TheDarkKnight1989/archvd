# Releases Worker - Status & Documentation

**Last Updated**: 2025-11-18

---

## Overview

The Releases Worker is a cron-authenticated background job that fetches upcoming sneaker/product launches from retailer websites and stores them in the `releases` table. It uses a **structured data adapter pattern** that strictly avoids fragile CSS-based HTML scraping.

**Architecture**: Source Adapters → Structured Data Extraction → Database Upserts

---

## ✅ Active Sources

### Nike Launch Calendar
- **Domain**: `nike.com/gb/launch`
- **Adapter**: `src/app/api/workers/releases/adapters/nike.ts`
- **Strategy**: JSON-LD, __NEXT_DATA__, or script-embedded JSON
- **Status**: ✅ **Enabled**
- **Data Quality**: High - structured data available

### Footpatrol Launch Page
- **Domain**: `footpatrol.com/pages/launch-page`
- **Adapter**: `src/app/api/workers/releases/adapters/footpatrol.ts`
- **Strategy**: JSON-LD, __NEXT_DATA__, or script-embedded JSON
- **Status**: ✅ **Enabled**
- **Data Quality**: High - structured data available

---

## ⚠️ Unsupported Sources

### Size? Launch Previews
- **Domain**: `size.co.uk/page/sizepreviews-launches/`
- **Adapter**: `src/app/api/workers/releases/adapters/size.ts` (disabled)
- **Strategy**: Attempted __NEXT_DATA__, script-json, jsonld
- **Status**: ❌ **Disabled**
- **Reason**: Page is fully client-side rendered with no structured data available
- **Details**:
  - No `__NEXT_DATA__` script tag present
  - No JSON-LD structured data
  - No embedded JSON in script tags
  - Page requires JavaScript to render launch data
  - 332KB HTML contains only NewRelic tracking scripts
- **Resolution**: Waiting for Size? to provide:
  - Server-side rendered __NEXT_DATA__
  - JSON-LD structured data
  - Public API endpoint
  - Alternative JSON feed

**Note**: Size? can be re-enabled if they add structured data in the future. To check, run the smoke test:
```bash
curl "http://localhost:3000/api/admin/releases/smoke?secret=dev-secret&debug=1"
```

---

## 🏗️ Architecture

### Adapter Pattern

Each release source implements the `ReleaseAdapter` interface:

```typescript
interface ReleaseAdapter {
  readonly name: string          // e.g., 'nike', 'footpatrol'
  readonly url: string            // Source URL to fetch
  fetchIndex(options?: FetchOptions): Promise<AdapterResult>
}
```

**Adapter Result**:
```typescript
interface AdapterResult {
  releases: NormalizedRelease[]   // Parsed releases
  strategy: ExtractionStrategy    // How data was extracted
  metadata?: {
    htmlLength?: number
    itemsFound?: number
    warnings?: string[]
    errors?: string[]
  }
}
```

**Extraction Strategies** (in priority order):
1. `jsonld` - JSON-LD structured data (`<script type="application/ld+json">`)
2. `nextdata` - Next.js `__NEXT_DATA__` script tag
3. `feed` - JSON API feed/endpoint
4. `script-json` - JSON embedded in script tags (window.__STATE__, etc.)
5. `html-fallback` - Last resort HTML parsing (avoided when possible)

### Data Flow

```
1. Worker runs (Vercel cron or manual trigger)
   ↓
2. Query release_sources_whitelist WHERE enabled = true
   ↓
3. For each enabled source:
   - Get adapter (getAdapter(source_name))
   - Fetch and parse (adapter.fetchIndex())
   - Extract releases using structured data strategies
   ↓
4. For each release:
   - Upsert to releases table (brand, model, colorway, date, etc.)
   - Extract SKUs using strict patterns (lib/sku.ts)
   - Create product_catalog entries for SKUs
   - Link via release_products junction table
   ↓
5. Log metrics to worker_logs
   ↓
6. Return summary JSON
```

---

## 📁 File Structure

```
src/app/api/workers/releases/
├── route.ts                    # Main worker endpoint
├── adapters/
│   ├── index.ts                # Adapter registry (getAdapter)
│   ├── types.ts                # TypeScript interfaces
│   ├── utils.ts                # Shared utilities (fetchWithRetry, parseUkDate, etc.)
│   ├── nike.ts                 # Nike adapter (enabled)
│   ├── footpatrol.ts           # Footpatrol adapter (enabled)
│   └── size.ts                 # Size? adapter (disabled)
```

**Related Files**:
- `src/lib/sku.ts` - Centralized SKU extraction with strict regex patterns
- `src/app/api/admin/releases/smoke/route.ts` - Test endpoint (no DB writes)
- `supabase/migrations/20251118_disable_size_release_source.sql` - Size? disable migration

---

## 🗄️ Database Schema

### releases
```sql
CREATE TABLE releases (
  id uuid PRIMARY KEY,
  source text NOT NULL,           -- 'nike', 'footpatrol', etc.
  external_id text NOT NULL UNIQUE,

  -- Product info
  title text NOT NULL,
  brand text NOT NULL,
  model text NOT NULL,
  colorway text,
  sku text,

  -- Timing & pricing
  release_date timestamptz,
  price_gbp numeric(10, 2),

  -- Media & links
  image_url text,
  product_url text,
  retailers jsonb DEFAULT '[]'::jsonb,

  -- Status (auto-computed)
  status text NOT NULL DEFAULT 'tba' CHECK (status IN ('upcoming', 'dropped', 'tba')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### release_sources_whitelist
```sql
CREATE TABLE release_sources_whitelist (
  id uuid PRIMARY KEY,
  source_name text NOT NULL UNIQUE,   -- 'nike.com', 'size.co.uk', etc.
  source_url text NOT NULL,           -- Full URL to launches page
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### worker_logs
```sql
CREATE TABLE worker_logs (
  id uuid PRIMARY KEY,
  worker_name text NOT NULL,          -- 'releases_worker'
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  status text NOT NULL,               -- 'success', 'partial_success', 'failed'
  metrics jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

## 🔐 Authentication

**Protected by CRON_SECRET**:
- Header: `Authorization: Bearer <CRON_SECRET>`
- Query: `?secret=<CRON_SECRET>`

**Environment Variable**:
```bash
CRON_SECRET=dev-secret-change-in-production  # Change in production!
```

---

## 🧪 Testing

### Smoke Test (No Database Writes)
```bash
curl "http://localhost:3000/api/admin/releases/smoke?secret=dev-secret&debug=1"
```

**Expected Output**:
```json
{
  "results": [
    {
      "domain": "nike",
      "status": 200,
      "strategy": "jsonld",
      "parsedCount": 15,
      "sampleTitles": ["Air Jordan 1 High OG 'Patent Bred'", "..."]
    },
    {
      "domain": "footpatrol",
      "status": 200,
      "strategy": "nextdata",
      "parsedCount": 8
    },
    {
      "domain": "size.co.uk",
      "status": 0,
      "strategy": "html-fallback",
      "parsedCount": 0,
      "reasons": [
        "Source disabled: requires JS-rendered JSON feed",
        "Page has no __NEXT_DATA__, JSON-LD, or embedded JSON available"
      ]
    }
  ]
}
```

### Full Worker Test (Database Writes)
```bash
curl -X POST "http://localhost:3000/api/workers/releases?secret=dev-secret&debug=1"
```

**Expected Output**:
```json
{
  "inserted": 23,
  "updated": 5,
  "linked": 30,
  "errors": [],
  "debug": {
    "sources": [
      {
        "domain": "nike",
        "status": 200,
        "strategy": "jsonld",
        "parsedCount": 15
      },
      {
        "domain": "size.co.uk",
        "status": 0,
        "parsedCount": 0,
        "reasons": [
          "Source disabled: requires JS-rendered JSON feed",
          "Cannot reliably extract launch data until structured data is provided"
        ]
      }
    ],
    "metrics": {
      "started_at": "2025-11-18T10:00:00Z",
      "sources_processed": 2,
      "releases_found": 23,
      "inserted": 23,
      "updated": 5,
      "linked": 30,
      "errors": []
    }
  }
}
```

---

## 🚀 Deployment

### Vercel Cron Configuration

**File**: `vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/workers/releases",
      "schedule": "0 1 * * *"
    }
  ]
}
```

**Schedule**: Daily at 1:00 AM UTC

### Environment Setup

1. **Set CRON_SECRET in Vercel**:
   - Go to Project Settings → Environment Variables
   - Add `CRON_SECRET` with a strong random value
   - Apply to Production, Preview, and Development

2. **Deploy**:
   ```bash
   git push origin main
   vercel --prod
   ```

3. **Verify Cron Job**:
   - Vercel Dashboard → Deployments → Cron Jobs
   - Should show: `POST /api/workers/releases` (daily @ 01:00 UTC)

---

## 📊 Monitoring

### Check Worker Logs
```bash
node scripts/check-db-state.mjs
```

### Query Database
```sql
-- Recent worker runs
SELECT * FROM worker_logs
WHERE worker_name = 'releases_worker'
ORDER BY created_at DESC
LIMIT 10;

-- Recent releases
SELECT brand, model, colorway, release_date, source
FROM releases
ORDER BY created_at DESC
LIMIT 20;

-- Disabled sources
SELECT source_name, source_url, enabled
FROM release_sources_whitelist
WHERE enabled = false;
```

---

## 🛠️ Troubleshooting

### No Releases Found (parsedCount = 0)

**Possible Causes**:
1. **Source disabled**: Check `release_sources_whitelist.enabled`
2. **Structured data removed**: Retailer changed site architecture
3. **Page is JS-rendered**: No server-side data available (like Size?)

**Diagnosis**:
```bash
# Run smoke test with debug
curl "http://localhost:3000/api/admin/releases/smoke?secret=dev-secret&debug=1"

# Check warnings and reasons in output
```

**Solutions**:
- If `reasons` includes "disabled", check database: `SELECT * FROM release_sources_whitelist`
- If `strategy = "html-fallback"`, page has no structured data → disable source
- If retailer changed structure, update adapter or find new data source

### SKUs Not Extracting

**Current Patterns** (`src/lib/sku.ts`):
- **Nike**: `/\b[A-Z0-9]{5,6}-\d{3}\b/g` (e.g., `DZ5485-612`, `CT8527-016`)
- **Jordan**: Same as Nike
- **Adidas**: `/\b[A-Z]{2,3}[A-Z0-9]{4,9}\b/g` (e.g., `GY0095`, `FZ5000`)

**Diagnosis**:
```typescript
// Test extraction in console
import { extractSkus } from '@/lib/sku'
extractSkus('Nike Dunk Low DZ5485-612 Panda', 'nike')
// Should return: ['DZ5485-612']
```

**Solution**: Update patterns in `src/lib/sku.ts` if new SKU formats appear

---

## 🔄 Re-enabling Size?

If Size? adds structured data in the future:

1. **Verify structured data exists**:
   ```bash
   # Check for __NEXT_DATA__
   curl "https://www.size.co.uk/page/sizepreviews-launches/" | grep -o '__NEXT_DATA__'

   # Check for JSON-LD
   curl "https://www.size.co.uk/page/sizepreviews-launches/" | grep 'application/ld+json'
   ```

2. **Test adapter**:
   ```bash
   curl "http://localhost:3000/api/admin/releases/smoke?secret=dev-secret&debug=1"
   # Check if Size? shows parsedCount > 0
   ```

3. **Re-enable in database**:
   ```sql
   UPDATE release_sources_whitelist
   SET enabled = true
   WHERE source_name = 'size.co.uk';
   ```

4. **Run full worker test**:
   ```bash
   curl -X POST "http://localhost:3000/api/workers/releases?secret=dev-secret&debug=1"
   ```

---

## 📝 Adding New Sources

To add a new retailer (e.g., JD Sports):

1. **Create adapter**: `src/app/api/workers/releases/adapters/jd.ts`
   ```typescript
   import { ReleaseAdapter, AdapterResult } from './types'

   export class JdAdapter implements ReleaseAdapter {
     readonly name = 'jd'
     readonly url = 'https://www.jdsports.co.uk/launches/'

     async fetchIndex(options?: FetchOptions): Promise<AdapterResult> {
       // Implement using structured data strategies
       // Try: __NEXT_DATA__ → JSON-LD → script-json
       // NO CSS selectors!
     }
   }
   ```

2. **Register adapter**: Add to `src/app/api/workers/releases/adapters/index.ts`
   ```typescript
   import { JdAdapter } from './jd'

   export function getAdapter(name: string): ReleaseAdapter | null {
     switch (name.toLowerCase()) {
       case 'jd':
       case 'jdsports.co.uk':
         return new JdAdapter()
       // ...
     }
   }
   ```

3. **Add to whitelist**:
   ```sql
   INSERT INTO release_sources_whitelist (source_name, source_url, enabled)
   VALUES ('jdsports.co.uk', 'https://www.jdsports.co.uk/launches/', true);
   ```

4. **Test**:
   ```bash
   curl "http://localhost:3000/api/admin/releases/smoke?secret=dev-secret&debug=1"
   ```

---

## 🔒 Security & Best Practices

### Rate Limiting
- 1-second delay between sources (configurable)
- Exponential backoff on 429 responses
- Respect `Retry-After` headers

### User-Agent
```
ArchvdBot/1.0 (+https://archvd.io/dev; archvd.io/dev)
```

### CRON_SECRET
- Use environment variable (never hardcode)
- Different value for dev/staging/production
- Rotate periodically

### RLS (Row Level Security)
- `releases`: Authenticated read, service role write
- `worker_logs`: Authenticated read, service role write
- `release_sources_whitelist`: No RLS (internal table)

---

## 📚 Related Documentation

- [Adapter Types](../src/app/api/workers/releases/adapters/types.ts)
- [SKU Extraction Patterns](../src/lib/sku.ts)
- [Smoke Test Endpoint](../src/app/api/admin/releases/smoke/route.ts)
- [Database Schema Migrations](../supabase/migrations/)

---

**Status**: ✅ Operational (Nike, Footpatrol) | ⚠️ Size? Disabled (no structured data)
