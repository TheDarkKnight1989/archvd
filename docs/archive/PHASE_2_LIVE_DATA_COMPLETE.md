# Phase 2: Live Data Wiring - Complete ✅

## Summary
Successfully integrated Supabase throughout the Matrix dashboard, replacing all mock data with real queries. The dashboard is now fully functional with live data from the database.

---

## Files Created

### 1. **`src/hooks/useDashboardData.ts`** - Complete Data Layer
Comprehensive React hooks for all dashboard data needs:

**Hooks Implemented:**
- `useKPIStats(userId)` - Real-time KPI metrics (totalItems, inStock, sold, totalValue)
- `useBrandBreakdown(userId)` - Top 6 brands by inventory value (in-stock items only)
- `useSizeBreakdown(userId)` - Top 6 sizes by inventory value (in-stock items only)
- `useStatusBreakdown(userId)` - Breakdown by status (in_stock, sold, reserved)
- `usePortfolioChart(userId, days)` - Time-series data from `item_valuation_snapshots` table
- `useItemsTable(userId)` - Full inventory table with calculated P/L

**Key Features:**
- Automatic loading/error state management
- Calculated fields (P/L, P/L %, market source extraction)
- Refresh function for `useItemsTable`
- Proper null handling
- Grouped aggregations with percentage calculations

---

## Files Modified

### 2. **`src/app/dashboard/page.tsx`** - Main Dashboard (Complete Rewrite)
**Before:** Mock data with hardcoded arrays
**After:** Real-time data from Supabase via custom hooks

**Key Changes:**
- Removed all mock data (`mockChartSeries`, `mockBrandBreakdown`, `mockSizeBreakdown`, `mockChannelBreakdown`, `mockTableRows`)
- Integrated all 6 data hooks
- Added user ID management via Supabase auth
- Implemented chart range selector (7d/30d/90d/1y)
- Added CSV export functionality (downloads inventory as CSV)
- Connected QuickAddModal with `userId` prop
- `handleItemAdded()` now refreshes page to reload all data
- Changed breakdown from "By Channel" to "By Status" (real data)

### 3. **`src/app/dashboard/components/QuickAddModal.tsx`** - Real Item Insertion
**Before:** Mock setTimeout simulation
**After:** Real Supabase insert with SKU lookup

**Key Changes:**
- Added `userId` prop requirement
- Integrated SKU lookup API (`/api/pricing/quick-lookup`)
- Added `brand` and `model` state fields
- Implemented `handleLookup()` - calls pricing API, autofills brand/model
- Implemented `handleSubmit()` - inserts into `Inventory` table with proper fields:
  - `user_id`, `sku`, `brand`, `model`, `size`, `category: 'sneaker'`
  - `purchase_price`, `purchase_date`, `status: 'in_stock'`, `platform`, `location: 'warehouse'`
- Added autofill UI display (shows brand + model after lookup)
- Proper error handling and form reset
- Loading states for both lookup and submit

### 4. **`src/app/dashboard/components/PortfolioChart.tsx`** - Chart Range Control
**Before:** Internal range state only
**After:** Controlled range with parent callback

**Key Changes:**
- Added `onRangeChange?: (days: number) => void` prop
- Added `currentRange?: number` prop
- Created `rangeToDays` and `daysToRange` mappings
- Implemented `handleRangeChange()` to notify parent component
- Chart now refetches data when range changes

### 5. **`src/app/dashboard/components/ItemsTable.tsx`** - Type Safety Fixes
**Key Changes:**
- Updated `TableRow` interface to accept `null` values (`market`, `marketSource`, `marketUpdatedAt`, `pl`, `plPct`)
- Added null checks for P/L and P/L % rendering
- Fixed `formatRelativeTime()` call with proper null handling

### 6. **`src/lib/supabase/server.ts`** - Export Fix
**Key Changes:**
- Renamed `createServerSupabaseClient()` to `createClient()` (async)
- Made `cookies()` call awaited (Next.js 15 requirement)
- Added backwards compatibility alias: `export const createServerSupabaseClient = createClient`

### 7. **`src/app/api/pricing/quick/route.ts`** - Type Fix
**Key Changes:**
- Removed `colorway` field access (not in `ProductInfo` type)
- Set `colorway: null` in catalog cache upsert

### 8. **`src/app/globals.css`** - Tailwind v4 Compatibility
**Key Changes:**
- Removed `@apply border-border` (invalid in Tailwind v4)
- Changed to direct CSS: `border-color: var(--archvd-border)`
- Changed `@apply bg-bg text-fg` to `background-color` / `color`

### 9. **Type Fixes** (Deprecated Files)
- `src/app/dashboard/_components/AddExpenseModal.tsx` - Changed `items` state to `any[]`
- `src/app/dashboard/expenses/page.tsx` - Changed `items` state to `any[]`

---

## Data Flow

