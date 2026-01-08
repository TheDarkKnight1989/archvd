# Ready to Test

## ✅ What's Built

### 1. Product Seeding
**File**: `scripts/seed-top-500-products.mjs`
- Seeds 40+ popular products (starter list)
- Maps to StockX/Alias IDs
- Creates size variants
- **Status**: Ready to run

### 2. Market Data Sync
**File**: `src/app/api/cron/sync-market-data/route.ts`
- Fetches from Alias API
- Writes to master_market_data table
- Tiered sync (hot/warm/cold products)
- **Status**: Ready to test

### 3. Auto Cleanup
**File**: `src/app/api/cron/cleanup-old-market-data/route.ts`
- Removes data older than 30 days
- Keeps database size under control
- **Status**: Ready

### 4. Cron Jobs
**File**: `vercel.json`
- Sync every 6 hours
- Cleanup daily at 3am
- **Status**: Configured

---

## 🧪 How to Test

### Step 1: Seed Products
```bash
node scripts/seed-top-500-products.mjs
```

**Expected result:**
- `products` table: 40+ rows
- `product_variants` table: 400+ rows
- Takes ~1 minute

### Step 2: Run First Sync
```bash
curl -X GET "http://localhost:3000/api/cron/sync-market-data" \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Expected result:**
- `master_market_data` gets new rows
- Console shows "Synced: X products"
- Takes 2-5 minutes

### Step 3: Check Data
```sql
-- Run in Supabase SQL editor
SELECT COUNT(*) FROM products;
SELECT COUNT(*) FROM product_variants;
SELECT COUNT(*) FROM master_market_data;

-- See sample data
SELECT
  sku,
  size_key,
  provider,
  lowest_ask,
  currency_code
FROM master_market_data
ORDER BY snapshot_at DESC
LIMIT 10;
```

---

## 📋 Product List (40 SKUs to start)

**Jordan Brand:**
- DZ5485-612 (Military Black 4)
- DD1391-100 (Chicago 1)
- FD0785-100 (SB Pine Green 4)
- DV0788-161 (UNC Toe 1)
- FV5029-010 (Infrared 4)
- IF4491-100 (Midnight Navy 1 Low)
- DZ5485-410 (Frozen Moments 4)
- DC7723-100 (Bordeaux 1)
- DM9652-101 (White Shadow 1 Mid)
- CT8532-175 (Neutral Grey 1 Low)

**Nike Dunk:**
- DD1391-100 (Panda)
- CW1590-100 (Kentucky)
- DD1503-101 (Georgetown)
- DV0833-103 (UNC)
- DR9705-100 (Black White)

**Yeezy:**
- GZ5541 (350 V2 Onyx)
- GW3773 (Slide Bone)
- GY7657 (350 V2 Beluga Reflective)
- GZ0541 (Slide Pure)
- HP8739 (Foam Runner MX Carbon)

**New Balance:**
- M990GL6 (990v6 Grey)
- M2002RDA (2002R Protection Pack)
- U9060LIN (9060 Lunar New Year)
- BB550PWB (550 White Green)
- ML574EVG (574 Grey)

**Nike Air Max:**
- DH4245-101 (Air Max 1 Travis Scott)
- FD9082-100 (Air Max 1 Corduroy)
- CZ8589-100 (Air Max 90 Bacon)
- DN4928-100 (Air Max Plus Utility)

**Others:**
- 1201A789-020 (Asics Gel-Kayano 14 Cream)
- 1203A413-100 (Asics Gel-1130 White Silver)
- L47452400 (Salomon XT-6 Black Phantom)
- L47580900 (Salomon ACS Pro Ebony)
- 3MD10251375 (On Cloudmonster All White)
- 61.98729 (On Cloud 5 All Black)
- VN0A3WKT6BT (Vans Old Skool Black White)
- 170154C (Converse Chuck 70 Black)

**Want to add more?** Let me know which brands/models

---

## 🔧 Next Steps

Once you approve the product list:

1. I'll expand to 500 products
2. Run the seed script
3. Run first sync
4. Show you the data
5. Then fix inventory table to use it

---

## ❓ Questions?

Reply with:
- ✅ "Run it" - I'll execute
- 📝 "Add X brand" - I'll add more products
- ❓ "How does X work" - I'll explain
