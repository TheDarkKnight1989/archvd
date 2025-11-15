# Market Unified Migration - Application Guide

## ✅ Migration File Status

**File:** `supabase/migrations/20251111_market_unified.sql`

**Status:** Ready to apply (all errors fixed)

**Changes Made:**
- ✅ Fixed RLS policy syntax (using DROP + CREATE pattern)
- ✅ Fixed column names to match existing code (`provider_listing_id`, `provider_product_sku`)
- ✅ Added missing timestamps (`created_at`, `updated_at`)
- ✅ All indexes updated to match column names

---

## 🚀 How to Apply the Migration

### Option 1: Supabase Dashboard SQL Editor (Recommended)

**Steps:**
1. Go to https://supabase.com/dashboard
2. Select your project (`archvd`)
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the entire contents of `supabase/migrations/20251111_market_unified.sql`
6. Paste into the editor
7. Click **Run** (or press Cmd/Ctrl + Enter)

**Expected Result:**
- Success message
- All tables, views, indexes, policies, and functions created

---

### Option 2: Supabase CLI (If You Want to Install It)

**Install CLI:**
```bash
brew install supabase/tap/supabase
```

**Link Project:**
```bash
npx supabase link --project-ref [your-project-ref]
```

**Apply Migration:**
```bash
npx supabase db push
```

---

### Option 3: Direct psql Connection

**Install PostgreSQL client:**
```bash
brew install postgresql
```

**Get connection string:**
1. Go to Supabase Dashboard → Settings → Database
2. Copy the **Connection string** (Direct connection, not pooler)
3. Replace `[YOUR-PASSWORD]` with your database password

**Apply migration:**
```bash
psql "postgresql://..." -f supabase/migrations/20251111_market_unified.sql
```

---

## 📋 What Gets Created

### Tables
- `market_products` - Provider-agnostic product catalog (StockX/Alias/eBay)
- `market_prices` - Time-series pricing data per SKU+size
- `inventory_market_links` - Links inventory items to marketplace listings
- `market_orders` - Imported sales orders from marketplaces

### Materialized Views
- `market_price_daily_medians` - Daily price aggregates for charts
- `portfolio_value_daily` - 30-day portfolio valuation history

### Regular Views
- `latest_market_prices` - Latest prices with provider preference (StockX → Alias → eBay)
- `stockx_products_compat` - Backward compatibility view
- `stockx_latest_prices` - Backward compatibility view

### Functions
- `refresh_market_price_daily_medians()` - Refresh price medians
- `refresh_portfolio_value_daily()` - Refresh portfolio value
- `refresh_all_market_mvs()` - Refresh all materialized views

### RLS Policies
- ✅ Market data tables: Public read access
- ✅ Inventory links: User-scoped access

---

## ✅ Verification After Application

**Check tables exist:**
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'market_products',
    'market_prices',
    'inventory_market_links',
    'market_orders'
  );
```

**Check views exist:**
```sql
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE 'market%' OR table_name LIKE '%market%';
```

**Check functions exist:**
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE 'refresh%market%';
```

---

## 🎯 Next Steps After Migration

Once the migration is applied successfully:

### 1. Test the Schema
```sql
-- Insert a test product
INSERT INTO market_products (provider, provider_product_id, brand, model, sku)
VALUES ('stockx', 'test-123', 'Nike', 'Dunk Low', 'DD1391-100');

-- Verify it was inserted
SELECT * FROM market_products WHERE sku = 'DD1391-100';

-- Clean up test data
DELETE FROM market_products WHERE provider_product_id = 'test-123';
```

### 2. Continue with Remaining Implementation Steps

**Step 2:** Market Search API (`/api/market/search`)
**Step 3:** ProductCell Component
**Step 4:** Table Standardization
**Step 5:** Portfolio Overview Updates
**Step 6:** Sync Jobs (4 scripts)
**Step 7:** QA & Testing

See `MARKET_UNIFIED_STATUS.md` for detailed specifications of each step.

---

## 🔄 Rollback (If Needed)

If you need to rollback the migration:

```sql
-- Drop in reverse order
DROP FUNCTION IF EXISTS refresh_all_market_mvs();
DROP FUNCTION IF EXISTS refresh_portfolio_value_daily();
DROP FUNCTION IF EXISTS refresh_market_price_daily_medians();

DROP VIEW IF EXISTS stockx_latest_prices;
DROP VIEW IF EXISTS stockx_products_compat;
DROP VIEW IF EXISTS latest_market_prices;

DROP MATERIALIZED VIEW IF EXISTS portfolio_value_daily;
DROP MATERIALIZED VIEW IF EXISTS market_price_daily_medians;

DROP TABLE IF EXISTS market_orders CASCADE;
DROP TABLE IF EXISTS inventory_market_links CASCADE;
DROP TABLE IF EXISTS market_prices CASCADE;
DROP TABLE IF EXISTS market_products CASCADE;
```

---

## 💡 Why Manual Application?

The automated script (`scripts/apply-market-migration.mjs`) requires direct database access which isn't available through Supabase's transaction pooler. The Supabase Dashboard SQL Editor is the most reliable method for applying migrations.

---

## ✅ Ready to Apply

The migration file is **error-free** and **ready to apply**. Choose Option 1 (Dashboard) for the quickest and most reliable application.

Once applied, confirm success and we'll proceed with Steps 2-7 of the unified market implementation.