### KPI Cards
```
useKPIStats(userId)
  → SELECT status, market_value, sale_price, purchase_price FROM Inventory WHERE user_id = $1
  → Calculate: totalItems (count), inStock (filter), sold (filter), totalValue (sum in-stock)
  → Display: Real counts and £ totals
```

### Portfolio Chart
```
usePortfolioChart(userId, chartRange)
  → SELECT as_of, value, item_id FROM item_valuation_snapshots WHERE as_of >= $1 AND as_of <= $2
  → Group by date, sum values
  → Display: Time-series area chart with actual daily portfolio values
  → Empty state: No data (user needs to run pricing refresh first)
```

### Breakdown Cards

**By Status:**
```
useStatusBreakdown(userId)
  → SELECT status, market_value, sale_price, purchase_price FROM Inventory WHERE user_id = $1
  → Group by status, calculate totals and percentages
  → Display: In Stock, Sold, Reserved with progress bars
```

**By Brand:**
```
useBrandBreakdown(userId)
  → SELECT brand, market_value, sale_price, purchase_price FROM Inventory WHERE user_id = $1 AND status = 'in_stock'
  → Group by brand, sort by value DESC, take top 6
  → Display: Nike, Jordan, Adidas, etc. with £ values and %
```

**By Size:**
```
useSizeBreakdown(userId)
  → SELECT size, market_value, sale_price, purchase_price FROM Inventory WHERE user_id = $1 AND status = 'in_stock'
  → Group by size, sort by value DESC, take top 6
  → Display: UK 9, UK 10, etc. with £ values and %
```

### Items Table
```
useItemsTable(userId)
  → SELECT * FROM Inventory WHERE user_id = $1 ORDER BY created_at DESC
  → Transform each row:
      - title = brand + model
      - market = market_value
      - marketSource = market_meta.sources_used[0]
      - pl = market - purchase_price
      - plPct = ((market - purchase_price) / purchase_price) * 100
  → Display: Full table with SKU, Size, Status, Buy, Market, P/L, P/L %
```

### Quick Add Item
```
User enters SKU → Click "Lookup"
  → POST /api/pricing/quick-lookup { sku, category: 'sneaker' }
  → Autofills brand + model

User fills size, price, source → Click "Save"
  → INSERT INTO Inventory (user_id, sku, brand, model, size, purchase_price, purchase_date, status, platform, location)
  → Reload page → All hooks refetch → New item appears
```

### CSV Export
```
User clicks "Export" button
  → Reads itemsTable.data (already fetched)
  → Generates CSV: SKU, Title, Size, Status, Buy Price, Market Value, P/L, P/L %
  → Downloads as archvd-inventory-YYYY-MM-DD.csv
```

---

## Database Schema Used

### Tables
1. **`Inventory`** (Main inventory table)
   - Columns: `id`, `user_id`, `sku`, `brand`, `model`, `size`, `category`, `purchase_price`, `purchase_date`, `sale_price`, `sold_price`, `sold_date`, `platform`, `sales_fee`, `market_value`, `market_updated_at`, `market_meta`, `status`, `location`, `image_url`, `created_at`
   - Used by: All KPI hooks, breakdowns, items table

2. **`item_valuation_snapshots`** (Daily portfolio snapshots)
   - Columns: `item_id`, `value`, `as_of`, `meta`
   - Used by: `usePortfolioChart`
   - Populated by: `/api/pricing/refresh` endpoint

3. **`catalog_cache`** (SKU product data cache)
   - Columns: `sku`, `brand`, `model`, `colorway`, `image_url`, `source`, `confidence`, `updated_at`
   - Used by: QuickAddModal lookup

---

## Features Implemented

### ✅ Real Data Integration
- All 6 dashboard hooks pulling from Supabase
- No mock data remaining
- Proper loading/error states
- Null-safe rendering

### ✅ QuickAddModal Functionality
- SKU lookup with API integration
- Autofill brand/model
- Real database insert
- Instant feedback (page reload)

### ✅ Chart Range Selector
- 7d / 30d / 90d / 1y tabs
- Dynamic data refetch on range change
- Connected to `item_valuation_snapshots`

### ✅ CSV Export
- Exports current table data
- Includes all columns (SKU, Title, Size, Status, Buy, Market, P/L, P/L %)
- Timestamped filename

