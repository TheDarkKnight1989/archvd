# V4 Market Page - Implementation Plan

## Problem Statement

The current market page (`/portfolio/market/[slug]`) is V3-era code that:
1. Requires products to exist in legacy tables (`alias_catalog_items`, `product_catalog`, `stockx_products`)
2. Has "stabilisation mode" that returns 404 for unknown products
3. Doesn't integrate with the V4 unified search system
4. When clicking external search results (StockX/Alias source), users get 404

## Solution

Build a new V4 market page that:
1. Uses **only** V4 tables (`inventory_v4_style_catalog`, `inventory_v4_*_market_data`)
2. Auto-creates style catalog entries for new SKUs (from search `externalIds`)
3. Triggers sync and shows "syncing" state while data loads
4. Displays unified market data with region/currency controls

## Architecture

```
Search Result → Navigate → Market Page → Resolve API → Show Data
                              ↓
                    If new SKU: Create style + enqueue sync
                              ↓
                    Poll sync status → Show unified market data
```

## Implementation Steps

### Step 1: Create Style Resolve API
**File**: `src/app/api/v4/style/resolve/route.ts`

```typescript
// POST /api/v4/style/resolve
// Body: { styleId, externalIds?, name?, brand?, colorway?, imageUrl? }
// Uses resolveOrCreateStyleV4() from resolve.ts
// Returns: { style, wasCreated, syncJobs }
```

### Step 2: Create V4 Market Page
**File**: `src/app/portfolio/market-v4/[slug]/page.tsx`

Key features:
- Parse SKU from slug using existing `parseSkuFromSlug()`
- Server component that fetches initial style data
- If style not found: show "Loading product..." state (client will resolve)
- If style found: render product hero + market data

### Step 3: Create Client Market Content Component
**File**: `src/app/portfolio/market-v4/[slug]/_components/MarketPageContent.tsx`

Client component that:
1. If style missing: calls resolve API with search result data from URL params
2. Shows sync status while data loads
3. Uses `useUnifiedMarketData` hook for market data
4. Renders:
   - Product hero (image, name, SKU, colorway)
   - Size run table with StockX + Alias prices
   - Region toggle (UK/EU/US)
   - Currency display toggle (Native/GBP/USD)

### Step 4: Update Search to Pass External IDs
**File**: `src/components/AppTopBar.tsx` + `SearchCommandModal.tsx`

Update `handleSelect` to:
1. Check `result.inDatabase`
2. If false: pass `externalIds` as URL search params
3. Navigate to: `/portfolio/market-v4/{slug}?aliasId=...&stockxId=...&name=...&brand=...`

### Step 5: Hook Up Sync Status Polling
**File**: `src/hooks/useSyncStatusV4.ts` (may exist, extend if needed)

Poll `inventory_v4_sync_queue` for the style_id to show:
- "Syncing StockX data..."
- "Syncing Alias data..."
- "Ready" when both complete

## V4 Tables Used

| Table | Purpose |
|-------|---------|
| `inventory_v4_style_catalog` | Product registry (SKU, name, external IDs) |
| `inventory_v4_stockx_products` | StockX product metadata |
| `inventory_v4_stockx_variants` | StockX size variants |
| `inventory_v4_stockx_market_data` | StockX prices per variant |
| `inventory_v4_alias_products` | Alias product metadata |
| `inventory_v4_alias_variants` | Alias size variants |
| `inventory_v4_alias_market_data` | Alias prices per variant |
| `inventory_v4_sync_queue` | Sync job tracking |

## Key Components Reused

- `UnifiedMarketSection` - Can refactor into the main market content
- `useUnifiedMarketData` - Hook for fetching V4 market data
- `useCurrency` - FX conversion for price comparison
- `resolveOrCreateStyleV4` - Style resolution logic
- `generateProductSlug` / `parseSkuFromSlug` - URL handling

## URL Structure

**Market page URL**: `/portfolio/market-v4/{slug}`
- slug format: `brand-name-sku` (e.g., `nike-dunk-low-panda-DD1391-100`)

**With create params** (for new products):
```
/portfolio/market-v4/nike-dunk-low-DD1391-100?
  aliasId=nike-dunk-low-retro-black-dd1391-100&
  stockxId=abc123&
  name=Nike+Dunk+Low+Retro&
  brand=Nike&
  imageUrl=https://image.goat.com/...
```

## UI Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│ ← Back to Inventory              [Sync Status Badge]        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐   Nike Dunk Low Retro                        │
│  │          │   DD1391-100                                  │
│  │  [Image] │   Black/White                                 │
│  │          │                                               │
│  └──────────┘   Retail: £100                               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Region: [UK] [EU] [US]    Currency: [Native] [GBP] [USD]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Size │ StockX Ask │ StockX Bid │ Alias Ask │ Alias Bid    │
│  ─────┼────────────┼────────────┼───────────┼──────────    │
│  8    │ £95        │ £85        │ $110      │ $100         │
│  8.5  │ £98        │ £88        │ $115      │ $105         │
│  9    │ £100       │ £90        │ $120      │ $108         │
│  ...                                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Migration Path

1. Build as `/portfolio/market-v4/[slug]` (parallel to existing)
2. Update search to navigate to V4 page
3. Test thoroughly
4. Eventually redirect old `/portfolio/market/[slug]` to V4 version
5. Delete V3 market page code

## Files to Create/Modify

### New Files
- `src/app/api/v4/style/resolve/route.ts` - Resolve/create style API
- `src/app/portfolio/market-v4/[slug]/page.tsx` - V4 market page
- `src/app/portfolio/market-v4/[slug]/_components/MarketPageContent.tsx` - Client content
- `src/app/portfolio/market-v4/[slug]/_components/ProductHero.tsx` - Hero section
- `src/app/portfolio/market-v4/[slug]/_components/SizeRunTable.tsx` - Price table

### Modified Files
- `src/components/AppTopBar.tsx` - Pass externalIds on navigate
- `src/components/SearchCommandModal.tsx` - Same change for mobile

## Out of Scope (Phase 2)
- Add to inventory from market page
- List on StockX/Alias actions
- Price alerts/watchlist
- Historical price charts
