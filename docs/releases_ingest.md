# Releases Ingest Pipeline

This document describes the Matrix V2 releases data pipeline that sources release data from thedropdate.com and serves it through the Archvd releases page.

## Architecture

```
thedropdate.com → Scraper API → Supabase (releases table) → Public API → UI
```

## Database Schema

### `releases` Table

Stores all scraped release data with automatic status computation.

```sql
- id: uuid (PK, auto-generated)
- source: text (e.g., 'thedropdate')
- external_id: text (unique, stable slug from source)
- title: text
- brand: text
- model: text
- colorway: text (nullable)
- sku: text (nullable)
- release_date: timestamptz (nullable, UTC)
- price_gbp: numeric (nullable)
- image_url: text (nullable)
- product_url: text (canonical release page)
- retailers: jsonb ([{name, url}])
- status: text (upcoming|dropped|tba, auto-computed)
- created_at: timestamptz
- updated_at: timestamptz
```

**Indexes:**
- `external_id` (unique)
- `release_date` (DESC NULLS LAST)
- `brand` (text_pattern_ops)
- `status`
- Full-text search on `title`, `brand`, `model`, `sku`

**Triggers:**
- `auto_set_release_status`: Auto-computes status based on release_date
  - `null` → `tba`
  - `> now()` → `upcoming`
  - `<= now()` → `dropped`
- `update_releases_updated_at`: Auto-updates `updated_at` on changes

### `scrape_cache` Table

Caches fetched HTML pages for 6 hours to enable polite crawling.

```sql
- id: uuid (PK)
- cache_key: text (unique, e.g., 'thedropdate:page:1')
- html: text
- fetched_at: timestamptz
- expires_at: timestamptz
```

### `release_ingest_logs` Table

Tracks all ingest runs for monitoring and debugging.

```sql
- id: uuid (PK)
- source: text
- run_at: timestamptz
- pages_fetched: integer
- items_inserted: integer
- items_updated: integer
- items_skipped: integer
- errors: jsonb (array of error messages)
- duration_ms: integer
```

## Scraper API

### Endpoint

`GET /api/releases/ingest/thedropdate`

**Query Parameters:**
- `pages` (optional, default: 3, max: 10): Number of pages to scrape

**Authentication:**
- Requires `Authorization: Bearer <token>` header

**Rate Limiting:**
- 1 request per minute per user (in-memory, use Redis in production)

**Response:**
```json
{
  "success": true,
  "pages_fetched": 3,
  "items_inserted": 15,
  "items_updated": 8,
  "items_skipped": 2,
  "duration_ms": 4521
}
```

### Scraping Logic

1. **Fetch HTML** (with 6h caching)
   - Cache key: `thedropdate:page:{N}`
   - User-Agent: `ArchvdBot/1.0 (+https://archvd.io)`
   - 800-1200ms jitter between page fetches

2. **Parse Cards**
   - Selectors: `.release-card`, `.product-card`, `.item-card`, `article`
   - Extract:
     - `external_id`: Slug from product URL
     - `title`, `image_url`, `product_url`
     - `brand`: First word or badge
     - `model`/`colorway`: Split from title
     - `sku`: From `.sku` or `.style-code`
     - `release_date`: Parse date badge → UTC midnight London
     - `price_gbp`: Extract numeric value
     - `retailers`: From links on card

3. **Upsert to DB**
   - Dedupe on `external_id`
   - Update if exists, insert otherwise

## Public Read API

### Endpoint

`GET /api/releases`

