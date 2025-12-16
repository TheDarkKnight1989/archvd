# CLAUDE.md — Project Directives for ARCHVD

## 🔒 V3 IS DEAD

You are NOT allowed to read from, reference, debug, or modify ANY V3 / legacy market data systems.

### ❌ Explicitly Forbidden

**Tables:**
- `stockx_variants`
- `stockx_market_snapshots`
- `alias_market_data`
- Any non-`inventory_v4_*` market data table

**Code:**
- Old sync logic, legacy RPCs, or "unified" V3 joins
- Guessing or inferring behaviour from V3 data

**If you detect V3 usage:**
1. Stop immediately and report it
2. Do not implement workarounds

---

### ✅ Only Allowed Sources of Truth

**V4 Tables:**
- `inventory_v4_stockx_products`
- `inventory_v4_stockx_variants`
- `inventory_v4_stockx_market_data`
- `inventory_v4_alias_products`
- `inventory_v4_alias_variants`
- `inventory_v4_alias_market_data`
- `inventory_v4_style_catalog`
- `inventory_v4_sync_queue`

**V4 Code:**
- V4 sync queue + workers
- `src/lib/inventory-v4/*`
- `src/hooks/useInventoryV4.ts`
- `src/app/portfolio/inventory-v4/*`

---

## 🟡 Neutral / Shared Tables (READ-ONLY unless told otherwise)

These are NOT V3 market data and NOT deprecated.

**Allowed:**
- `inventory_items` — User's actual owned inventory (source of truth for portfolio)
- `stockx_listings` — Used for selling/listing workflows, not market pricing
- `stockx_listing_status` — Listing state tracking
- `product_catalog` — Legacy product metadata (name, brand, image)
  - May be read, but prefer `inventory_v4_style_catalog` for new work
  - Do NOT extend or evolve `product_catalog`

---

## 🔁 Production Carve-out (Temporary)

- Existing production pages may READ V3 (e.g. `useInventoryV3.ts`)
- This is a temporary compatibility carve-out
- ❌ No debugging, refactoring, or "fixing" V3 logic
- ❌ No new features may depend on V3

**Goal:** Parallel run V4 → cutover → delete V3

---

## 🧱 Schema & Migrations

### ✅ ALLOWED
- Create new `inventory_v4_*` tables
- Add columns to existing `inventory_v4_*` tables
- Create new V4-only RPC functions
- Create new indexes, views, materialized views on V4 only

### ❌ NOT ALLOWED
- Modify any V3 table schemas
- Add columns to V3 tables
- Create views, RPCs, or queries that bridge V3 ↔ V4
- Create "temporary" hybrid solutions for convenience

**Rule:** V4 evolves forward. V3 is frozen until deletion.

---

## 🧨 End State (Non-Negotiable)

- V4 becomes the only market data source
- V3 tables are deleted
- V3 hooks, services, and queries are removed
- No mixed reads long-term

---

## 👟 Sizing Rules (Non-Negotiable)

- Inventory sizes are **UK**
- All provider data must be converted using:
  - Brand + gender aware size chart
  - Existing size-conversion utilities in `src/lib/utils/size-conversion.ts`
- Never join purely on numeric size
- Women's sizing must respect UK↔US mappings

---

## 🌍 Region Rules

- Region = filter (UK / EU / US)
- No provider-specific region toggles
- Currency normalisation optional (admin view)

---

## 🧠 Operating Mode

1. Assume V4 is correct unless proven otherwise
2. If something "doesn't work", check schema or joins, not sync
3. Do not edit code unless explicitly instructed
4. Default to: **report → propose → wait**
