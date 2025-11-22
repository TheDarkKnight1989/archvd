# StockX Image Hydration - Complete Implementation

## Summary

Implemented a complete, automated solution for StockX product image hydration with:
1. **Proper API route** for one-time backfill of existing items
2. **UI button** in Settings for easy access (no console hacks required)
3. **Automatic hydration** for all future items via price sync
4. **Zero manual intervention** required after initial backfill

---

## Routes

### 1. Backfill Catalog (One-Time)
**Endpoint:** `POST /api/stockx/backfill/catalog`

**Purpose:** Fetch missing product images and metadata for existing StockX-mapped items

**Authentication:** Required (authenticated user session)

**How to Trigger:**
1. Log into app at http://localhost:3000
2. Navigate to **Settings** (from nav menu)
3. Click **Cache** tab
4. Click **"Hydrate Catalog"** button

**What It Does:**
1. Finds all `inventory_market_links` for your items
2. Checks which `stockx_products` are missing
3. Fetches product data from StockX API (including `image_url`, `thumb_url`)
4. Saves to `stockx_products` and `stockx_variants` tables
5. Returns summary: `{ links, distinctProducts, productsBefore, productsAfter, hydratedProducts, errors }`

**Response Example:**
```json
{
  "success": true,
  "links": 4,
  "distinctProducts": 4,
  "productsBefore": 0,
  "productsAfter": 4,
  "hydratedProducts": 4,
  "errors": 0,
  "duration_ms": 2543,
  "timestamp": "2025-11-18T10:30:00.000Z"
}
```

---

### 2. Price Sync (Automatic Hydration)
**Endpoint:** `POST /api/stockx/sync/prices`

**Purpose:** Sync latest market prices **AND** auto-hydrate missing product catalog data

**Authentication:** Required

**Automatic Behavior:**
- When syncing prices, if `stockx_products` doesn't exist for a product ID:
  1. Automatically calls `upsertStockxCatalogFromApi()`
  2. Fetches product data including images from StockX API
  3. Saves catalog data to DB
  4. Then proceeds with price sync

**Location in Code:** [/src/lib/services/stockx/market.ts:459-487](../src/lib/services/stockx/market.ts#L459-L487)

**Future-Proof:** All new StockX mappings automatically get images when prices sync

---

## Image Resolution Order in Portfolio

The Portfolio displays images using this fallback chain:

1. **Local upload** (`Inventory.image_url`) - if user uploaded custom image
2. **StockX catalog** (`stockx_products.image_url`) - from API hydration
3. **Placeholder** - generic sneaker icon if neither available

**Code Location:** Wherever Portfolio renders item images (typically in InventoryTable)

---

## Proof of Automatic Hydration

### Test Case: Mars Yard (AA2261-100)

**Before Backfill:**
```sql
SELECT image_url, thumb_url FROM stockx_products WHERE style_id = 'AA2261-100';
-- Result: (no rows) or (null, null)
```

**After Running:**
1. `/api/stockx/backfill/catalog` - hydrates existing mapped items
2. `/api/stockx/sync/prices` - updates prices + auto-hydrates any missed

**After Backfill:**
```sql
SELECT style_id, title, image_url, thumb_url
FROM stockx_products
WHERE style_id = 'AA2261-100';
```

**Expected Result:**
```
style_id    | AA2261-100
title       | Nike Mars Yard 2.0
image_url   | https://images.stockx.com/images/Nike-Mars-Yard-2-Product.jpg?...
thumb_url   | https://images.stockx.com/images/Nike-Mars-Yard-2-Product.jpg?...
```

---

## Verification Steps

### 1. Run Initial Backfill
1. Open http://localhost:3000
2. Log in
3. Go to **Settings** > **Cache**
4. Click **"Hydrate Catalog"**
5. Wait for success message (e.g., "✅ Hydrated 4 products")

### 2. Verify Database
```sql
-- Check that products now have images
SELECT
  style_id,
  title,
  CASE
    WHEN image_url IS NOT NULL THEN '✅ Has image'
    ELSE '❌ Missing'
  END as image_status,
  CASE
    WHEN thumb_url IS NOT NULL THEN '✅ Has thumb'
    ELSE '❌ Missing'
  END as thumb_status
FROM stockx_products
ORDER BY created_at DESC
LIMIT 10;
```

### 3. Check Portfolio UI
1. Navigate to **Portfolio** > **Inventory**
2. Look for StockX-mapped items
3. Verify product images now display (not placeholder)
4. Images should be actual sneaker photos from StockX

---

## Troubleshooting

### Images Still Not Showing

**Problem:** Backfill succeeded but images don't display in Portfolio

**Check:**
1. **Browser cache:** Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
2. **Database:** Verify `stockx_products.image_url` is not null
3. **RLS policies:** Ensure user can read `stockx_products` table
4. **Image URLs:** Copy an `image_url` from DB and paste in browser - should load image

### Backfill Reports 0 Links

**Problem:** "✅ Hydrated 0 products (0 mappings)"

**Cause:** No `inventory_market_links` exist for your items

**Solution:**
1. Ensure items have StockX mappings created
2. Check `inventory_market_links` table has rows for your `user_id`
3. Verify RLS policy on `inventory_market_links` allows user access

### 401 Unauthorized

**Problem:** API returns 401 when calling backfill

**Cause:** Not logged in or session expired

**Solution:**
1. Log out and log back in
2. Try again from authenticated session (Settings page)
3. Do NOT call API from scripts/curl without auth token

---

## Future Items (Zero Manual Work)

Once initial backfill is complete, **all future items** automatically get images:

1. User adds item to inventory
2. Creates StockX mapping via Quick Add or manual flow
3. Price sync runs (manually or via cron)
4. **Automatic:** Price sync detects missing `stockx_products` entry
5. **Automatic:** Calls `upsertStockxCatalogFromApi()` to fetch catalog data
6. **Automatic:** Images saved to DB
7. Portfolio displays images immediately

**No additional backfills or console commands needed!**

---

## File Changes Made

### API Routes
- ✅ [/src/app/api/stockx/backfill/catalog/route.ts](../src/app/api/stockx/backfill/catalog/route.ts) - Fixed RLS bug (lines 34-47)

### UI Components
- ✅ [/src/app/settings/page.tsx](../src/app/settings/page.tsx) - Added hydration button in Cache tab
  - State variables (lines 90-91)
  - Handler function (lines 156-179)
  - UI section (lines 444-463)

### Existing Automatic Hydration
- ✅ [/src/lib/services/stockx/market.ts](../src/lib/services/stockx/market.ts#L459-L487) - Already implements auto-hydration during price sync

---

## Summary for User

**One-Time Setup (Existing Items):**
1. Log into app
2. Settings > Cache > "Hydrate Catalog"
3. Wait ~5-10 seconds for 4 products
4. Done! Images now display in Portfolio

**Future Items (Automatic):**
- Add item → Create StockX mapping → Run price sync → Images appear
- **Zero additional manual work required**

**Routes to Remember:**
- Backfill: `POST /api/stockx/backfill/catalog` (via Settings UI button)
- Price Sync: `POST /api/stockx/sync/prices` (auto-hydrates missing products)

**Image Resolution:**
1. Local upload (`Inventory.image_url`)
2. StockX catalog (`stockx_products.image_url`)
3. Placeholder icon