**Query Parameters:**
- `brand` (optional): Filter by exact brand name
- `q` (optional): Full-text search across title/brand/model/sku
- `month` (optional): YYYY-MM format (e.g., `2024-11`)
- `status` (optional): `upcoming|dropped|tba`
- `retailer` (optional): Filter by retailer name
- `cursor` (optional): Pagination cursor (ISO timestamp)
- `limit` (optional, default: 20, max: 100)

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "source": "thedropdate",
      "external_id": "nike-dunk-low-panda",
      "title": "Nike Dunk Low Retro",
      "brand": "Nike",
      "model": "Dunk Low Retro",
      "colorway": "Panda",
      "sku": "DD1391-100",
      "release_date": "2024-11-15T00:00:00Z",
      "price_gbp": 110.00,
      "image_url": "https://...",
      "product_url": "https://thedropdate.com/releases/...",
      "retailers": [{"name": "Nike SNKRS", "url": "https://..."}],
      "status": "upcoming",
      "created_at": "2024-11-08T...",
      "updated_at": "2024-11-08T..."
    }
  ],
  "nextCursor": "2024-11-08T12:00:00Z",
  "total": 42
}
```

## Cron Job (Daily Sync)

**Schedule:** Daily at 06:00 UK time

**Implementation Options:**

### Vercel Cron (Recommended for Next.js on Vercel)

Create `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/releases/ingest/thedropdate?pages=5",
      "schedule": "0 6 * * *"
    }
  ]
}
```

### Supabase Edge Function

Create `supabase/functions/sync-releases/index.ts`:
```ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async () => {
  const response = await fetch(
    'https://archvd.io/api/releases/ingest/thedropdate?pages=5',
    {
      headers: {
        'Authorization': `Bearer ${Deno.env.get('CRON_AUTH_TOKEN')}`
      }
    }
  )

  const data = await response.json()
  return new Response(JSON.stringify(data), { status: 200 })
})
```

Schedule in Supabase Dashboard → Edge Functions → Cron

### Alternative: GitHub Actions

Create `.github/workflows/sync-releases.yml`:
```yaml
name: Sync Releases
on:
  schedule:
    - cron: '0 6 * * *' # 06:00 UTC
  workflow_dispatch: # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger scraper
        run: |
          curl -X GET \
            -H "Authorization: Bearer ${{ secrets.CRON_AUTH_TOKEN }}" \
            "https://archvd.io/api/releases/ingest/thedropdate?pages=5"
```

## HTML Selectors (thedropdate.com)

> **Note:** These selectors are heuristic and may need adjustment if the site structure changes.

### Card Container
```css
.release-card, .product-card, .item-card, article
```

### Fields
- **Product URL:** `a` (first link)
- **Image:** `img[src]` or `img[data-src]`
- **Title:** `.product-title, h3, .release-title`
- **Brand Badge:** `.brand-badge, .brand-label`
- **SKU:** `.sku, .style-code`
- **Release Date:** `.release-date, .date`
- **Price:** `.price`
- **Retailers:** `.retailer-link, .store-link`

## Troubleshooting

### Scraper Returns 0 Items

1. **Check selectors:** Inspect HTML structure on thedropdate.com
2. **Check cache:** Clear `scrape_cache` table
3. **Check logs:** Review `release_ingest_logs` for errors

### Rate Limit Errors

- Wait 1 minute between manual sync requests
- In production, implement Redis-based rate limiting

### Status Not Updating

- Check `release_date` is valid ISO timestamp
- Verify `auto_set_release_status` trigger is installed
- Manually trigger: `UPDATE releases SET status = compute_release_status(release_date)`

### Missing Data

- Check `errors` field in `release_ingest_logs`
- Verify HTML parsing logic matches current site structure
- Test individual cards with cheerio in Node REPL

## Monitoring

### Metrics to Track

1. **Ingest Success Rate**: `items_inserted + items_updated` vs `items_skipped`
2. **Scrape Frequency**: Check `release_ingest_logs.run_at`
3. **Cache Hit Rate**: Monitor cache hits in logs
4. **API Latency**: Track `/api/releases` response times

### Queries

```sql
-- Latest ingest runs
SELECT * FROM release_ingest_logs
ORDER BY run_at DESC LIMIT 10;

-- Releases added today
SELECT COUNT(*) FROM releases
WHERE created_at::date = CURRENT_DATE;

-- Status distribution
SELECT status, COUNT(*) FROM releases
GROUP BY status;

-- Top brands
SELECT brand, COUNT(*) FROM releases
GROUP BY brand
ORDER BY COUNT(*) DESC LIMIT 10;
```

## Future Enhancements

1. **Multi-Source Support**: Add Nike SNKRS, Size?, Footpatrol scrapers
2. **Price History**: Track price changes over time
3. **Notify System**: Push notifications for new releases
4. **SKU Matching**: Auto-link to `product_catalog` if SKU exists
5. **Image CDN**: Upload images to Supabase Storage or Cloudflare R2

## References

- Migration: `supabase/migrations/20251108_create_releases_table.sql`
- Scraper API: `src/app/api/releases/ingest/thedropdate/route.ts`
- Public API: `src/app/api/releases/route.ts`
- UI: `src/app/portfolio/releases/page.tsx`
