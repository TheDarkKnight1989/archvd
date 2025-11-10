# Phase 3: Day-to-Day Operations - IN PROGRESS

## Goal
Make the dashboard operational for day-to-day use with pricing updates, bulk import, and table filters/sorting.

---

## ✅ COMPLETED: Pricing Refresh (1/3)

### Files Created/Modified

1. **`src/app/api/pricing/refresh/route.ts`** - Enhanced
   - Now fetches items with status `in_stock` or `worn` (not just sneakers)
   - Creates portfolio snapshot after refresh (stores in `portfolio_snapshots` table)
   - Returns `portfolioValue` in response for toast display

2. **`src/components/ui/toast.tsx`** - NEW
   - Toast notification component with variants (default, success, error, warning)
   - Auto-dismisses after 5 seconds
   - Matrix-styled with proper animations

3. **`src/app/dashboard/components/ToolbarFilters.tsx`** - Enhanced
   - Added "Refresh Pricing" button with spinner animation
   - Button disables during refresh
   - Shows "Refreshing..." text while running

4. **`src/app/dashboard/page.tsx`** - Enhanced
   - Added `isRefreshing` state
   - Added `toast` state for notifications
   - Implemented `handleRefreshPricing()` function:
     - Calls `/api/pricing/refresh`
     - Shows success toast with summary
     - Reloads page after 2 seconds to refresh all data
     - Handles errors gracefully

5. **`vercel.json`** - NEW
   - Configured cron job to run at 02:00 Europe/London (0 2 * * *)
   - Calls `/api/pricing/refresh` endpoint
   - NOTE: For multi-user support, endpoint needs CRON_SECRET auth bypass

### How It Works

**Manual Refresh:**
1. User clicks "Refresh Pricing" button
2. Button shows spinner, disables itself
3. API fetches all in-stock/worn items for current user
4. For each item with SKU:
   - Calls `fullLookup()` from pricing service
   - Updates `market_value` and `market_updated_at`
   - Creates item snapshot in `item_valuation_snapshots`
5. Calculates total portfolio value
6. Creates daily snapshot in `portfolio_snapshots` table
7. Returns summary to frontend
8. Toast shows: "Updated X of Y items • Portfolio: £Z"
9. Page reloads after 2 seconds

**Nightly Cron:**
- Configured in `vercel.json`
- Runs at 02:00 Europe/London
- Currently only works for authenticated users (needs enhancement for all users)

### Testing

```bash
# Manual test
1. Visit /dashboard
2. Click "Refresh Pricing" button
3. Should see spinner and "Refreshing..." text
4. After completion: Toast shows summary
5. Page reloads, KPIs/chart reflect new values

# Cron test (requires Vercel deployment)
1. Deploy to Vercel
2. Check Vercel Cron logs at 02:00 Europe/London
3. Verify items updated in database
```

### Known Limitations

1. **Cron Multi-User Support**: Current endpoint requires user auth, so cron can't refresh all users
   - **Fix needed**: Add CRON_SECRET bypass in endpoint to process all users

2. **Rate Limiting**: Processes items sequentially with 2s delay (slow for large inventories)
   - Current: ~30 items/minute
   - **Enhancement**: Parallel processing with provider rate limits

3. **Portfolio Snapshots Table**: Assumes `portfolio_snapshots` table exists
   - **Schema needed**:
     ```sql
     CREATE TABLE portfolio_snapshots (
       user_id UUID REFERENCES auth.users NOT NULL,
       as_of DATE NOT NULL,
       total_value DECIMAL NOT NULL,
       item_count INTEGER NOT NULL,
       created_at TIMESTAMPTZ DEFAULT NOW(),
       PRIMARY KEY (user_id, as_of)
     );
     ```

---

## 🚧 IN PROGRESS: Bulk Import (2/3)

### Requirements
- Upload CSV/XLSX files
- Header mapping UI (flexible column names)
- Preview first 50 rows with validation
- Batch insert (200 rows at a time)
- Assign `import_batch_id` to all rows
- Undo import by batch ID
- Per-row error display

### Files To Create
- `src/app/dashboard/components/BulkImportModal.tsx`
- `src/lib/import/parse.ts` (papaparse/xlsx helpers)
- `src/lib/import/headerMap.ts` (column mapping logic)
- `src/lib/import/validate.ts` (row validation)

