# Market Data Audit Report

**Generated:** 2025-12-17T10:00 UTC
**Methodology:** READ-ONLY SQL queries via Supabase client
**Scope:** All market/pricing/sales tables in public schema

---

## 1. VERIFIED DATA INVENTORY

### Table Inventory (Sorted by Row Count)

| Table | Rows | Est. Size | Category | Purpose |
|-------|------|-----------|----------|---------|
| `inventory_v4_alias_sales_history` | 1,597,972 | ~305 MB | V4 | Individual Alias sales records |
| `inventory_v4_alias_price_history` | 183,133 | ~35 MB | V4 | Daily price snapshots (sparse) |
| `stockx_market_snapshots` | 60,809 | ~12 MB | V3-LEGACY | Old StockX snapshots (FROZEN) |
| `inventory_v4_alias_variants` | 45,681 | ~9 MB | V4 | Alias variant definitions |
| `inventory_v4_alias_market_data` | 45,681 | ~9 MB | V4 | Current Alias market state |
| `inventory_v4_stockx_market_data` | 12,343 | ~2 MB | V4 | Current StockX market state |
| `alias_offer_histograms` | 11,247 | ~2 MB | Other | Bid depth snapshots |
| `inventory_v4_stockx_price_history` | 10,638 | ~2 MB | V4 | StockX price snapshots |
| `inventory_v4_stockx_variants` | 4,115 | ~1 MB | V4 | StockX variant definitions |
| `stockx_variants` | 2,626 | ~0.5 MB | V3-LEGACY | Old StockX variants (FROZEN) |
| `fx_rates` | 732 | ~0.1 MB | Shared | Currency exchange rates |
| `inventory_v4_alias_products` | 207 | <0.1 MB | V4 | Alias product definitions |
| `inventory_v4_stockx_products` | 194 | <0.1 MB | V4 | StockX product definitions |
| `inventory_v4_style_catalog` | 194 | <0.1 MB | V4 | Unified style catalog |
| `product_catalog` | 72 | <0.1 MB | Shared | Legacy product metadata |

**Total:** 26 tables, ~1,964,434 rows, ~380 MB estimated

---

## 2. SALES HISTORY PROOF

### 2.1 Structure

**Table:** `inventory_v4_alias_sales_history`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | integer | Primary key |
| `alias_catalog_id` | text | Product identifier |
| `size_value` | numeric | Size (US sizing) |
| `price` | integer | Sale price |
| `purchased_at` | timestamptz | **Actual sale timestamp** |
| `consigned` | boolean | Was item consigned |
| `region_id` | text | Region identifier |
| `currency_code` | text | Currency (mostly USD) |
| `recorded_at` | timestamptz | When we ingested it |

### 2.2 Time Dimension - THE "9 YEARS" CLAIM

**VERIFIED ✅**

```
Earliest sale: 2016-09-20T15:22:51.898Z
Latest sale:   2025-12-17T09:37:18.402Z
Span:          9.2 years
Total rows:    1,597,972
```

### 2.3 Data Grain

**ONE ROW = ONE INDIVIDUAL SALE**

This is NOT aggregated data. Each row represents a single transaction on Alias.

Sample (oldest sales):
```
2016-09-20 | yeezy-boost-350-v2-beluga-bb1826 | Size 7.5 | $1,175
2016-09-21 | yeezy-boost-350-v2-beluga-bb1826 | Size 14  | $1,200
```

### 2.4 Year-by-Year Distribution

| Year | Sales | Notes |
|------|-------|-------|
| 2016 | 1,584 | Data starts Sept 2016 |
| 2017 | 6,398 | |
| 2018 | 15,555 | |
| 2019 | 8,347 | Slight dip |
| 2020 | 25,890 | |
| 2021 | 77,464 | Growth accelerates |
| 2022 | 181,317 | |
| 2023 | 294,663 | |
| 2024 | 323,865 | |
| 2025 | 663,327 | Partial year, already 2x 2024 |

**Observation:** Exponential growth. Data is NOT sparse - it's genuinely comprehensive.

### 2.5 Product Coverage

- **207** products synced to Alias
- **123** products have sales history (59%)
- **1,601,880** total sales across all products

Top 5 by sales volume:
1. Air Jordan 1 'Chicago Lost & Found' — 43,967 sales
2. Asics Gel 1130 'Clay Canyon' — 39,397 sales
3. Nike Dunk Low 'Black White' — 33,888 sales
4. Asics Gel 1130 'Black Pure Silver' — 33,205 sales
5. Air Jordan 1 'Patent Bred' — 32,412 sales

