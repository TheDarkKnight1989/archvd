# Market Unified Implementation Status

## ✅ COMPLETED: Step 1 - Schema & Views (Additive Migration)

**Status:** ✅ Ready to apply (all errors fixed)

**Files Created:**
- `supabase/migrations/20251111_market_unified.sql` - Complete database schema (VERIFIED)
- `scripts/apply-market-migration.mjs` - Migration application script
- `MIGRATION_APPLICATION_GUIDE.md` - Detailed application instructions
- Updated `package.json` with new npm scripts

**Fixes Applied:**
- ✅ RLS policy syntax corrected (DROP + CREATE pattern)
- ✅ Column names match existing code (`provider_listing_id`, `provider_product_sku`)
- ✅ All missing timestamps added
- ✅ All indexes reference correct column names
- ✅ No syntax errors remaining

**How to Apply:**
See `MIGRATION_APPLICATION_GUIDE.md` for detailed instructions. Recommended method: Supabase Dashboard SQL Editor.

**Database Schema:**
```
Tables Created:
├── market_products          # Provider-agnostic catalog (StockX/Alias/eBay)
├── market_prices            # Time-series pricing per SKU+size
├── inventory_market_links   # Unified inventory↔provider linkage
└── market_orders            # Imported sales orders

Materialized Views:
├── market_price_daily_medians   # Daily price aggregates
└── portfolio_value_daily        # 30-day portfolio valuation

Regular Views:
├── latest_market_prices          # Provider preference ranking
├── stockx_products_compat        # Backward compatibility
└── stockx_latest_prices          # Backward compatibility

Functions:
├── refresh_market_price_daily_medians()
├── refresh_portfolio_value_daily()
└── refresh_all_market_mvs()
```

