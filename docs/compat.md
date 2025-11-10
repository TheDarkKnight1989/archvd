# Backwards Compatibility & Deprecation Guide

This document tracks compatibility shims, deprecated patterns, and migration paths for the production-grade foundation overhaul.

## Overview

All changes maintain backwards compatibility through:
- **Compatibility views** for deprecated database patterns
- **Re-exports** for renamed/moved code
- **Adapter functions** for changed APIs
- **Shim types** for updated interfaces

## Database Compatibility

### Sales Table Split (M2 Migration)

**What Changed:**
- Introduced dedicated `sales` table for realized transactions
- `Inventory` table remains source of truth for items
- `sales` table is now source of truth for P&L calculations

**Backwards Compatibility:**

1. **`sales_view_compat` View**
   - **Purpose:** Allows legacy code to continue reading sold items from Inventory-like structure
   - **Location:** `supabase/migrations/20251115_M2_sales_split_and_fx_snapshots.sql`
   - **Deprecation:** Remove after all code migrated to use `sales` table directly
   - **Target Date:** Q2 2025

   ```sql
   -- Old pattern (still works)
   SELECT * FROM "Inventory" WHERE status = 'sold'

   -- New pattern (preferred)
   SELECT * FROM sales

   -- Compat pattern (temporary)
   SELECT * FROM sales_view_compat
   ```

2. **Auto-migration Trigger**
   - **Function:** `trg_inventory_mark_sold()`
   - **Purpose:** Automatically creates `sales` record when item marked as sold
   - **Status:** Permanent - ensures data consistency

### FX Rates Hardening (M3 Migration)

**What Changed:**
- `fx_rates` table recreated with generated columns
- Added `usd_per_gbp` and `eur_per_gbp` as generated (not manually inserted)

**Backwards Compatibility:**

1. **`fn_fx_upsert()` Function**
   - **Purpose:** Allows existing seed scripts to work without modification
   - **Location:** `supabase/migrations/20251116_M3_fx_rates_hardening.sql`
   - **Ignores:** Writes to generated columns (silently dropped)
   - **Smart Defaults:** Uses previous day's rate if not provided
   - **Status:** Permanent compatibility helper

   ```javascript
   // Old seed pattern (still works)
   await supabase.from('fx_rates').insert({
     as_of: '2025-01-01',
     gbp_per_usd: 0.787,
     gbp_per_eur: 0.855,
     usd_per_gbp: 1.270  // This field ignored - auto-calculated
   })

   // New pattern (preferred)
   await supabase.rpc('fn_fx_upsert', {
     p_as_of: '2025-01-01',
     p_gbp_per_usd: 0.787,
     p_gbp_per_eur: 0.855
   })
   ```

### Portfolio Views

**What Changed:**
- Created `portfolio_latest_prices_v2` with FX-aware base currency amounts

**Backwards Compatibility:**
- Old `latest_market_prices` view unchanged
- Old `portfolio_latest_prices` view unchanged (if exists)
- New code should use `_v2` variant

**Migration Path:**
```typescript
// Old (still works, but no FX support)
const { data } = await supabase
  .from('latest_market_prices')
  .select('*')

// New (FX-aware, base currency amounts)
const { data } = await supabase
  .from('portfolio_latest_prices_v2')
  .select('*')
```

## API Compatibility

### Mark as Sold Endpoint

**What Changed:**
- Now writes to `sales` table in addition to updating `Inventory`
- Returns sales record ID in response

**Backwards Compatibility:**
- Request format unchanged
- Response format extended (not breaking)
- Old response fields still present

```typescript
// Request format (unchanged)
POST /api/items/:id/mark-sold
{
  sold_price: 100,
  sold_date: '2025-01-01',
  sale_currency: 'GBP',
  platform: 'stockx',
  fees: 5,
  shipping: 10
}

// Response (extended, not breaking)
{
  success: true,
  item: { ... },        // Inventory record (old)
  sales_id: '...',      // Sales record ID (new)
  fx_info: { ... }      // FX details (old)
}
```

### API v1 Structure

**Status:** In development

**Plan:**
- All endpoints will be aliased under `/api/v1/`
- Old `/api/` routes will remain working via re-exports
- New code should use `/api/v1/` paths

```typescript
// Old (still works)
fetch('/api/items', { ... })

// New (preferred)
fetch('/api/v1/items', { ... })
```

## Frontend Compatibility

### Component Exports

**Status:** No breaking changes yet

**When components are refactored:**
- Old exports will remain via re-exports
- New exports will be in new locations
- JSDoc `@deprecated` tags will mark old paths

Example (when needed):
```typescript
// src/components/old-path.ts
/**
 * @deprecated Use import from '@/components/new-path' instead
 * @see {@link file://./new-path.ts}
 */
export { Component } from './new-path'
```

## Type Compatibility

### Supabase Generated Types

**What Changed:**
- Types regenerated from new schema
- New tables: `sales`, `logs_app`, `logs_jobs`, `logs_api`
- New enums: `item_status`, `sale_platform`, `interval_unit`

**Backwards Compatibility:**
- Old type references still work
- New code should use generated types

```typescript
// Old (manual types - deprecated)
type Sale = {
  id: string
  sold_price: number
  // ...
}

// New (generated types - preferred)
import { Database } from '@/types/supabase'
type Sale = Database['public']['Tables']['sales']['Row']
```

## Deprecation Timeline

### Q1 2025 (Current)
- ✅ All compatibility shims in place
- ✅ All migrations backwards-compatible
- ✅ Zero breaking changes

### Q2 2025 (Planned)
- Migrate remaining code to use `sales` table directly
- Remove `sales_view_compat` (with warning period)
- Update all API calls to use `/api/v1/` paths

### Q3 2025 (Planned)
- Remove old `/api/` route aliases (with warning period)
- Clean up re-exports
- Remove deprecated type imports

## Migration Checklist

When updating code to use new patterns:

**Database:**
- [ ] Replace Inventory sold queries with `sales` table queries
- [ ] Use `portfolio_latest_prices_v2` for FX-aware data
- [ ] Update FX rate seeds to use `fn_fx_upsert()`

**API:**
- [ ] Update fetch calls to `/api/v1/` paths
- [ ] Handle extended response formats
- [ ] Use Zod-validated request types

**Types:**
- [ ] Replace manual types with generated Supabase types
- [ ] Update imports to use `@/types/supabase`

## Support

Questions about migrations or deprecations?
- Check this document first
- Review migration SQL comments
- Check function/table COMMENT annotations in database

## Rollback Procedures

If issues arise:

**Database:**
- Migrations are idempotent and can be re-run
- Compatibility views ensure old code keeps working
- To rollback: migrations must be manually reversed in order (M3 → M2 → M1)

**API:**
- Old endpoints remain working
- No rollback needed for API changes

**Frontend:**
- Re-exports mean no code breaks
- Can rollback imports without breaking

---

**Last Updated:** 2025-01-17
**Next Review:** 2025-02-01
