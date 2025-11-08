# Testing Guide

This document provides instructions for testing new features in the Archvd application.

## P&L Date Range Filters

### Feature Overview

The P&L page now supports flexible date range filtering:

- **Presets**: This Month, Last 30 Days, Last 90 Days, YTD
- **Custom Range**: Select any from/to date range
- **URL Persistence**: Filters persist via query parameters
- **Client-side Filtering**: All data fetched once, filtered in browser
- **Smart Exports**: CSV exports include date range in filename

### Testing Steps

1. **Navigate to P&L page**:
   ```
   http://localhost:3000/dashboard/pnl
   ```

2. **Test Presets**:
   - Click each preset button (This Month, Last 30 Days, Last 90 Days, YTD)
   - Verify the "Showing:" text updates to display the correct date range
   - Verify KPIs update to reflect the selected period
   - Check that sold items and expenses tables show only items within the range

3. **Test Custom Range**:
   - Click the "Custom" button
   - Two date inputs should appear
   - Select a custom from/to date range
   - Verify data updates to match your selected range

4. **Test URL Persistence**:
   - Select a preset or custom range
   - Copy the URL (should include `?preset=...` or `?preset=custom&from=...&to=...`)
   - Refresh the page
   - Verify the same date range is still selected

5. **Test Exports**:
   - Select a date range
   - Click "P&L CSV" export button
   - Verify filename includes the date range (e.g., `archvd-pnl-2025-11-01_to_2025-11-21.csv`)
   - Verify exported data only includes items from the selected range
   - Test "VAT Detail" and "VAT Summary" exports similarly

6. **Test Edge Cases**:
   - Select a range with no data → should show "No sales in this period"
   - Select "Custom" with invalid dates → should handle gracefully
   - Switch between presets rapidly → should update smoothly

---

## Releases Worker

### Feature Overview

The releases worker fetches upcoming sneaker releases from Size?, Footpatrol, and Nike using **structured data parsing**:

- **Adapter Architecture**: Each retailer has a dedicated adapter for structured data extraction
- **Multi-Strategy Parsing**:
  - JSON-LD structured data (primary)
  - Next.js `__NEXT_DATA__` extraction
  - Embedded JSON in script tags
  - HTML fallback (last resort)
- **Strict SKU Validation**: Uses pattern matching for Nike (`AA1234-123`), Adidas, and other formats
- **Smart Title Parsing**: Extracts brand, model, and colorway with 10+ brand recognition
- **Strategy Reporting**: Shows which parsing method succeeded (`strategy_used` field)
- **Detailed Error Reasons**: Provides `reasons[]` array when zero items parsed
- **Rate Limiting**: 1 second delay between sources to respect retailers
- **Debug Mode**: Detailed logging with `?debug=1` including strategy used
- **Idempotent**: Running multiple times won't create duplicates
- **SKU Linking**: Auto-creates product catalog entries and links SKUs
- **Auto Slugs**: Generates URL-safe slugs from brand/model/colorway

### Testing Steps

#### 1. Basic Worker Run

```bash
curl -X POST "http://localhost:3000/api/workers/releases?secret=dev-secret"
```

Expected response:
```json
{
  "inserted": 15,
  "updated": 0,
  "linked": 23,
  "errors": []
}
```

#### 2. Debug Mode

```bash
curl -X POST "http://localhost:3000/api/workers/releases?secret=dev-secret&debug=1"
```

Expected response includes debug info with `strategy` and `reasons`:
```json
{
  "inserted": 15,
  "updated": 0,
  "linked": 23,
  "errors": [],
  "debug": {
    "sources": [
      {
        "domain": "size",
        "status": 200,
        "htmlLength": 125430,
        "strategy": "nextdata",
        "parsedCount": 15,
        "sampleTitles": ["Nike Dunk Low...", "Jordan 1 High..."],
        "warnings": [],
        "errors": [],
        "reasons": []
      },
      {
        "domain": "nike",
        "status": 204,
        "htmlLength": 2192570,
        "strategy": "html-fallback",
        "parsedCount": 0,
        "sampleTitles": [],
        "warnings": ["No structured data found in page"],
        "errors": [],
        "reasons": [
          "Strategy used: html-fallback",
          "No structured data found in page",
          "Consider using API endpoint or headless browser"
        ]
      }
    ],
    "metrics": {...}
  }
}
```

