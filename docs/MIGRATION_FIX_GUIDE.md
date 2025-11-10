# Migration Fix Guide

## Issue Summary

Your database has existing FX-related columns with different naming conventions than the original migrations expected:

**Your Existing Schema:**
- `purchase_amount_base` (base currency purchase total)
- `purchase_fx_rate` (FX rate at purchase time)
- `sale_amount_base` (base currency sale total)
- `sale_fx_rate` (FX rate at sale time)

**Original Migrations Expected:**
- `purchase_total_base`
- `fx_rate_at_purchase`
- `sale_total_base`
- `fx_rate_at_sale`

## Solution

I've created FIXED versions of the migrations that work with your existing column names:

### Fixed Migrations Created:

1. **`20251115_M2_sales_split_FIXED.sql`**
   - Creates `sales` table for accounting source of truth
   - Auto-migration trigger that syncs Inventory → sales on mark-as-sold
   - Uses your existing column names (`purchase_amount_base`, `purchase_fx_rate`)

2. **`20251117_views_and_observability_FIXED.sql`**
   - Creates `portfolio_latest_prices_v2` view
   - Adds observability tables: `logs_app`, `logs_jobs`, `logs_api`
   - Adds `idempotency_keys` table
   - Uses your existing column names directly

## How to Apply FIXED Migrations

### Option 1: Using the Script (Recommended)

I've created a convenient script that applies the FIXED migrations:

```bash
# Apply M2 FIXED migration only
npm run migrate:fixed M2

# Apply M4 FIXED migration only
npm run migrate:fixed M4

# Apply all FIXED migrations at once
npm run migrate:fixed all
```

### Option 2: Direct psql Commands

If you prefer to run them manually:

```bash
# Load environment variables
set -a && source .env.local && set +a

# Apply M2 FIXED
psql "$DATABASE_URL" -f supabase/migrations/20251115_M2_sales_split_FIXED.sql

# Apply M4 FIXED
psql "$DATABASE_URL" -f supabase/migrations/20251117_views_and_observability_FIXED.sql
```

## Complete Migration Sequence

Here's the correct order to apply all migrations:

```bash
# 1. M1 - Enums and base_currency (should work as-is)
npx dotenv -e .env.local -- node scripts/apply-migration.mjs supabase/migrations/20251114_M1_enums_and_base_currency.sql

# 2. M2 FIXED - Sales table split (FIXED version)
npm run migrate:fixed M2

# 3. M3 - FX rates hardening (should work after the fix I made)
npx dotenv -e .env.local -- node scripts/apply-migration.mjs supabase/migrations/20251116_M3_fx_rates_hardening.sql

# 4. M4 FIXED - Views and observability (FIXED version)
npm run migrate:fixed M4
```

Or apply all FIXED migrations at once:

```bash
# Apply all FIXED migrations
npm run migrate:fixed all
```

## Verification

After running the migrations, verify everything is set up correctly:

### 1. Check Sales Table

```sql
-- Should return empty result set (no errors)
SELECT * FROM public.sales LIMIT 1;
```

### 2. Check Observability Tables

```sql
-- All should work without errors
SELECT * FROM public.logs_app LIMIT 1;
SELECT * FROM public.logs_jobs LIMIT 1;
SELECT * FROM public.logs_api LIMIT 1;
SELECT * FROM public.idempotency_keys LIMIT 1;
```

### 3. Check Portfolio View

```sql
-- Should show your inventory with market prices
SELECT * FROM public.portfolio_latest_prices_v2 LIMIT 5;
```

### 4. Test Auto-Migration Trigger

Create a test item and mark it as sold - it should automatically create a sales record:

```bash
# Via API
curl -X POST http://localhost:3000/api/v1/items \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "sku": "TEST-001",
    "brand": "Nike",
    "purchase_price": 100,
    "purchase_currency": "GBP"
  }'

# Mark as sold
curl -X POST http://localhost:3000/api/v1/items/ITEM_ID/mark-sold \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "sold_price": 150,
    "sold_date": "2025-01-09",
    "platform": "stockx"
  }'

# Check sales table - should have a record
SELECT * FROM public.sales ORDER BY created_at DESC LIMIT 1;
```

## What Changed in FIXED Versions

### M2 FIXED Changes:

**Original trigger function tried to reference:**
```sql
NEW.purchase_total_base   -- ❌ Doesn't exist
NEW.fx_rate_at_purchase   -- ❌ Doesn't exist
```

**FIXED version uses:**
```sql
NEW.purchase_amount_base  -- ✅ Exists in your schema
NEW.purchase_fx_rate      -- ✅ Exists in your schema
```

### M4 FIXED Changes:

**Original view tried to select:**
```sql
i.purchase_total_base           -- ❌ Doesn't exist
i.fx_rate_at_purchase           -- ❌ Doesn't exist
COALESCE(i.purchase_total_base, i.purchase_amount_base)  -- ❌ First column must exist
```

**FIXED version uses:**
```sql
i.purchase_amount_base AS purchase_total_base      -- ✅ Alias existing column
i.purchase_fx_rate AS fx_rate_at_purchase          -- ✅ Alias existing column
```

**Why COALESCE didn't work:**
PostgreSQL's COALESCE doesn't skip non-existent columns - ALL columns in the function must exist in the schema. If `purchase_total_base` doesn't exist, the query fails even if `purchase_amount_base` does exist.

## Troubleshooting

### "permission denied" when running script

```bash
chmod +x scripts/apply-fixed-migrations.sh
npm run migrate:fixed all
```

### "DATABASE_URL not set"

Make sure your `.env.local` has:
```
DATABASE_URL=postgresql://postgres:[password]@[host]/postgres
```

### "relation already exists"

The migrations are idempotent (safe to run multiple times). If you see "already exists" errors, that's normal - it means that part is already applied.

### "column still doesn't exist"

If you still get column errors:
1. Verify you're running the **FIXED** versions (with `_FIXED.sql` suffix)
2. Check your schema: `npm run check:schema`
3. Make sure M1 ran successfully first (it may add required columns)

## Next Steps

After migrations are applied:

1. **Seed the database:**
   ```bash
   npm run seed:fx    # 2 years of FX rates
   npm run seed:all   # Full seed data
   ```

2. **Run smoke tests:**
   ```bash
   npm run test:smoke
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

## Support

If you continue to see errors:

1. Run the schema check:
   ```bash
   node scripts/check-schema.mjs
   ```

2. Check the exact error message and line number

3. Verify which migration file you're running (original vs FIXED)

---

**Created:** 2025-01-09  
**Status:** Ready to apply