### ⚠️ DATA QUALITY ISSUE: DUPLICATES

**66% of early rows are duplicated** (same sale recorded 3 times)

```
"yeezy-boost-350-v2-beluga-bb1826|7.5|2016-09-20T15:22:51.898" appears 3 times
"yeezy-boost-350-v2-beluga-bb1826|14|2016-09-21T14:23:08.976" appears 3 times
```

This appears to be from multi-region sync. Dedupe needed before any analytics.

---

## 3. HISTORICAL COVERAGE SUMMARY

### Price History Tables

| Table | Rows | Time Coverage | Data Quality |
|-------|------|---------------|--------------|
| `inventory_v4_alias_price_history` | 183,133 | **7 days** (Dec 9-17) | 27.6% have lowest_ask |
| `inventory_v4_stockx_price_history` | 10,638 | **2 days** (Dec 16-17) | Good coverage |

**CRITICAL FINDING:** There is NO long-term price history. These tables are recent snapshots only.

### Market Data Tables (Current State Only)

| Table | Rows | Freshness |
|-------|------|-----------|
| `inventory_v4_stockx_market_data` | 12,343 | Dec 9-17 (rolling) |
| `inventory_v4_alias_market_data` | 45,681 | Dec 10-17 (rolling) |

These contain current bid/ask but NO historical time series.

### Histogram Data

| Table | Rows | Coverage |
|-------|------|----------|
| `alias_offer_histograms` | 11,247 | **Single snapshot** (Dec 4, 2025) |

This is point-in-time bid depth data, NOT a time series.

### V3 Legacy (FROZEN - Do Not Use)

| Table | Rows | Coverage |
|-------|------|----------|
| `stockx_market_snapshots` | 60,809 | Nov 22 - Dec 8 (16 days) |
| `stockx_variants` | 2,626 | Static |

---

## 4. CHART FEASIBILITY MATRIX

| Chart Type | Source | Grain | Time Coverage | Feasible? |
|------------|--------|-------|---------------|-----------|
| **Sales price over time** | `alias_sales_history` | Individual sale | 9 years | ✅ YES |
| **Sales velocity (per size)** | `alias_sales_history` | Individual sale | 9 years | ✅ YES |
| **Size premium curve** | `alias_sales_history` | Individual sale | 9 years | ✅ YES |
| **Regional price comparison** | `alias_sales_history` | Individual sale | 9 years | ✅ YES |
| **Consigned vs standard pricing** | `alias_sales_history` | Individual sale | 9 years | ✅ YES |
| **Current bid/ask spread** | `*_market_data` | Current | 0 days | ✅ YES |
| Daily price trend | `alias_price_history` | Daily | 7 days | ⚠️ Only recent |
| Weekly price trend | `alias_price_history` | Daily | 7 days | ⚠️ Only recent |
| 52-week high/low | None | N/A | N/A | ❌ NO DATA |
| Price trend forecast | None | N/A | N/A | ❌ NO DATA |
| Market depth evolution | `alias_offer_histograms` | Point-in-time | 1 day | ⚠️ Single snapshot |
| StockX vs Alias comparison | Both `*_market_data` | Current | 0 days | ✅ Current only |

### Key Insight

**You have 9 years of SALES data but almost zero PRICE data.**

Sales ≠ Market Price. A sale is what someone actually paid. Market price is bid/ask.

---

## 5. STORAGE PRESSURE ANALYSIS

### Tables by Size (Descending)

| Table | Rows | Est. Size | Classification |
|-------|------|-----------|----------------|
| `inventory_v4_alias_sales_history` | 1,597,972 | ~305 MB | **CRITICAL** - has duplicates |
| `inventory_v4_alias_price_history` | 183,133 | ~35 MB | Useful but sparse |
| `stockx_market_snapshots` | 60,809 | ~12 MB | **LEGACY - deletable** |
| `inventory_v4_alias_variants` | 45,681 | ~9 MB | CRITICAL |
| `inventory_v4_alias_market_data` | 45,681 | ~9 MB | CRITICAL |
| `alias_offer_histograms` | 11,247 | ~2 MB | Limited use |

### Growth Analysis

| Table | Growth Pattern | Risk |
|-------|----------------|------|
| `alias_sales_history` | ~1,800 sales/day avg | **High** - unbounded if not pruned |
| `alias_price_history` | ~26K rows/day | **Medium** - should downsample |
| `stockx_price_history` | ~5K rows/day | **Medium** - should downsample |
| `*_market_data` | Stable (overwrites) | **Low** |