**Strategy Types**:
- `jsonld` - Successfully parsed JSON-LD structured data
- `nextdata` - Successfully extracted Next.js __NEXT_DATA__
- `script-json` - Found JSON in script tags
- `feed` - Used API feed endpoint
- `html-fallback` - Fell back to HTML parsing (may indicate page is JS-rendered)

#### 3. Smoke Test (No DB Writes)

Test parsers without modifying the database:

```bash
curl "http://localhost:3000/api/admin/releases/smoke?secret=dev-secret"
```

Expected response with `strategy` field:
```json
{
  "success": true,
  "results": [
    {
      "domain": "size",
      "status": 200,
      "htmlLength": 125430,
      "strategy": "nextdata",
      "parsedCount": 15,
      "sampleTitles": ["Nike Dunk Low...", "Jordan 1 High..."],
      "warnings": [],
      "errors": []
    },
    {
      "domain": "nike",
      "status": 204,
      "htmlLength": 2192570,
      "strategy": "html-fallback",
      "parsedCount": 0,
      "sampleTitles": [],
      "warnings": ["No structured data found in page"],
      "errors": []
    }
  ],
  "timestamp": "2025-11-08T12:00:00.000Z"
}
```

The smoke test shows which parsing strategy was used for each source without writing to the database.

#### 4. Verify Results

After running the worker, check the releases page:

```
http://localhost:3000/dashboard/releases
```

- Should see newly scraped releases
- Verify brand, model, colorway parsed correctly
- Check release dates are in the future (status: upcoming)
- Verify images are loading

#### 5. Test Idempotency

Run the worker twice:

```bash
# First run
curl -X POST "http://localhost:3000/api/workers/releases?secret=dev-secret"
# Response: {"inserted": 15, "updated": 0, ...}

# Second run
curl -X POST "http://localhost:3000/api/workers/releases?secret=dev-secret"
# Response: {"inserted": 0, "updated": 15, ...}
```

Second run should have `inserted: 0` and `updated: 15` (or similar).

---

## Admin Ingest (Dev Only)

### Feature Overview

Manually import release data via JSON (useful for testing or when scraping fails).

### Testing Steps

1. **Prepare Test Data**:

Create `test-releases.json`:
```json
{
  "releases": [
    {
      "brand": "Nike",
      "model": "Dunk Low",
      "colorway": "Panda",
      "release_date": "2025-12-25",
      "source": "manual",
      "source_url": "https://example.com",
      "image_url": "https://example.com/image.jpg",
      "skus": ["DD1391-100"],
      "status": "upcoming"
    },
    {
      "brand": "Jordan",
      "model": "1 High",
      "colorway": "Chicago",
      "release_date": "2025-11-15",
      "source": "manual",
      "skus": ["555088-101"]
    }
  ]
}
```

2. **Import Data**:

```bash
curl -X POST "http://localhost:3000/api/admin/releases/ingest?secret=dev-secret" \
  -H "Content-Type: application/json" \
  -d @test-releases.json
```

Expected response:
```json
{
  "inserted": 2,
  "updated": 0,
  "linked": 2,
  "errors": []
}
```

3. **Verify Import**:

- Navigate to `/dashboard/releases`
- Should see the manually imported releases
- SKUs should be linked in product catalog

4. **Test Update (Idempotent)**:

Re-run the same import:

```bash
curl -X POST "http://localhost:3000/api/admin/releases/ingest?secret=dev-secret" \
  -H "Content-Type: application/json" \
  -d @test-releases.json
```

Expected response:
```json
{
  "inserted": 0,
  "updated": 2,
  "linked": 0,
  "errors": []
}
```

---

## Production Testing

### Vercel Cron

After deploying to Vercel, the releases worker runs automatically at 1 AM daily.

Monitor execution:
1. Go to Vercel dashboard → Your Project → Logs
2. Filter by `/api/workers/releases`
3. Check for successful runs (200 status)
4. Review any errors in the logs

### Environment Variables

Ensure these are set in Vercel:

- `CRON_SECRET`: Your secret token for worker authentication
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for server operations)

---

## Adapter Architecture & Parsing Strategies