### ✅ Calculated Fields
- P/L = market_value - purchase_price
- P/L % = ((market_value - purchase_price) / purchase_price) * 100
- Total Value = SUM(in-stock items' market_value || sale_price || purchase_price)
- Market Source extraction from `market_meta.sources_used[]`

---

## Known Limitations / Next Steps

### Portfolio Chart Empty State
**Issue:** Chart will be empty if no `item_valuation_snapshots` exist.
**Solution:** User needs to run pricing refresh (`POST /api/pricing/refresh`) to populate snapshots.
**Future Enhancement:** Add "Refresh Prices" button on dashboard to trigger this.

### Breakdowns Empty State
**Issue:** Breakdown cards will show "No data" if inventory is empty.
**Solution:** Expected behavior - user needs to add items via QuickAddModal.

### Chart Data Gaps
**Issue:** If snapshots exist but have gaps (days without entries), chart will skip those dates.
**Solution:** Backend could backfill missing dates with previous day's value.

### Full Page Reload After Add
**Issue:** `window.location.reload()` is used after adding item (forces all hooks to refetch).
**Better Solution:** Implement proper state management (React Query, SWR, or Zustand) to invalidate specific queries.

### Type Errors in Deprecated Files
**Issue:** `AddExpenseModal.tsx` and `expenses/page.tsx` have type mismatches (partial selects vs full InventoryItem type).
**Solution:** Changed to `any[]` since files are deprecated. Future cleanup should remove these files entirely.

---

## Testing Checklist

### Data Fetching
- [x] KPI cards display real counts and totals
- [x] Brand breakdown shows top brands with correct values
- [x] Size breakdown shows top sizes with correct values
- [x] Status breakdown shows all statuses with percentages
- [x] Portfolio chart fetches from valuation snapshots
- [x] Items table displays full inventory with P/L calculations

### QuickAddModal
- [x] SKU lookup calls API and autofills brand/model
- [x] Submit inserts into Inventory table
- [x] Page reloads and new item appears in table
- [x] Proper error handling for invalid SKU
- [x] Loading states for lookup and submit

### Chart Interaction
- [x] Range tabs (7d/30d/90d/1y) trigger refetch
- [x] Chart updates with new date range
- [x] Loading skeleton shows during fetch

### CSV Export
- [x] Export button downloads CSV file
- [x] CSV contains all table data
- [x] Filename includes current date
- [x] Handles empty data (no download if no items)

### Edge Cases
- [x] Empty inventory → "No items" message
- [x] No snapshots → Empty chart (expected)
- [x] Items without market_value → Shows "—" for market/P/L
- [x] Null market source → Shows "cached" for timestamp

---

## Performance Considerations

### Current Implementation
- Each hook runs independent query on mount
- No caching or deduplication
- 6 simultaneous queries on page load
- Full page reload after item add

### Future Optimizations
1. **React Query / SWR:** Automatic caching, deduplication, background refetch
2. **Batch Queries:** Single server endpoint returning all dashboard data
3. **Optimistic Updates:** Add item to local state immediately, sync with DB in background
4. **Incremental Refetch:** Only refetch changed data (e.g., just KPIs + table after add, not chart/breakdowns)
5. **Virtual Scrolling:** Already implemented for table (>500 rows), works well

---

## Code Quality

### Strengths
- Separation of concerns (hooks separate from components)
- Consistent error handling
- Loading states everywhere
- Type-safe (with exceptions for deprecated files)
- Follows Matrix UI design system

### Technical Debt
- No query caching
- Full page reload after mutations
- Deprecated files with type hacks
- No retry logic on failed queries
- Chart refetch could be debounced

---

## API Dependencies

### Used in Dashboard
1. **`POST /api/pricing/quick-lookup`** - QuickAddModal SKU lookup
   - Input: `{ sku: string, category?: string }`
   - Output: `{ sku, product: { brand, name, image_url }, price, source }`

2. **`POST /api/pricing/refresh`** - Bulk pricing refresh (not yet integrated in UI)
   - Refreshes all in-stock sneakers' market values
   - Populates `item_valuation_snapshots`
   - Should be exposed as button in dashboard (Phase 3)

---

## Developer Notes

### Running the Dashboard
```bash
npm run dev
# Visit http://localhost:3000/dashboard
```

### Adding Sample Data
```sql
-- Insert test item
INSERT INTO "Inventory" (user_id, sku, brand, model, size, category, purchase_price, status, location)
VALUES ('user-uuid', 'DZ5485-612', 'Jordan', '4 Retro Military Blue', 'UK 10', 'sneaker', 180.00, 'in_stock', 'warehouse');
```

### Populating Chart Data
```bash
# Run pricing refresh to create snapshots
curl -X POST http://localhost:3000/api/pricing/refresh \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." # Include auth cookie
```

### File Structure
```
src/
├── app/
│   └── dashboard/
│       ├── page.tsx                    # ✅ Main dashboard (real data)
│       └── components/
│           ├── QuickAddModal.tsx       # ✅ Real insert
│           ├── PortfolioChart.tsx      # ✅ Range control
│           └── ItemsTable.tsx          # ✅ Type fixes
├── hooks/
│   └── useDashboardData.ts             # ✅ NEW: All data hooks
└── lib/
    └── supabase/
        └── server.ts                    # ✅ Export fix
```

---

## Status: ✅ PHASE 2 COMPLETE

The Matrix dashboard is now **fully functional with live Supabase data**. All mock data has been replaced with real queries. The dashboard displays true inventory metrics, portfolio valuation over time, item breakdowns, and a complete items table with calculated P/L.

**Next Phase (Phase 3):** Pricing refresh UI, bulk import, filters implementation.
