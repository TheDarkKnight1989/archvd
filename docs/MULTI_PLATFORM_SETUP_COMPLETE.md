# Multi-Platform Structure - Setup Complete

**Date:** 2025-11-25
**Status:** ✅ Ready for Alias Integration
**Approach:** Option C (Hybrid) - Minimal refactoring, additive only

---

## What Was Accomplished

### 1. ✅ Type System Refactoring

**File:** [`src/lib/portfolio/types.ts`](../src/lib/portfolio/types.ts)

**Changes:**
- Updated `instantSell.provider` to support both `'stockx' | 'alias'`
- Added `alias?` object alongside `stockx?` in `EnrichedLineItem` type
- Alias type includes:
  - `mapped`, `catalogId`, `listingId`, `listingStatus`, `askPrice`
  - Market data: `lowestAsk`, `highestBid`, `lastSoldPrice`, `globalIndicatorPrice`
  - Health tracking: `mappingStatus`, `lastSyncSuccessAt`, `lastSyncError`

**Impact:** Type-safe support for both platforms in UI components

---

### 2. ✅ Database Schema - Separate Alias Table

**Migration:** [`supabase/migrations/20251125_create_inventory_alias_links.sql`](../supabase/migrations/20251125_create_inventory_alias_links.sql)

**Created Table:** `inventory_alias_links`

**Schema:**
```sql
CREATE TABLE inventory_alias_links (
  id UUID PRIMARY KEY,
  inventory_id UUID REFERENCES "Inventory"(id),
  alias_catalog_id TEXT NOT NULL,
  alias_listing_id TEXT,
  alias_sku TEXT,
  alias_product_name TEXT,
  alias_brand TEXT,
  match_confidence NUMERIC(3, 2),
  mapping_status TEXT CHECK (mapping_status IN ('ok', 'alias_404', 'invalid', 'unmapped')),
  last_sync_success_at TIMESTAMPTZ,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  CONSTRAINT unique_inventory_alias_link UNIQUE (inventory_id)
);
```

**Key Design Decisions:**
- ✅ Separate from `inventory_market_links` (keeps StockX untouched)
- ✅ Uses modern `inventory_id` column name
- ✅ RLS policies for user-scoped access
- ✅ Indexes on catalog_id, listing_id, and mapping_status

**Status:** ⚠️ **Migration needs to be applied manually** (exec_sql function not available)

**How to Apply:**
```bash
# Option 1: Supabase Dashboard
# 1. Go to SQL Editor
# 2. Paste contents of migration file
# 3. Run

# Option 2: Command line (if psql available)
cat supabase/migrations/20251125_create_inventory_alias_links.sql | psql $DATABASE_URL
```

---

### 3. ✅ Inventory Hook - Multi-Platform Data Fetching

**File:** [`src/hooks/useInventoryV3.ts`](../src/hooks/useInventoryV3.ts)

**StockX Data Fetching (Unchanged):**
```typescript
// Uses existing schema: item_id, stockx_product_id, stockx_variant_id, stockx_listing_id
const { data: stockxMappings } = await supabase
  .from('inventory_market_links')
  .select('item_id, stockx_product_id, stockx_variant_id, stockx_listing_id, ...')
```

**NEW: Alias Data Fetching (Parallel):**
```typescript
// Uses new table: inventory_alias_links
const { data: aliasMappings } = await supabase
  .from('inventory_alias_links')
  .select('inventory_id, alias_catalog_id, alias_listing_id, ...')

// Fetch Alias market snapshots
const { data: aliasPrices } = await supabase
  .from('alias_market_snapshots')
  .select('catalog_id, size, currency, lowest_ask_cents, highest_bid_cents, ...')

// Fetch Alias listings
const { data: aliasListings } = await supabase
  .from('alias_listings')
  .select('id, alias_listing_id, alias_product_id, price_cents, size, status, ...')
```

**Data Enrichment:**
- Each inventory item now has BOTH `stockx` and `alias` data
- Alias prices converted from cents to major units automatically
- Currency fallback logic (user currency → USD → EUR → GBP)
- Lookup maps for fast joining

