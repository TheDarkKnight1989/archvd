# P&L Data Issues - Comprehensive Debugging Guide

## Problem Summary
1. Revenue KPI shows £0.00 but says "3 sales"
2. P&L table not showing size or sold price
3. View migration ran successfully but data still missing

## Root Cause Analysis

### Most Likely Issues

#### Issue 1: Database Records Have NULL Values
The Inventory table records might have:
- `size` = NULL
- `sold_price` = NULL or 0
- `sold_date` exists (which is why you see "3 sales")

#### Issue 2: Date Range Filter
Default date range is "this-month" - sales might be from previous months.

#### Issue 3: View Filter Excluding Records
The view has `WHERE sold_price IS NOT NULL` which filters out records with NULL sold_price.

## Step-by-Step Diagnosis

### Step 1: Check Browser Console
Open browser DevTools (F12) and check for these logs:
```
[usePnLItems] Raw data from view (first row): {...}
[usePnLItems] Mapped items (first row): {...}
```

**What to look for:**
- If "Raw data" is empty/null → View has no data
- If "Mapped items" shows `salePrice: null` → Database has NULL values
- If both are empty → No sold items match the WHERE clause

### Step 2: Run SQL Diagnostics
Go to Supabase Dashboard → SQL Editor and run:

```sql
-- Query 1: Check raw sold items
SELECT
  id,
  sku,
  brand,
  model,
  size,
  purchase_price,
  sold_price,
  sold_date,
  status
FROM "Inventory"
WHERE status = 'sold'
ORDER BY sold_date DESC
LIMIT 10;
```

**Expected Result:** Should show your 3 sold items
**If size or sold_price are NULL** → That's your problem!

```sql
-- Query 2: Check view output
SELECT * FROM vat_margin_detail_view
ORDER BY sold_date DESC
LIMIT 10;
```

**Expected Result:** Should show same items with renamed columns
**If this returns 0 rows** → Records are being filtered out by the view's WHERE clause

```sql
-- Query 3: Count NULL values
SELECT
  COUNT(*) as total_sold,
  COUNT(size) as has_size,
  COUNT(sold_price) as has_sold_price,
  SUM(CASE WHEN sold_price IS NULL THEN 1 ELSE 0 END) as null_sold_price,
  SUM(CASE WHEN size IS NULL THEN 1 ELSE 0 END) as null_size
FROM "Inventory"
WHERE status = 'sold';
```

**Expected Result:** All counts should equal total_sold
**If null_sold_price > 0** → Some records missing sold_price
**If null_size > 0** → Some records missing size

### Step 3: Check Date Filtering
The P&L page defaults to "this-month". Check the URL:
```
/portfolio/pnl?preset=this-month
```

Try changing to "last-90" or "ytd" to see if data appears.

## Solutions

### Solution 1: Update NULL Records in Database

If records have NULL values, update them:

```sql
-- Find records with NULL sold_price
SELECT id, sku, brand, model, sold_date
FROM "Inventory"
WHERE status = 'sold' AND sold_price IS NULL;

-- Update a specific record (replace ID and values)
UPDATE "Inventory"
SET
  sold_price = 150.00,  -- Enter actual sold price
  size = 'UK 10'        -- Enter actual size
WHERE id = 'your-record-id-here';
```

### Solution 2: Relax View Constraints (NOT RECOMMENDED)

Only if you want to see records even with NULL values:

```sql
-- Modify view to allow NULL sold_price (not recommended for P&L)
CREATE OR REPLACE VIEW vat_margin_detail_view AS
SELECT
  user_id,
  id AS item_id,
  sku,
  brand,
  model,
  size,
  sold_date,
  purchase_price AS buy_price,
  sold_price AS sale_price,
  platform,
  COALESCE(sold_price, 0) - COALESCE(purchase_price, 0) AS margin_gbp,
  CASE
    WHEN (COALESCE(sold_price, 0) - COALESCE(purchase_price, 0)) > 0
    THEN (COALESCE(sold_price, 0) - COALESCE(purchase_price, 0)) / 6.0
    ELSE 0
  END AS vat_due_gbp,
  DATE_TRUNC('month', sold_date)::date AS month
FROM "Inventory"
WHERE status = 'sold'
  AND sold_date IS NOT NULL
  -- Removed: AND sold_price IS NOT NULL
  -- Removed: AND purchase_price IS NOT NULL
ORDER BY sold_date DESC;
```

### Solution 3: Fix Data Entry Process

Ensure when marking items as "sold", you also enter:
- **sold_price** (required)
- **sold_date** (required)
- **size** (if not already entered during purchase)
- **platform** (optional but useful)

## Quick Test

Run this single query to see everything at once:

```sql
WITH sold_items AS (
  SELECT
    id,
    sku,
    brand,
    model,
    size,
    purchase_price,
    sold_price,
    sold_date,
    status,
    CASE
      WHEN size IS NULL THEN 'Missing size'
      WHEN sold_price IS NULL THEN 'Missing sold_price'
      WHEN purchase_price IS NULL THEN 'Missing purchase_price'
      ELSE 'OK'
    END as data_status
  FROM "Inventory"
  WHERE status = 'sold'
)
SELECT
  data_status,
  COUNT(*) as count,
  string_agg(sku, ', ') as skus
FROM sold_items
GROUP BY data_status;
```

**This will show:**
- How many sold items are OK
- How many are missing size
- How many are missing sold_price
- The SKUs of problematic items

## Expected Outcome

After fixing:
1. Revenue KPI should show actual £ amount (not £0.00)
2. P&L table should show size column (e.g., "UK 10")
3. P&L table should show sold price (e.g., "£150.00")
4. All columns should populate correctly

---

**Next Steps:**
1. Run Query 3 from Step 2 above
2. If null_sold_price > 0, you need to update those records
3. Post the query results and I'll help you fix them
