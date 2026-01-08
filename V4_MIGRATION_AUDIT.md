# V4 Inventory Migration Audit

**Generated:** 2024-12-13
**Updated:** 2024-12-14
**Status:** Phase 3 Complete (V4 Native Page Actions)

---

## Ground Rules

1. **DO NOT** touch RowActions visibility logic — already correct
2. `inventory_v4_listings` is the source of truth for listing state
3. V3 fallbacks allowed only where V3 data is explicitly still used
4. No duplicate logic, no parallel systems

---

## Phase 1 Completed (Adapter Strategy)

The main inventory page now uses V4 data via an adapter that converts to V3 types.
This provides V4 data truth while maintaining backwards compatibility with existing components.

**Key Changes:**
- `inventory/page.tsx` → Uses `useInventoryV4` + `adaptV4ItemsToEnrichedLineItems()`
- `InventoryV3Table.tsx` → Passes `_v4StockxListing` to RowActions
- `RowActions.tsx` → Accepts `stockxListing` prop (V4 source of truth)
- `EnrichedLineItem` type → Added V4 transition fields (`_v4StockxListing`, etc.)
- `useInventoryV3.ts` → Marked as deprecated

---

## Phase 3 Completed (V4 Native Page Actions)

The `/portfolio/inventory-v4/` page now has full action menu support via the shared `RowActions` component.

**Key Changes:**
- `InventoryV4Table.tsx` → Uses shared `RowActions` component (not minimal ActionsCell)
- `inventory-v4/page.tsx` → Added modal states, action handlers for all listing operations
- `ListOnStockXModal` + `RepriceListingModal` → Properly wired with V4 item type conversion
- Action handlers for: List, Reprice, Deactivate, Reactivate, Delete

**Item → Modal Conversion:**
```typescript
const selectedItemForModal = {
  id: selectedItem.id,
  sku: selectedItem.style_id,
  invested: selectedItem.purchase_price ?? undefined,
  stockx: {
    mapped: !!selectedItem.style.stockx_product_id,
    productId: selectedItem.style.stockx_product_id ?? undefined,
    variantId: undefined,
    listingId: stockxListing?.external_listing_id ?? undefined,
    listingStatus: stockxListing?.status === 'active' ? 'ACTIVE' : 'INACTIVE',
  },
  _v4StockxListing: stockxListing,
}
```

---

## Audit Checklist

### A. NEEDS FULL V4 MIGRATION

| File / Component | Current | Used For | Action | Status |
|------------------|---------|----------|--------|--------|
| `src/app/portfolio/inventory/page.tsx` | V4 via adapter | Main inventory page | Switch to `useInventoryV4` | **done** (Phase 1) |
| `src/hooks/useInventoryV3.ts` | V3 | Primary data hook | Deprecate after migration | **done** (deprecated) |
| `src/app/portfolio/inventory/_components/InventoryV3Table.tsx` | V3 types + V4 listing | Desktop table | Switch to V4 types | partial (V4 listing wired)
| `src/app/portfolio/inventory/_components/InventoryTableV3.tsx` | V3 (`EnrichedLineItem`) | Alternate table | Switch to V4 types | pending |
| `src/app/portfolio/inventory/_components/mobile/MobileInventoryItemCard.tsx` | V4 via `_v4StockxListing` | Mobile item card | Uses V4 listing for status | **done** |
| `src/app/portfolio/inventory/_components/mobile/MobileInventoryList.tsx` | V3 (`EnrichedLineItem`) | Mobile list | Switch to V4 types | pending |
| `src/app/portfolio/inventory/_components/cells/ItemCell.tsx` | V3 (`EnrichedLineItem`) | Table cell | No listing status usage | N/A |
| `src/components/stockx/BulkListOnStockXModal.tsx` | V4 via helper | Bulk listing modal | Uses `hasActiveStockxListing()` | **done** |
| `src/components/stockx/ListOnStockXModal.tsx` | V4 + V3 fallback | Listing modal | Uses `_v4StockxListing` in adapter | **done** |
| `src/app/portfolio/inventory/_components/AliasLinkModal.tsx` | V3 (`EnrichedLineItem`) | Alias linking | Switch to V4 types | pending |
| `src/lib/portfolio/types.ts` | V3 (`EnrichedLineItem`) | Type definitions | Keep for V3 compat, deprecation note exists | **done** |
| `src/app/portfolio/inventory-tracker/page.tsx` | V3 (`useInventoryV3`) | Tracker page | Switch to V4 or deprecate | pending |

---

### B. READ-ONLY CONSUMERS (SAFE TO MIGRATE)

| File / Component | Current | Used For | Action | Status |
|------------------|---------|----------|--------|--------|
| `src/app/portfolio/sales/page.tsx` | V3 (`useSalesTable`) | Sales page | Check if depends on listing state | pending |
| `src/hooks/useSalesTable.ts` | V3 (`Inventory` table) | Sales data | Update to read `sold` status from V4 | pending |
| `src/app/portfolio/analytics/page.tsx` | V3 (`useAnalytics`) | Analytics | Update hook to use V4 data | pending |
| `src/hooks/useAnalytics.ts` | V3 (`Inventory` table) | Analytics data | Update to query V4 tables | pending |
| `src/hooks/useDashboardData.ts` | V3 (`inventory_market_links`) | Dashboard | Update to V4 source | pending |
| `src/hooks/usePortfolioInventory.ts` | V3 (`Inventory` table) | Portfolio overview | Update to V4 source | pending |
| `src/app/portfolio/page.tsx` | V3 (dashboard data) | Main dashboard | Verify uses updated hooks | pending |
| `src/app/portfolio/pnl/page.tsx` | V3 | P&L page | Update calculations to V4 | pending |
| `src/hooks/useInventoryCounts.ts` | V3 (`Inventory` table) | Count badges | Update to V4 source | pending |

