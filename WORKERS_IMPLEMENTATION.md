# Market & Releases Workers Implementation Guide

This document provides implementation guidance for the two background workers that power the market data system.

## Overview

Two workers are required to keep market data fresh:

1. **releases_worker** - Scrapes upcoming releases from retailer websites
2. **price_refresh_v2** - Fetches per-size market prices from StockX/Laced

## Architecture Options

### Option 1: Supabase Edge Functions (Recommended)

Deploy as Deno-based Edge Functions with pg_cron for scheduling.

**Pros:**
- Native Supabase integration
- Direct database access
- Free tier available
- Built-in secrets management

**Setup:**
```bash
# Initialize Supabase Functions
supabase functions new releases_worker
supabase functions new price_refresh_v2

# Deploy
supabase functions deploy releases_worker
supabase functions deploy price_refresh_v2
```

### Option 2: Vercel Cron Jobs

Create API routes with cron.json configuration.

**Pros:**
- Integrated with existing Next.js deployment
- Simple configuration
- No additional infrastructure

**Setup:**
Create `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/workers/releases",
      "schedule": "0 1 * * *"
    },
    {
      "path": "/api/workers/prices",
      "schedule": "0 2 * * *"
    }
  ]
}
```

---

## Worker 1: Releases Worker

### Purpose
Scrapes upcoming releases from Nike, Size?, and Footpatrol launch pages nightly.

### Pseudocode

```typescript
export async function releasesWorker() {
  const sources = [
    {
      name: 'nike',
      url: 'https://www.nike.com/gb/launch',
      parser: parseNikeLaunch
    },
    {
      name: 'size',
      url: 'https://www.size.co.uk/page/sizepreviews-launches/',
      parser: parseSizeLaunch
    },
    {
      name: 'footpatrol',
      url: 'https://www.footpatrol.com/pages/launch-page',
      parser: parseFootpatrolLaunch
    }
  ]

  for (const source of sources) {
    try {
      // 1. Verify domain is whitelisted
      const whitelisted = await checkWhitelist(source.url)
      if (!whitelisted) continue

      // 2. Fetch HTML
      const html = await fetch(source.url).then(r => r.text())

      // 3. Parse with source-specific logic
      const releases = source.parser(html)

      // 4. Insert/upsert releases
      for (const release of releases) {
        await upsertRelease({
          brand: release.brand,
          model: release.model,
          colorway: release.colorway,
          release_date: release.date,
          source: source.name,
          source_url: release.url,
          image_url: release.image,
          slug: release.slug,
          status: release.date > new Date() ? 'upcoming' : 'past'
        })

        // 5. Link SKUs if available
        if (release.sku) {
          await linkReleaseProduct(release.id, release.sku)
        }
      }

    } catch (error) {
      console.error(`[Releases Worker] ${source.name} failed:`, error)
    }
  }
}
```

### Implementation Example (Supabase Edge Function)

```typescript
// supabase/functions/releases_worker/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    // Nike Launch Scraper
    const nikeResponse = await fetch('https://www.nike.com/gb/launch')
    const nikeHtml = await nikeResponse.text()

    // Parse Nike releases (requires HTML parsing)
    const nikeReleases = parseNikeHtml(nikeHtml)

    // Insert into database
    for (const release of nikeReleases) {
      const { error } = await supabase
        .from('releases')
        .upsert({
          brand: release.brand,
          model: release.model,
          colorway: release.colorway,
          release_date: release.date,
          source: 'nike',
          source_url: release.url,
          image_url: release.image,
          status: 'upcoming'
        }, {
          onConflict: 'brand,model,colorway,release_date,source'
        })

      if (error) console.error('Insert error:', error)
    }

    return new Response(
      JSON.stringify({ processed: nikeReleases.length }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})
```

### Schedule
Run nightly at 01:00 Europe/London

---

## Worker 2: Price Refresh Worker

### Purpose
Fetches current market prices per size for all catalog SKUs from StockX and Laced.

### Pseudocode

```typescript
export async function priceRefreshWorker() {
  // 1. Fetch all SKUs from product_catalog
  const skus = await db.query('SELECT sku FROM product_catalog')

  for (const { sku } of skus) {
    try {
      // 2. Fetch prices from StockX (primary source)
      const stockxPrices = await fetchStockXPrices(sku)

      for (const { size, price, currency, meta } of stockxPrices) {
        // 3. Convert to GBP if needed
        const gbpPrice = currency === 'GBP'
          ? price
          : await convertCurrency(price, currency, 'GBP')

        // 4. Insert price snapshot
        await db.query(`
          INSERT INTO product_market_prices (sku, size, source, currency, price, as_of, meta)
          VALUES ($1, $2, 'stockx', 'GBP', $3, NOW(), $4)
        `, [sku, size, gbpPrice, meta])
      }

      // 5. Fallback to Laced if StockX fails
      if (stockxPrices.length === 0) {
        const lacedPrices = await fetchLacedPrices(sku)
        // ... similar insert logic
      }

      // 6. Rate limit
      await sleep(1000) // 1 second between SKUs

    } catch (error) {
      console.error(`[Price Worker] Failed for ${sku}:`, error)
    }
  }
}
```