### Source Adapters

Each retailer has a dedicated adapter in `/src/app/api/workers/releases/adapters/`:

- **Nike Adapter** ([nike.ts](src/app/api/workers/releases/adapters/nike.ts)): `https://www.nike.com/gb/launch`
- **Size? Adapter** ([size.ts](src/app/api/workers/releases/adapters/size.ts)): `https://www.size.co.uk/page/sizepreviews-launches/`
- **Footpatrol Adapter** ([footpatrol.ts](src/app/api/workers/releases/adapters/footpatrol.ts)): `https://www.footpatrol.com/pages/launch-page/`

### Parsing Strategies (in priority order)

**1. JSON-LD Structured Data** (Strategy: `jsonld`):
- Parses `<script type="application/ld+json">` blocks
- Looks for `@type: Product` or `@type: ItemList`
- Most reliable when available

**2. Next.js `__NEXT_DATA__`** (Strategy: `nextdata`):
- Extracts `<script id="__NEXT_DATA__">` content
- Navigates to `props.pageProps.products` or similar paths
- Works well for Size? and other Next.js sites

**3. Embedded Script JSON** (Strategy: `script-json`):
- Searches for `window.__STATE__`, `window.__INITIAL_STATE__`, etc.
- Parses JD Group `data-component` attributes
- Last resort before HTML fallback

**4. HTML Fallback** (Strategy: `html-fallback`):
- Only used when all structured data strategies fail
- Indicates page is likely JS-rendered or structure changed
- Will return zero results for dynamic pages

### SKU Extraction (Strict)

Located in [/src/lib/sku.ts](src/lib/sku.ts) with pattern matching:

**Nike Pattern**: `^[A-Z0-9]{5,6}-\d{3}$`
- Examples: `CT8527-016`, `DZ5485-612`, `DD1391-100`

**Adidas/Jordan Pattern**: `^[A-Z]{2,3}[A-Z0-9]{4,9}$`
- Examples: `GY0095`, `FZ5000`
- 9-12 alphanumeric characters

**Validation**:
- Minimum 6 characters
- Must contain at least one letter
- Rejects pure numbers, size codes (UK12, US10)
- Filters false positives (GB, EU, etc.)

### Title Parsing

Recognizes 10+ brands:
- Nike, Jordan, Air Jordan, adidas, New Balance
- ASICS, Puma, Salomon, Vans, Converse, Reebok
- On, Hoka

Colorway extraction:
- From quotes: `Nike Dunk Low "Panda"` → colorway: "Panda"
- After hyphen: `Nike Dunk Low - Panda` → colorway: "Panda"

Auto-generates URL-safe slugs: `nike-dunk-low-panda`

---

## Troubleshooting

### Releases Worker Returns Zero Results

1. **Run with debug mode**:
   ```bash
   curl -X POST "http://localhost:3000/api/workers/releases?secret=dev-secret&debug=1" | jq '.debug.sources'
   ```

2. **Check debug output**:
   - `strategy: "html-fallback"` + `parsedCount: 0` → No structured data found, page likely JS-rendered
   - `reasons[]` array → Check specific warnings about why parsing failed
   - `htmlLength < 5000` → Page may be blocking or redirecting
   - `warnings: ["No structured data found"]` → Site may have changed structure or removed JSON-LD

3. **Interpret strategies**:
   - `jsonld` or `nextdata` with `parsedCount > 0` → ✅ Working correctly
   - `html-fallback` with `parsedCount: 0` → ❌ Need to find API endpoint or use headless browser
   - `script-json` → Adapter found embedded JSON, good fallback

4. **Run smoke test**:
   ```bash
   curl "http://localhost:3000/api/admin/releases/smoke?secret=dev-secret" | jq '.results'
   ```
   This shows what each adapter sees without DB operations

5. **Check source URLs**:
   Verify the URLs in your `release_sources_whitelist` table are correct and enabled

### P&L Filters Not Working

1. **Check browser console** for JavaScript errors
2. **Verify URL params** are being set correctly
3. **Check data exists** for the selected date range
4. **Clear browser cache** and reload

### CSV Exports Missing Data

1. **Verify date range** is selecting the intended period
2. **Check filtered arrays** are being passed to export functions
3. **Inspect console** for any export errors