### Supported Headers
- `sku`, `brand`, `model`, `size_uk`, `purchase_price`, `purchase_date`
- `condition`, `status`, `location`

### Status
- ⏳ Not started (next priority)

---

## 📋 TODO: Table Filters + Sorting (3/3)

### Requirements
- **Filters**: Status (multi), Brand (multi), Size (multi), Text search (SKU/model)
- **Sorting**: By `created_at`, `market_value`, `pl`, `plPct`
- **URL Persistence**: `?status=in_stock,sold&sort=plPct:desc`
- **Server-Side**: Apply filters in Supabase query

### Files To Modify
- `src/hooks/useDashboardData.ts` - Update `useItemsTable` to accept filters/sort params
- `src/app/dashboard/components/ToolbarFilters.tsx` - Make filter buttons functional
- `src/app/dashboard/page.tsx` - Read/write URL query params

### Status
- ⏳ Not started

---

## Database Schema Updates Needed

### 1. Portfolio Snapshots Table
```sql
CREATE TABLE portfolio_snapshots (
  user_id UUID REFERENCES auth.users NOT NULL,
  as_of DATE NOT NULL,
  total_value DECIMAL NOT NULL,
  item_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, as_of)
);

-- Enable RLS
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Users can view own snapshots"
  ON portfolio_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own snapshots"
  ON portfolio_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own snapshots"
  ON portfolio_snapshots FOR UPDATE
  USING (auth.uid() = user_id);
```

### 2. Add import_batch_id to Inventory
```sql
ALTER TABLE "Inventory"
ADD COLUMN import_batch_id UUID;

CREATE INDEX idx_inventory_import_batch ON "Inventory"(import_batch_id);
```

---

## Environment Variables Needed

### For Cron (Optional)
```env
CRON_SECRET=your-random-secret-here
```

Add to Vercel project settings:
```bash
vercel env add CRON_SECRET
```

---

## Next Steps

1. **Create Bulk Import Modal** (highest priority)
   - Install dependencies: `npm install papaparse xlsx`
   - Build header mapping UI
   - Implement preview with validation
   - Add batch insert logic
   - Implement undo functionality

2. **Implement Table Filters**
   - Update `useItemsTable` hook
   - Make filter buttons functional
   - Add URL param persistence
   - Test deep linking

3. **Database Migrations**
   - Run portfolio_snapshots schema
   - Add import_batch_id column
   - Test RLS policies

4. **Cron Enhancement** (optional)
   - Add CRON_SECRET bypass
   - Process all users in endpoint
   - Add error notifications

---

## Testing Checklist

### Pricing Refresh
- [x] Button appears in toolbar
- [x] Button disables during refresh
- [x] Spinner animation works
- [x] Toast shows on success
- [x] Toast shows on error
- [x] Page reloads after success
- [ ] Cron runs at 02:00 Europe/London (requires deployment)
- [ ] Portfolio snapshots created in DB

### Bulk Import (TODO)
- [ ] CSV upload works
- [ ] XLSX upload works
- [ ] Header mapping UI functional
- [ ] Preview shows first 50 rows
- [ ] Per-row validation errors display
- [ ] Batch insert completes without freezing
- [ ] import_batch_id assigned to all rows
- [ ] Undo removes only target batch
- [ ] RLS enforced (can't delete other users' batches)

### Table Filters (TODO)
- [ ] Status filter works (multi-select)
- [ ] Brand filter works (multi-select)
- [ ] Size filter works (multi-select)
- [ ] Text search filters SKU/model
- [ ] Sorting by created_at works
- [ ] Sorting by market_value works
- [ ] Sorting by P/L works
- [ ] Sorting by P/L % works
- [ ] URL params persist filters
- [ ] Deep link restores filter state
- [ ] Filters combine correctly (AND logic)

---

## Performance Targets

- **Bulk Import**: ≥500 rows without UI freeze
- **Table Filters**: <100ms query time with 1000+ items
- **Pricing Refresh**: Complete within 5 minutes for 100 items

---

## Deliverables Status

- ✅ Pricing refresh button functional
- ✅ Toast notifications working
- ✅ Vercel cron configured
- ⏳ Bulk import modal (0%)
- ⏳ Table filters (0%)
- ⏳ URL persistence (0%)

**Overall Progress: ~33% complete (1/3 features done)**