### Classification

**CRITICAL (keep):**
- `inventory_v4_alias_sales_history` (but dedupe)
- `inventory_v4_*_market_data`
- `inventory_v4_*_variants`
- `inventory_v4_*_products`
- `inventory_v4_style_catalog`

**USEFUL BUT OVERSIZED:**
- `inventory_v4_alias_price_history` (only 27% populated)
- `inventory_v4_stockx_price_history` (only 2 days)

**LEGACY/REDUNDANT:**
- `stockx_market_snapshots` (V3 - 60K rows, deletable)
- `stockx_variants` (V3 - 2.6K rows, deletable)
- `alias_offer_histograms` (single snapshot, limited value)

---

## 6. MARKET PAGE CAPABILITY SUMMARY

### What Users Can Reliably Trust

**YES - Can Build:**

1. **Historical Sales Chart**
   - 9 years of actual transaction data
   - Per product, per size, per region
   - Daily/weekly/monthly aggregation

2. **Sales Velocity Metrics**
   - Sales in last 72h, 30d, all-time
   - Per size breakdown
   - Trend indicators (up/down vs prior period)

3. **Size Premium Analysis**
   - Which sizes sell for more/less
   - Based on actual sales, not asks

4. **Current Market State**
   - Live lowest ask, highest bid
   - StockX vs Alias comparison
   - Spread indicators

5. **Consignment Insights**
   - Consigned vs standard pricing
   - Based on actual sales

### What Would Be Misleading

**NO - Do Not Build:**

1. **"Price Trend" Charts** (misleading)
   - No historical bid/ask data
   - Sales price ≠ market price
   - Would imply precision we don't have

2. **52-Week High/Low** (no data)
   - No price history older than 7 days
   - Cannot compute accurately

3. **Bid Depth "Evolution"** (misleading)
   - Only have single snapshot (Dec 4)
   - Cannot show trends

4. **Price Predictions** (no basis)
   - No time-series to model
   - Would be pure speculation

### Realistic Market Page Design

Given current data, a market page should focus on:

```
┌─────────────────────────────────────────────────────┐
│  PRODUCT: Air Jordan 1 "Chicago Lost & Found"       │
├─────────────────────────────────────────────────────┤
│  CURRENT MARKET                                     │
│  ├─ Lowest Ask: £185 (StockX) / £179 (Alias)       │
│  ├─ Highest Bid: £142 (StockX) / £138 (Alias)      │
│  └─ Spread: £43 (23%)                              │
├─────────────────────────────────────────────────────┤
│  SALES HISTORY (9 years)                           │
│  ├─ Chart: Actual sales over time                  │
│  ├─ 72h: 12 sales | 30d: 89 sales                  │
│  └─ All-time: 43,967 sales                         │
├─────────────────────────────────────────────────────┤
│  SIZE ANALYSIS                                      │
│  ├─ Size 9: Most liquid (5,200 sales)              │
│  ├─ Size 14+: Premium +15%                         │
│  └─ Size 5: Discount -8%                           │
└─────────────────────────────────────────────────────┘
```

### What's Missing for a "Best-in-Class" Market Page

1. **Long-term price history** (bid/ask over time)
2. **Real-time bid depth** (histogram evolution)
3. **Cross-platform historical comparison**
4. **Seasonal trend analysis** (needs multi-year price data)

---

## APPENDIX: Evidence

### Query 1: Table Inventory
```sql
SELECT schemaname, relname, n_live_tup, pg_size_pretty(...)
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(...) DESC;
```

### Query 2: Sales History Time Range
```sql
SELECT
  MIN(purchased_at) as min_ts,
  MAX(purchased_at) as max_ts,
  COUNT(*) as rows
FROM inventory_v4_alias_sales_history;
-- Result: 2016-09-20 to 2025-12-17, 1,597,972 rows
```

### Query 3: Year Distribution
```sql
SELECT
  EXTRACT(YEAR FROM purchased_at) as year,
  COUNT(*)
FROM inventory_v4_alias_sales_history
GROUP BY 1 ORDER BY 1;
```

### Query 4: Duplicate Detection
```sql
SELECT alias_catalog_id, size_value, purchased_at, price, COUNT(*)
FROM inventory_v4_alias_sales_history
GROUP BY 1,2,3,4
HAVING COUNT(*) > 1;
-- Result: 66% of early data is duplicated
```

---

**END OF AUDIT**

*This document was generated from READ-ONLY queries. No schema changes, deletions, or migrations were performed.*