**Constants Added:**
```typescript
const ALIAS_SELLER_FEE_PCT = 0.095  // 9.5% Alias fee
const STOCKX_SELLER_FEE_PCT = 0.10  // 10% StockX fee
```

---

## Architecture Overview

```
INVENTORY ITEM
    │
    ├── StockX Integration (existing)
    │   ├── inventory_market_links (item_id, stockx_*)
    │   ├── stockx_products
    │   ├── stockx_listings
    │   └── stockx_market_latest
    │
    └── Alias Integration (NEW)
        ├── inventory_alias_links (inventory_id, alias_*)
        ├── alias_market_snapshots
        └── alias_listings
```

**Benefits:**
- ✅ Zero breaking changes to StockX
- ✅ Clean separation of concerns
- ✅ Easy to add more platforms (eBay, GOAT, etc.)
- ✅ Type-safe across the stack

---

## What's Next: Alias Integration Roadmap

Now that the multi-platform foundation is in place, you can proceed with:

### Phase 1: Database & Core Services
1. ✅ `inventory_alias_links` table (done)
2. ⏳ Apply migration to production
3. ⏳ `alias_accounts` OAuth table
4. ⏳ `alias_listings` sync service
5. ⏳ `alias_market_snapshots` pricing service

### Phase 2: API Routes
1. ⏳ `/api/alias/oauth/start` - OAuth flow
2. ⏳ `/api/alias/oauth/callback` - Token exchange
3. ⏳ `/api/alias/search` - Product search
4. ⏳ `/api/alias/listings/create` - Create listing
5. ⏳ `/api/alias/listings/sync` - Sync listings

### Phase 3: UI Components
1. ⏳ Update `InventoryV3Table` to show Alias data
2. ⏳ "List on Alias" modal
3. ⏳ Alias connection status indicator
4. ⏳ Multi-platform price comparison

### Phase 4: Background Jobs
1. ⏳ Alias market data refresh (hourly)
2. ⏳ Alias listing sync (on-demand)
3. ⏳ Alias order webhook handling

---

## Testing Checklist

### Before Proceeding:

- [ ] Apply `inventory_alias_links` migration
- [ ] Verify table created: `SELECT * FROM inventory_alias_links LIMIT 1;`
- [ ] Test RLS policies work with test user
- [ ] Confirm hook compiles without TypeScript errors
- [ ] Test existing StockX functionality still works

### After Alias Integration:

- [ ] Create test Alias account link
- [ ] Map test inventory item to Alias catalog
- [ ] Fetch Alias market data
- [ ] Verify Alias data appears in `useInventoryV3` hook
- [ ] Test UI shows both StockX AND Alias pricing

---

## Files Modified

1. **Types:**
   - [`src/lib/portfolio/types.ts`](../src/lib/portfolio/types.ts) - Added `alias?` to `EnrichedLineItem`

2. **Hooks:**
   - [`src/hooks/useInventoryV3.ts`](../src/hooks/useInventoryV3.ts) - Added parallel Alias data fetching

3. **Migrations:**
   - [`supabase/migrations/20251125_create_inventory_alias_links.sql`](../supabase/migrations/20251125_create_inventory_alias_links.sql)

4. **Scripts:**
   - [`scripts/check-inventory-market-links-schema.mjs`](../scripts/check-inventory-market-links-schema.mjs) - Schema inspection
   - [`scripts/apply-alias-links-migration.mjs`](../scripts/apply-alias-links-migration.mjs) - Migration helper

---

## Key Principles Maintained

✅ **No Breaking Changes:** All StockX code remains untouched
✅ **Additive Only:** Only new code/tables added
✅ **Type Safety:** Full TypeScript support for both platforms
✅ **Separation of Concerns:** Each platform has its own tables
✅ **Future-Proof:** Easy to add eBay, GOAT, etc. later

---

## Questions?

- **Why separate tables?** Avoids modifying battle-tested StockX schema
- **Why inventory_id vs item_id?** Alias uses modern naming; StockX keeps legacy
- **Can I still add more platforms?** Yes! Follow the same pattern
- **What about unified provider table?** That's the "full refactoring" we'll do later (not Option C)

---

**Ready to start Phase 1, Week 1 of Alias integration!** 🚀