---

### C. API ROUTES

| File | Current | Used For | Action | Status |
|------|---------|----------|--------|--------|
| `src/app/api/stockx/listings/create/route.ts` | V4 primary, V3 fallback | Create/reprice listings | Already migrated | **done** |
| `src/app/api/items/[id]/mark-sold/route.ts` | V4+V3 updates | Mark item sold | Added V4 item + listing status updates | **done** |
| `src/app/api/items/add-by-sku/route.ts` | V3 (`Inventory` table) | Add item | Add V4 item creation | pending |
| `src/app/api/items/add/route.ts` | V3 (`Inventory` table) | Add item (legacy) | Add V4 item creation | pending |
| `src/app/api/items/[id]/delete/route.ts` | V4+V3 cascade delete | Delete item | Added V4 deletes | **done** |
| `src/app/api/items/[id]/reprice/route.ts` | V3 only | Custom valuation | Not listing-related, no V4 needed | N/A |
| `src/app/api/stockx/listings/activate/route.ts` | V4+V3 updates | Activate listing | Added V4 listings update | **done** |
| `src/app/api/stockx/listings/deactivate/route.ts` | V4+V3 updates | Deactivate listing | Added V4 listings update | **done** |
| `src/app/api/portfolio/overview/route.ts` | V3 (`Inventory` table) | Overview data | Update to V4 source | pending |
| `src/app/api/stockx/map-item/route.ts` | V3 (`inventory_market_links`) | Map item to StockX | Continue using V3 for mapping | keep V3 |

---

### D. LEGACY / INTENTIONALLY V3

| File | Reason | Action | Status |
|------|--------|--------|--------|
| `src/app/portfolio/maintenance/stockx-mappings/page.tsx` | Admin tool for V3 mappings | Add "INTENTIONALLY V3" comment | **done** |
| `src/app/portfolio/maintenance/incomplete/page.tsx` | Admin tool for V3 data cleanup | Add "INTENTIONALLY V3" comment | **done** |
| `src/hooks/useStockxListings.ts` | Syncs V3 `stockx_listings` table | Added deprecation comment | **done** |
| `src/lib/services/stockx/listings-sync.ts` | V3 listing sync service | Added deprecation comment | **done** |
| `src/app/api/stockx/debug/*` | Debug routes | Leave as-is | N/A |
| `scripts/*.mjs` | One-off migration scripts | Leave as-is | N/A |

---

### E. ALREADY V4 (NO ACTION NEEDED)

| File | Status |
|------|--------|
| `src/hooks/useInventoryV4.ts` | V4 native |
| `src/lib/inventory-v4/types.ts` | V4 native |
| `src/lib/inventory-v4/stockx-listing-adapter.ts` | V4 native |
| `src/app/portfolio/inventory-v4/page.tsx` | V4 native (full actions wired) |
| `src/app/portfolio/inventory-v4/_components/InventoryV4Table.tsx` | V4 native (uses shared RowActions) |
| `src/app/api/stockx/listings/create/route.ts` | V4 primary |
| `src/app/api/inventory-v4/*` | V4 native |
| `src/lib/services/stockx-v4/*` | V4 native |
| `src/app/portfolio/admin/market-inspector/page.tsx` | V4 native |
| `src/app/portfolio/admin/styles/page.tsx` | V4 native |

---

## V3 → V4 Type Mapping

| V3 Type/Field | V4 Equivalent |
|---------------|---------------|
| `EnrichedLineItem` | `InventoryV4ItemFull` |
| `item.status === 'listed'` | `item.listings.some(l => l.status === 'active')` |
| `item.stockx?.listingStatus` | `item.listings.find(l => l.platform === 'stockx')?.status` |
| `item.stockx?.listingId` | `item.listings.find(l => l.platform === 'stockx')?.external_listing_id` |
| `stockxMapped` | `!!item.style?.stockx_product_id` |
| `item.invested` | `item.purchase_price` |
| `item.avgCost` | `item.purchase_price` |
| `inventory_market_links` | `inventory_v4_listings` (for listing state) |

---

## Migration Order

1. **Inventory table** — `useInventoryV3` → `useInventoryV4`
2. **Actions menu consumers** — desktop + mobile
3. **API routes** — mark-sold, reprice, add-item
4. **Sales / analytics pages** — read-only consumers
5. **Legacy cleanup** — deprecation comments

---

## Acceptance Criteria

- [x] `useInventoryV4` is the only source of listing state on main inventory page
- [x] All action visibility derives from `item.listings` (via `_v4StockxListing`)
- [ ] Sales/analytics reflect V4 truth
- [ ] `item.status === 'listed'` pattern eliminated (V3 status still mapped but not used for listing state)
- [x] Remaining V3 usage is intentional and documented (deprecation markers added)

---

## Notes

- RowActions already has V4 support via `stockxListing` prop
- `ListOnStockXModal` already uses typed adapter
- V3 `stockxListingStatus` fallback works but will be deprecated