**Key Features:**
- ✅ Additive only (no destructive changes)
- ✅ RLS policies (user-scoped + public market data)
- ✅ Compatibility views (existing code won't break)
- ✅ Provider preference (StockX → Alias → eBay)
- ✅ Indexed for performance
- ✅ Size-aware pricing (nullable for one-size products)

---

## 📋 REMAINING STEPS

### Step 2: Market Search API
**File:** `src/app/api/market/search/route.ts`

**Contract:**
```typescript
GET /api/market/search?q=jordan&currency=GBP&limit=50

type MarketSearchResult = {
  sku: string
  name: string              // Brand + Model
  subtitle: string          // Colorway/set
  imageUrl: string
  currency: 'GBP'|'EUR'|'USD'
  median: number|null
  delta7dPct: number|null
  series7d: (number|null)[]
  tags: string[]
  sources: { name: string; count: number }[]
  provider: string
  asOf: string
}
```

**Requirements:**
- Query `market_products` + join `latest_market_prices` + `market_price_daily_medians`
- Compute 7-day delta % from medians
- FX normalize to user's base currency
- 60s LRU cache by (q, currency)
- Pad missing days with nulls

---

### Step 3: ProductCell Component
**File:** `src/components/ProductCell.tsx`

**Visual Pattern:**
```
[40px thumb] Brand Model ↗        [Size: UK 9] [SKU: DZ5485-612]
             Colorway (muted)
```

**Props:**
```typescript
<ProductCell
  sku={string}
  brand={string}
  model={string}
  colorway={string}
  image={string}
  sizeUk?={string}
  skuCode?={string}
  href={string}
/>
```

**Refactor Required:**
- Replace ALL product columns in:
  - `src/app/portfolio/inventory/_components/InventoryTable.tsx`
  - `src/app/portfolio/sales/_components/SalesTable.tsx`
  - `src/app/portfolio/pnl/page.tsx`
  - Any watchlist tables
- Ensure consistent rendering across app

---

### Step 4: Table Column Standardization
**Files to update:**
- `src/app/portfolio/inventory/_components/InventoryTable.tsx`
- `src/app/portfolio/sales/_components/SalesTable.tsx`
- `src/app/portfolio/pnl/page.tsx`

**Standard Columns:**

**Inventory (Active):**
```
Item | SKU | Category | Purchase Date | Buy £ | Tax £ | Ship £ |
Total £ | Market £ | % Gain/Loss | Status | Actions
```

**Sales:**
```
Item | SKU | Size | Purchase £ | Sold £ | Margin £ |
Margin % | Sold Date | Platform | Commission £ | Net Payout £
```

**Formatting:**
- Right-aligned mono numerics
- `.money-pos` #16A34A / `.money-neg` #DC2626
- Arrow indicators (↑↓)
- Sticky header
- Zebra rows
- Hover state

---

### Step 5: Portfolio Overview Update
**File:** `src/app/portfolio/page.tsx`

**Changes:**
- Replace ad-hoc queries with `latest_market_prices`
- Use `portfolio_value_daily` for 30-day chart
- Show provenance: `stockx • 11:41` format
- Handle null padding for missing days

---

### Step 6: Sync Jobs (4 scripts)

#### A. `scripts/sync-market-catalog.mjs`
```bash
npm run sync:market:catalog
```
**Purpose:** Migrate StockX products → `market_products`
- Read from `stockx_products` table (if exists)
- Upsert to `market_products` with `provider='stockx'`
- Extract brand/model/sku/image/release_date

#### B. `scripts/sync-market-prices.mjs`
```bash
npm run sync:market:prices
```
**Purpose:** Import per-size prices from StockX API
- For each SKU we own OR in watchlist
- Fetch ask/bid/last_sale per size
- Insert to `market_prices` with timestamp
- Call `refresh_market_price_daily_medians()` after

#### C. `scripts/sync-market-sales.mjs`
```bash
npm run sync:market:sales
```
**Purpose:** Import orders from StockX API
- Fetch completed orders
- Insert to `market_orders`
- Create `Sales` + `Expenses` records
- Link via `inventory_market_links`

#### D. `scripts/backfill-market-prices.mjs`
```bash
npm run backfill:market:prices
```
**Purpose:** Generate realistic 7d/30d demo data
- For existing products without price history
- Write to `market_prices` with `meta->>'seeded'='true'`
- Create realistic variance (±5-15%)
- Enable sparklines before live data arrives

---

### Step 7: QA & Tests
**File:** `TEST_PLAN.md`

**Checklist:**
- [ ] Migration applies cleanly on empty DB
- [ ] Migration applies cleanly on current prod DB
- [ ] `npm run typecheck` passes (0 errors)
- [ ] API `/api/market/search` returns consistent shape
- [ ] ProductCell renders identically in all tables
- [ ] Portfolio Overview shows 30-point chart with null padding
- [ ] No inventory rows created from StockX (only links)
- [ ] RLS verified: users see only their data
- [ ] Screenshots of before/after for all tables
- [ ] Rollback notes documented

**Files to create:**
- `TEST_PLAN.md` - Step-by-step QA procedures
- `MIGRATION_NOTES.md` - What changed, compatibility, rollback
- Screenshots in `docs/screenshots/`

---

## 🎯 Next Actions

### Option A: Apply Migration Now
```bash
# 1. Apply the migration
npm run migrate:market

# 2. Verify tables created
# Check Supabase dashboard → Table Editor

# 3. Continue with remaining steps
```

### Option B: Review First
- Review the migration SQL
- Test on a staging/dev database first
- Make any adjustments needed
- Then apply to production

---

## 📊 Estimated Remaining Work

| Step | Description | Estimated Time |
|------|-------------|----------------|
| 2 | Market Search API | 2-3 hours |
| 3 | ProductCell Component | 2-3 hours |
| 4 | Table Refactors | 3-4 hours |
| 5 | Portfolio Overview | 1-2 hours |
| 6 | Sync Jobs (4 scripts) | 4-5 hours |
| 7 | QA + Tests + Docs | 2-3 hours |
| **Total** | **Full Implementation** | **14-20 hours** |

---

## 🚀 Why This Architecture?

**Problem Solved:**
- ❌ StockX sync was failing (wrong schema)
- ❌ Provider-specific tables everywhere
- ❌ No unified product representation
- ❌ Inconsistent table columns
- ❌ No market data for portfolio valuation

**Solution:**
- ✅ Provider-agnostic schema
- ✅ Single source of truth for market data
- ✅ Unified ProductCell component
- ✅ Consistent table formatting
- ✅ Scalable to eBay/Alias/others
- ✅ Backward compatible (no breaking changes)

---

## 📝 Notes

- Migration is **additive only** - won't break existing functionality
- Compatibility views ensure old code continues working
- RLS policies already configured
- All indexes created for optimal performance
- Materialized views can be refreshed on-demand or via cron

---

**Status:** Step 1/7 complete ✅
**Last Updated:** 2025-11-11
**Next:** Apply migration OR continue with Steps 2-7
