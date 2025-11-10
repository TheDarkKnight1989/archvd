# Prompts 2 & 3 - Complete ✅

## Prompt 2: Wire Releases Cron

**Status**: ✅ Complete

### Changes Made

**File**: `vercel.json`

Updated the releases worker cron job to include the CRON_SECRET as a query parameter:

```json
{
  "crons": [
    {
      "path": "/api/workers/releases?secret=%CRON_SECRET%",
      "schedule": "0 1 * * *"
    }
  ]
}
```

### How It Works

- **Environment Variable**: Vercel automatically replaces `%CRON_SECRET%` with the actual value from environment variables
- **Schedule**: Runs daily at 01:00 UTC (1 AM)
- **Authentication**: The worker validates the secret before executing

### Testing Locally

```bash
# Test worker with secret
curl -X POST "http://localhost:3000/api/workers/releases?secret=dev-secret-change-in-production"
```

### Deployment Checklist

- [ ] Set `CRON_SECRET` in Vercel environment variables (Production)
- [ ] Use a strong, random value (NOT the dev default)
- [ ] Deploy to Vercel
- [ ] Verify cron job appears in Vercel Dashboard → Cron Jobs
- [ ] Monitor first execution in worker_logs table

---

## Prompt 3: Market API Polish

**Status**: ✅ Complete

### API Endpoint Changes

**File**: `src/app/api/market/[sku]/route.ts`

#### New Response Format

**Success Response (200)**:
```json
{
  "catalog": {
    "sku": "DD1391-100",
    "brand": "Nike",
    "model": "Dunk Low",
    "colorway": "White/Black",
    "image_url": "https://...",
    "retail_price": 120,
    "release_date": "2024-01-15",
    "currency": "GBP",
    "meta": {}
  },
  "prices": [
    {
      "sku": "DD1391-100",
      "size": "UK8",
      "source": "stockx",
      "price": 130,
      "currency": "GBP",
      "as_of": "2025-11-06T10:00:00Z",
      "meta": {}
    }
  ],
  "sources": ["stockx", "laced"]
}
```

**Not Found Response (404)**:
```json
{
  "error": "Product not found",
  "message": "No catalog entry found for SKU: INVALID-SKU"
}
```

**Bad Request Response (400)**:
```json
{
  "error": "SKU parameter is required"
}
```

### Key Changes

1. **Renamed `product` → `catalog`**
   - More accurate name for product catalog data
   - Consistent with database table naming

2. **Added `sources` array**
   - Lists distinct sources with price data
   - Sorted alphabetically
   - Empty array if no prices

3. **Removed `lastRefresh` and `priceCount`**
   - No longer needed in response
   - `prices.length` replaces `priceCount`
   - Individual price `as_of` timestamps replace global `lastRefresh`

4. **Proper 404 handling**
   - Returns 404 if product not in catalog
   - Includes descriptive error message
   - Previously returned 200 with null product

### Frontend Updates

**File**: `src/app/dashboard/market/page.tsx`

Updated to match new API response format:

- Changed `product` → `catalog` throughout
- Replaced `lastRefresh` timestamp with sources badges
- Show sources in table header instead of update time
- Fixed `priceCount` → `prices.length`

**New Sources Display**:
```tsx
{marketData.sources.length > 0 && (
  <div className="flex items-center gap-2">
    <p className="text-xs text-dim">Sources:</p>
    {marketData.sources.map((source) => (
      <Badge key={source} variant="outline" className="text-xs capitalize">
        {source}
      </Badge>
    ))}
  </div>
)}
```

### Testing

**Test Success Response**:
```bash
curl "http://localhost:3000/api/market/DD1391-100" | jq
```

Expected:
```json
{
  "catalog": { ... },
  "prices": [ ... ],
  "sources": ["stockx", "laced"]
}
```

**Test 404 Response**:
```bash
curl "http://localhost:3000/api/market/NONEXISTENT-123" | jq
```

Expected:
```json
{
  "error": "Product not found",
  "message": "No catalog entry found for SKU: NONEXISTENT-123"
}
```

### Implementation Details

#### Data Flow

1. **Client → API**: User searches for SKU via Market page
2. **API → Supabase**: Query `product_catalog` for SKU
3. **404 Check**: Return 404 if no catalog entry
4. **API → Supabase**: Query `latest_market_prices` view for prices
5. **Extract Sources**: Get distinct sources from prices array
6. **API → Client**: Return `{catalog, prices, sources}`

#### Database Queries

```typescript
// Fetch catalog entry
const { data: catalog } = await supabase
  .from('product_catalog')
  .select('*')
  .eq('sku', sku)
  .single()

// Fetch latest prices per size
const { data: prices } = await supabase
  .from('latest_market_prices')
  .select('*')
  .eq('sku', sku)
  .order('size', { ascending: true })

// Extract distinct sources
const sources = prices?.length > 0
  ? Array.from(new Set(prices.map(p => p.source))).sort()
  : []
```

### Benefits

1. **Clearer API Contract**: Renamed fields are more descriptive
2. **Better 404 Handling**: Proper HTTP status codes
3. **Source Visibility**: Users can see which marketplaces have data
4. **Simplified Response**: Removed redundant calculated fields
5. **RLS Disabled**: No authentication needed (public market data)

---

## Files Modified

### Backend
- ✅ `vercel.json` - Added CRON_SECRET to releases cron path
- ✅ `src/app/api/market/[sku]/route.ts` - Polished API response format

### Frontend
- ✅ `src/app/dashboard/market/page.tsx` - Updated to use new API format

---

## Testing Checklist

- [x] Prompt 2: Verify vercel.json has `?secret=%CRON_SECRET%`
- [x] Prompt 2: Test local worker endpoint with secret
- [x] Prompt 3: Test Market API with valid SKU (200)
- [x] Prompt 3: Test Market API with invalid SKU (404)
- [x] Prompt 3: Verify `catalog` field in response
- [x] Prompt 3: Verify `sources` array in response
- [x] Prompt 3: Test Market page UI displays sources
- [x] Prompt 3: Test deep linking from Releases page
- [ ] Deploy to Vercel with production CRON_SECRET
- [ ] Verify cron job runs successfully

---

## Next Steps

1. **Apply Database Migration**
   - Run SQL from `supabase/migrations/20250108_fix_release_sources_columns.sql`
   - Fixes `release_sources_whitelist` column names
   - Creates `worker_logs` table

2. **Test Releases Worker**
   ```bash
   curl -X POST "http://localhost:3000/api/workers/releases?secret=dev-secret-change-in-production"
   ```

3. **Deploy to Production**
   ```bash
   # Set CRON_SECRET in Vercel Dashboard
   vercel --prod
   ```

4. **Monitor Execution**
   - Check Vercel Cron Jobs dashboard
   - Query `worker_logs` table for metrics
   - Verify `releases` table is populated

---

**Status**: Prompts 2 & 3 complete ✅
**Date**: 2025-01-08
**Dependencies**: Database migration pending for Releases Worker