### Implementation Example (Next.js API Route)

```typescript
// src/app/api/workers/prices/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchMarketPrice } from '@/lib/pricing' // Your pricing lib

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  // Fetch all catalog SKUs
  const { data: products } = await supabase
    .from('product_catalog')
    .select('sku')
    .limit(100) // Process in batches

  let updated = 0

  for (const { sku } of products || []) {
    try {
      // Fetch prices for this SKU
      const prices = await fetchMarketPrice(sku)

      // Insert each size
      for (const { size, price, source } of prices) {
        await supabase
          .from('product_market_prices')
          .insert({
            sku,
            size,
            source,
            currency: 'GBP',
            price,
            as_of: new Date().toISOString(),
          })

        updated++
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 1000))

    } catch (error) {
      console.error(`Failed to update ${sku}:`, error)
    }
  }

  return NextResponse.json({ updated })
}
```

### Schedule
Run nightly at 02:00 Europe/London (after releases worker)

---

## Rate Limiting

Both workers must respect rate limits:

- **StockX**: 60 requests/minute (1 req/sec safe)
- **Laced**: 30 requests/minute (2 sec between requests)
- **Nike/Size?/Footpatrol**: No official limit, use 5 sec between page fetches

Implement exponential backoff on 429 responses:
```typescript
async function fetchWithRetry(url: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url)
    if (res.status === 429) {
      await sleep(Math.pow(2, i) * 1000) // 1s, 2s, 4s
      continue
    }
    return res
  }
  throw new Error('Rate limited')
}
```

---

## Currency Conversion

Use ECB (European Central Bank) API for daily FX rates:

```typescript
async function updateFxRates() {
  const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
  const { rates, date } = await res.json()

  for (const [currency, rate] of Object.entries(rates)) {
    await db.query(`
      INSERT INTO fx_rates (from_currency, to_currency, rate, as_of, source)
      VALUES ('USD', $1, $2, $3, 'ecb')
      ON CONFLICT (from_currency, to_currency, as_of) DO UPDATE SET rate = $2
    `, [currency, rate, date])
  }
}
```

---

## Monitoring & Alerts

Add logging to track:
- Number of releases scraped per source
- Number of prices updated per SKU
- Failed SKUs (404s, rate limits)
- Worker execution time

Example metrics:
```typescript
const metrics = {
  started_at: new Date(),
  source: 'nike',
  releases_found: 12,
  releases_inserted: 10,
  releases_skipped: 2,
  errors: []
}

// Log to Supabase or external service
await supabase.from('worker_logs').insert(metrics)
```

---

## Testing Locally

### Test Releases Worker
```bash
curl -X POST http://localhost:3000/api/workers/releases \
  -H "Authorization: Bearer YOUR_DEV_SECRET"
```

### Test Price Worker
```bash
curl -X POST http://localhost:3000/api/workers/prices \
  -H "Authorization: Bearer YOUR_DEV_SECRET"
```

### Manual Trigger (Development)
Create admin UI buttons that call these endpoints for testing.

---

## Deployment Checklist

- [ ] Database migrations applied (`product_catalog`, `product_market_prices`, `releases`, etc.)
- [ ] API routes created and tested
- [ ] Worker functions deployed (Supabase or Vercel)
- [ ] Cron schedules configured
- [ ] Rate limiting implemented
- [ ] Error logging enabled
- [ ] Secrets configured (API keys, cron secret)
- [ ] Initial seed data populated (optional)

---

## Next Steps

1. **Phase 1**: Deploy database schema
2. **Phase 2**: Implement API endpoints (✅ Done)
3. **Phase 3**: Create UI pages (✅ Done)
4. **Phase 4**: Implement worker functions (This guide)
5. **Phase 5**: Schedule cron jobs
6. **Phase 6**: Monitor and optimize

---

## Useful Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [StockX API (Unofficial)](https://github.com/topics/stockx-api)
- [Laced API Docs](https://www.laced.com/)
- [cheerio HTML Parser](https://cheerio.js.org/) (for scraping)

---

**Questions?** Check the existing `/api/pricing/refresh` route for patterns used in the codebase.
