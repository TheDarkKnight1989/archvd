# Phase 3.11: Implementation Status

## Completed

### 1. Database Migration ✅
**File**: [supabase/migrations/20251120_add_mapping_status_to_inventory_market_links.sql](../supabase/migrations/20251120_add_mapping_status_to_inventory_market_links.sql)

Added the following columns to `inventory_market_links`:
- `mapping_status` (TEXT, CHECK constraint: 'ok' | 'stockx_404' | 'invalid' | 'unmapped')
- `last_sync_success_at` (TIMESTAMPTZ)
- `last_sync_error` (TEXT)

**To Apply**:
```bash
# Apply via Supabase CLI or run the SQL directly in your database
```

### 2. Mark Chicago Invalid Script ✅
**File**: [scripts/mark-chicago-invalid.mjs](../scripts/mark-chicago-invalid.mjs)

Script to mark the two Chicago Low items as invalid:
- Sets `mapping_status = 'stockx_404'` for both UK 9 and UK 11
- Deletes stale snapshots from `stockx_market_snapshots`
- Refreshes the `stockx_market_latest` materialized view

**Usage**:
```bash
npx tsx scripts/mark-chicago-invalid.mjs
```

### 3. Worker 404 Detection ✅
**File**: [src/lib/providers/stockx-worker.ts](../src/lib/providers/stockx-worker.ts:579-678)

Updated `syncSingleInventoryItemFromStockx` function to:
- **Detect 404 errors** from StockX market API calls (lines 588-629)
- **Update mapping_status** to 'stockx_404' when 404 detected (lines 600-607)
- **Update mapping_status** to 'ok' on successful API calls (lines 656-665)
- **Return explicit error** message for 404s instead of throwing

## In Progress

### 4. Portfolio UI Updates (NEXT STEPS)

The UI needs to be updated to:
1. **Fetch `mapping_status`** from `inventory_market_links` table
2. **Check mapping status** before displaying prices
3. **Display warning** instead of price when status is invalid

#### Files That Need Updates:

##### A. Data Fetching Hooks

Update these hooks to include `mapping_status` in their queries:

**File**: `src/hooks/useInventoryV3.ts`
- Add `mapping_status` to the SELECT statement when querying `inventory_market_links`
- Include it in the returned enriched inventory data

**File**: `src/hooks/usePortfolioInventory.ts`
- Add `mapping_status` to the SELECT statement when querying `inventory_market_links`
- Include it in the returned portfolio data

**Example Query Update**:
```typescript
// BEFORE:
const { data: links } = await supabase
  .from('inventory_market_links')
  .select('stockx_product_id, stockx_variant_id')
  .eq('item_id', item.id)

// AFTER:
const { data: links } = await supabase
  .from('inventory_market_links')
  .select('stockx_product_id, stockx_variant_id, mapping_status, last_sync_error')
  .eq('item_id', item.id)
```

##### B. Type Definitions

Update type definitions to include mapping status:

**File**: `src/hooks/useInventory.ts` (InventoryItem type)
```typescript
export type InventoryItem = {
  // ... existing fields
  stockx_mapping_status?: 'ok' | 'stockx_404' | 'invalid' | 'unmapped' | null
  stockx_mapping_error?: string | null
  // ... existing fields
}
```

##### C. Price Display Logic

Update price rendering in table components:

**File**: `src/app/portfolio/inventory/_components/InventoryTable.tsx`

Add logic to check mapping status before displaying price:

```typescript
// PHASE 3.11: Check mapping status before showing price
const isInvalidMapping = item.stockx_mapping_status === 'stockx_404' ||
                         item.stockx_mapping_status === 'invalid'

if (isInvalidMapping) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">–</span>
      <Badge variant="warning" className="text-xs">
        ⚠ Mapping broken
      </Badge>
    </div>
  )
}

// Otherwise show price as normal
return formatCurrency(item.market_value, item.market_currency)
```

**Similar updates needed in:**
- `src/app/portfolio/components/ItemsTable.tsx`
- `src/app/portfolio/pnl/page.tsx` (if showing prices)
- `src/app/portfolio/sales/_components/SalesTable.tsx` (if showing prices)

##### D. Portfolio Totals

Update portfolio overview to handle invalid mappings:

**File**: `src/app/portfolio/components/PortfolioOverview.tsx`

Options:
1. **Exclude invalid items** from total value calculation
2. **Show warning** that X items have invalid mappings
3. **Provide link** to remap script documentation

```typescript
// Example:
const validItems = items.filter(item =>
  item.stockx_mapping_status === 'ok' || !item.stockx_mapping_status
)

const invalidCount = items.length - validItems.length

if (invalidCount > 0) {
  // Show warning badge or message
}
```

## Testing

### End-to-End Test Steps

1. **Apply migration**:
   ```bash
   # Run migration SQL in Supabase dashboard or via CLI
   ```

2. **Mark Chicago items as invalid**:
   ```bash
   npx tsx scripts/mark-chicago-invalid.mjs
   ```

3. **Verify in Portfolio UI**:
   - Navigate to http://localhost:3000/portfolio
   - Find HQ6998-600 UK 9 and UK 11
   - Should see "–" with "⚠ Mapping broken" badge instead of price
   - Should NOT see numeric price values

4. **Verify worker behavior**:
   - Try syncing the Chicago items
   - Worker should detect 404 and set mapping_status
   - Check database to confirm status is 'stockx_404'

5. **Verify fix workflow**:
   - Run `node scripts/remap-stockx-product.mjs HQ6998-600` (when API is fixed)
   - Select correct product
   - Mapping status should reset to 'ok'
   - Prices should appear in UI again

## Acceptance Criteria

- [x] Migration created and documented
- [x] Mark-Chicago script created and tested
- [x] Worker detects 404s and updates mapping_status
- [ ] UI fetches mapping_status from database
- [ ] UI shows warning instead of price for invalid mappings
- [ ] Portfolio totals exclude or warn about invalid items
- [ ] End-to-end test passes: Chicago items show warning, not price

## Files Modified

### Created:
1. `supabase/migrations/20251120_add_mapping_status_to_inventory_market_links.sql`
2. `scripts/mark-chicago-invalid.mjs`
3. `docs/PHASE_3.11_IMPLEMENTATION_STATUS.md` (this file)

### Modified:
1. `src/lib/providers/stockx-worker.ts` (lines 579-678)

### To Modify (UI Updates):
1. `src/hooks/useInventoryV3.ts` - Add mapping_status to query
2. `src/hooks/usePortfolioInventory.ts` - Add mapping_status to query
3. `src/hooks/useInventory.ts` - Add type fields
4. `src/app/portfolio/inventory/_components/InventoryTable.tsx` - Display warning
5. `src/app/portfolio/components/PortfolioOverview.tsx` - Handle invalid items
6. Other table components as needed

## Next Actions

**For Developer**:
1. Review this implementation plan
2. Apply the database migration
3. Update the UI hooks to fetch mapping_status
4. Update the UI components to check mapping_status before showing prices
5. Test end-to-end with mark-chicago-invalid script
6. Verify UI shows warnings instead of fake prices

**For User**:
1. Once UI is updated, run: `npx tsx scripts/mark-chicago-invalid.mjs`
2. Refresh Portfolio page (hard refresh: Cmd+Shift+R)
3. Verify Chicago Low items show warning instead of price
4. When ready to fix mapping, run: `node scripts/remap-stockx-product.mjs HQ6998-600`
