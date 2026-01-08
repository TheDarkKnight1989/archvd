# Master Market Data Layer - Technical Reference

**Created:** December 3, 2025
**Purpose:** Comprehensive technical reference for master market data implementation
**Status:** Complete - StockX + Alias integrated, eBay integration pending

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Ingestion Pipeline](#ingestion-pipeline)
4. [API Client Methods](#api-client-methods)
5. [Type Definitions](#type-definitions)
6. [Helper Functions](#helper-functions)
7. [Feature Flags](#feature-flags)
8. [Key Technical Decisions](#key-technical-decisions)
9. [Integration Patterns](#integration-patterns)
10. [Testing & Validation](#testing--validation)

---

## Architecture Overview

### 4-Tier Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ TIER 1: API CLIENTS (Provider-Specific)                     │
│ - StockX: getMarketData()                                   │
│ - Alias: listPricingInsights() + getRecentSales()           │
│ - eBay: [PENDING INTEGRATION]                               │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ TIER 2: RAW SNAPSHOT LOGGING (Audit Trail)                  │
│ - stockx_raw_snapshots (JSONB storage)                      │
│ - alias_raw_snapshots (JSONB storage)                       │
│ - ebay_raw_snapshots [TO BE CREATED]                        │
│ Purpose: Complete API response preservation                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ TIER 3: INGESTION MAPPERS (Normalization)                   │
│ - ingestStockxMarketData()                                  │
│ - ingestAliasAvailabilities()                               │
│ - ingestAliasRecentSales()                                  │
│ - ingestEbayMarketData() [TO BE CREATED]                    │
│ Purpose: Transform raw → normalized schema                  │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ TIER 4: MASTER MARKET DATA (Unified Storage)                │
│ - master_market_data (main table, 38+ columns)              │
│ - master_market_latest (materialized view)                  │
│ Purpose: Single source of truth for all pricing             │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow for Each Provider

#### StockX Flow
```
getMarketData(productId, currency)
  ↓
withStockxSnapshot() → stockx_raw_snapshots
  ↓
ingestStockxMarketData(rawPayload)
  ↓ (creates 2 rows per size)
master_market_data
  - Row 1: is_flex=false (standard pricing)
  - Row 2: is_flex=true (flex pricing, if available)
```

#### Alias Flow
```
listPricingInsights(catalogId, regionId) + getRecentSales(catalogId)
  ↓ (parallel calls)
withAliasSnapshot() → alias_raw_snapshots (both responses)
  ↓
ingestAliasAvailabilities(availabilitiesPayload)
  ↓ (creates 1-2 rows per size)
master_market_data
  - Row 1: is_consigned=false (standard)
  - Row 2: is_consigned=true (consigned, if available)
  ↓
ingestAliasRecentSales(recentSalesPayload)
  ↓ (UPDATES existing rows with volume metrics)
master_market_data (volume fields populated)
```

#### eBay Flow (To Be Implemented)
```
[eBay API Client Method]
  ↓
[withEbaySnapshot()] → ebay_raw_snapshots
  ↓
[ingestEbayMarketData(rawPayload)]
  ↓
master_market_data
  - provider: 'ebay'
  - ebay-specific fields populated
```

---

## Database Schema

### 1. master_market_data (Main Table)

**File:** `supabase/migrations/20251203_create_master_market_data.sql`

```sql
CREATE TABLE public.master_market_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ═══════════════════════════════════════════════════════════════
  -- IDENTIFICATION (Composite Key)
  -- ═══════════════════════════════════════════════════════════════

  provider TEXT NOT NULL
    CHECK (provider IN ('stockx', 'alias', 'ebay', 'manual')),

  provider_source TEXT NOT NULL,           -- 'stockx_market_data', 'alias_availabilities', etc.
  provider_product_id TEXT NULL,           -- StockX: productId, Alias: catalog_id
  provider_variant_id TEXT NULL,           -- StockX: variantId, Alias: null

  sku TEXT NULL,                           -- Style code (e.g., "DD1391-100")
  size_key TEXT NOT NULL,                  -- Size display (e.g., "10.5", "UK 9")
  size_numeric NUMERIC(6,2) NULL,          -- Size as number for sorting (e.g., 10.5)
  size_system TEXT NULL DEFAULT 'US',      -- 'US', 'UK', 'EU', 'JP', 'OS'

  currency_code TEXT NOT NULL,             -- Original currency (USD, GBP, EUR)
  base_currency_code TEXT NULL,            -- User's base currency
  fx_rate NUMERIC(12,6) NULL,              -- Exchange rate

  region_code TEXT NULL,                   -- 'us', 'uk', 'eu', 'global', null

  -- ═══════════════════════════════════════════════════════════════
  -- PRICING DATA (in ORIGINAL CURRENCY, MAJOR UNITS)
  -- ═══════════════════════════════════════════════════════════════

  lowest_ask NUMERIC(12,4) NULL,           -- Best current asking price
  highest_bid NUMERIC(12,4) NULL,          -- Best current offer price
  last_sale_price NUMERIC(12,4) NULL,      -- Most recent sale price

  -- Normalized prices (in BASE CURRENCY)
  lowest_ask_base NUMERIC(12,4) NULL,
  highest_bid_base NUMERIC(12,4) NULL,
  last_sale_price_base NUMERIC(12,4) NULL,

  -- Spread metrics (auto-calculated)
  spread_absolute NUMERIC(12,4)
    GENERATED ALWAYS AS (
      CASE
        WHEN lowest_ask IS NOT NULL AND highest_bid IS NOT NULL
        THEN lowest_ask - highest_bid
        ELSE NULL
      END
    ) STORED,

  spread_percentage NUMERIC(8,3)
    GENERATED ALWAYS AS (
      CASE
        WHEN lowest_ask IS NOT NULL AND lowest_ask > 0 AND highest_bid IS NOT NULL
        THEN ((lowest_ask - highest_bid) / lowest_ask) * 100
        ELSE NULL
      END
    ) STORED,

  -- ═══════════════════════════════════════════════════════════════
  -- MARKET DEPTH & ACTIVITY
  -- ═══════════════════════════════════════════════════════════════

  sales_last_72h INTEGER NULL,            -- StockX + Alias (from recent_sales)
  sales_last_7d INTEGER NULL,
  sales_last_30d INTEGER NULL,             -- StockX + Alias (from recent_sales)
  total_sales_volume INTEGER NULL,         -- StockX only

  ask_count INTEGER NULL,                  -- Alias: number_of_listings
  bid_count INTEGER NULL,                  -- Alias: number_of_offers

  -- ═══════════════════════════════════════════════════════════════
  -- PROVIDER-SPECIFIC FIELDS
  -- ═══════════════════════════════════════════════════════════════

  -- StockX-specific
  average_deadstock_price NUMERIC(12,4) NULL,
  volatility NUMERIC(8,4) NULL,
  price_premium NUMERIC(8,4) NULL,

  -- Alias-specific
  global_indicator_price NUMERIC(12,4) NULL,

  -- eBay-specific (for future integration)
  ebay_sold_count_30d INTEGER NULL,
  ebay_avg_shipping NUMERIC(12,4) NULL,
  ebay_condition_id TEXT NULL,

  -- ═══════════════════════════════════════════════════════════════
  -- MULTI-TIER PRICING SUPPORT
  -- ═══════════════════════════════════════════════════════════════

  is_flex BOOLEAN DEFAULT FALSE,           -- StockX Flex pricing tier
  is_consigned BOOLEAN DEFAULT FALSE,      -- Alias consignment pricing tier
  flex_eligible BOOLEAN NULL,              -- StockX: can use flex
  consignment_fee_pct NUMERIC(5,2) NULL,   -- Alias: consignment fee %

  -- ═══════════════════════════════════════════════════════════════
  -- METADATA
  -- ═══════════════════════════════════════════════════════════════

  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_snapshot_id UUID NULL,               -- Reference to raw snapshot

  CONSTRAINT unique_market_snapshot UNIQUE (
    provider,
    provider_source,
    COALESCE(provider_product_id, '__null__'),
    COALESCE(provider_variant_id, '__null__'),
    size_key,
    currency_code,
    COALESCE(region_code, 'global'),
    COALESCE(is_flex, FALSE),
    COALESCE(is_consigned, FALSE),
    DATE_TRUNC('minute', snapshot_at)
  )
);

CREATE INDEX idx_master_market_data_provider_sku
  ON master_market_data (provider, sku, size_key);

CREATE INDEX idx_master_market_data_snapshot_at
  ON master_market_data (snapshot_at DESC);

CREATE INDEX idx_master_market_data_provider_product
  ON master_market_data (provider, provider_product_id);
```

**Key Points:**
- **38 columns total** (extensible for new providers)
- **Per-minute deduplication** via unique constraint
- **Separate rows** for pricing tiers (not separate columns)
- **All prices in MAJOR UNITS** (not cents)
- **Generated columns** for spread calculations
- **Indexes** for fast provider + SKU lookups

### 2. Raw Snapshot Tables

**File:** `supabase/migrations/20251203_create_raw_snapshot_tables.sql`

#### stockx_raw_snapshots
```sql
CREATE TABLE public.stockx_raw_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL,
  user_id UUID NULL,
  product_id TEXT NULL,
  sku TEXT NULL,
  size_numeric NUMERIC(6,2) NULL,
  currency_code TEXT NULL,
  response JSONB NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stockx_raw_snapshots_product
  ON stockx_raw_snapshots (product_id, snapshot_at DESC);

CREATE INDEX idx_stockx_raw_snapshots_sku
  ON stockx_raw_snapshots (sku, snapshot_at DESC);
```

#### alias_raw_snapshots
```sql
CREATE TABLE public.alias_raw_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL,                  -- 'availabilities', 'recent_sales', 'offer_histogram', etc.
  catalog_id TEXT NULL,
  size_value NUMERIC(6,2) NULL,
  currency_code TEXT NULL,
  region_id TEXT NULL,
  product_condition TEXT NULL,
  packaging_condition TEXT NULL,
  consigned BOOLEAN NULL,
  response JSONB NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alias_raw_snapshots_catalog
  ON alias_raw_snapshots (catalog_id, endpoint, snapshot_at DESC);
```

#### ebay_raw_snapshots (To Be Created)
```sql
-- Suggested structure for eBay integration:
CREATE TABLE public.ebay_raw_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL,
  item_id TEXT NULL,
  sku TEXT NULL,
  category_id TEXT NULL,
  condition_id TEXT NULL,
  response JSONB NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3. Materialized View

```sql
CREATE MATERIALIZED VIEW master_market_latest AS
SELECT DISTINCT ON (provider, provider_product_id, size_key, is_flex, is_consigned)
  *
FROM master_market_data
ORDER BY provider, provider_product_id, size_key, is_flex, is_consigned, snapshot_at DESC;

CREATE INDEX idx_master_market_latest_provider_sku
  ON master_market_latest (provider, sku, size_key);
```

**Refresh:**
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY master_market_latest;
```

---

## Ingestion Pipeline

### StockX Mapper

**File:** `src/lib/services/ingestion/stockx-mapper.ts`

#### Function: `ingestStockxMarketData()`

**Signature:**
```typescript
export async function ingestStockxMarketData(
  rawSnapshotId: string,
  rawPayload: any,
  options: {
    userId?: string;
    productId: string;
    sku?: string;
    currencyCode: string;
    snapshotAt: Date;
  }
): Promise<void>
```

**Logic:**
```typescript
// 1. Extract variants from rawPayload
const variants = rawPayload.variants || [];

// 2. Create rows for each variant
for (const variant of variants) {
  const baseRow = {
    provider: 'stockx',
    provider_source: 'stockx_market_data',
    provider_product_id: options.productId,
    provider_variant_id: variant.variantId,
    sku: options.sku,
    size_key: variant.sizeKey,
    size_numeric: parseFloat(variant.sizeKey),
    currency_code: options.currencyCode,
    flex_eligible: variant.isFlexEligible ?? null,
    is_consigned: false,
    snapshot_at: options.snapshotAt.toISOString(),
    raw_snapshot_id: rawSnapshotId,
  };

  // 3. Create STANDARD pricing row (is_flex=false)
  const standardRow = {
    ...baseRow,
    is_flex: false,
    lowest_ask: parsePrice(variant.lowestAskAmount),
    highest_bid: parsePrice(variant.highestBidAmount),
    last_sale_price: parsePrice(variant.lastSaleAmount),
    sales_last_72h: variant.sales72Hours,
    sales_last_30d: variant.sales30Days,
    total_sales_volume: variant.totalSales,
    average_deadstock_price: parsePrice(variant.averageDeadstockPrice),
    volatility: parseFloat(variant.volatility),
    price_premium: parseFloat(variant.pricePremium),
  };

  rows.push(standardRow);

  // 4. Create FLEX pricing row (is_flex=true) if flex data exists
  if (variant.flexLowestAskAmount || variant.flexHighestBidAmount) {
    const flexRow = {
      ...baseRow,
      is_flex: true,
      lowest_ask: parsePrice(variant.flexLowestAskAmount),
      highest_bid: parsePrice(variant.flexHighestBidAmount),
      // Note: Flex doesn't have separate volume/advanced metrics
      // These are shared with standard tier
    };

    rows.push(flexRow);
  }
}

// 5. Upsert to master_market_data
await supabase.from('master_market_data').upsert(rows);
```

**Key Points:**
- ⚠️ **Currency:** StockX returns major units as strings ("145.00") → use `parseFloat()` directly
- Creates **2 rows per size** when flex data exists
- Flex row shares same volume metrics as standard (StockX doesn't separate these)
- All advanced metrics (volatility, price_premium) only on standard row

### Alias Availability Mapper

**File:** `src/lib/services/ingestion/alias-mapper.ts`

#### Function: `ingestAliasAvailabilities()`

**Signature:**
```typescript
export async function ingestAliasAvailabilities(
  rawSnapshotId: string,
  rawPayload: { variants: AliasPricingVariant[] },
  options: {
    catalogId: string;
    regionId?: string;
    sku?: string;
    snapshotAt: Date;
    includeConsigned?: boolean;
  }
): Promise<void>
```

**Logic:**
```typescript
// 1. Filter to standard conditions (NEW + GOOD_CONDITION)
const STANDARD_CONDITIONS = {
  product_condition: 'new' as const,
  packaging_condition: 'good_condition' as const,
};

const filteredVariants = rawPayload.variants.filter(
  (v) =>
    v.product_condition === STANDARD_CONDITIONS.product_condition &&
    v.packaging_condition === STANDARD_CONDITIONS.packaging_condition
);

// 2. Separate by consignment status
const nonConsignedVariants = filteredVariants.filter((v) => !v.consigned);
const consignedVariants = filteredVariants.filter((v) => v.consigned);

const variantsToProcess = options.includeConsigned
  ? filteredVariants
  : nonConsignedVariants;

// 3. Create rows
for (const variant of variantsToProcess) {
  const availability = variant.availability;

  const row = {
    provider: 'alias',
    provider_source: 'alias_availabilities',
    provider_product_id: options.catalogId,
    provider_variant_id: null,
    sku: options.sku,
    size_key: variant.size.toString(),
    size_numeric: variant.size,
    currency_code: 'USD', // Alias always returns USD
    region_code: options.regionId || 'global',
    is_flex: false,
    is_consigned: variant.consigned || false,

    // ⚠️ CURRENCY CONVERSION: Alias returns CENTS, must convert to major units
    lowest_ask: parsePriceCents(availability?.lowest_listing_price_cents),
    highest_bid: parsePriceCents(availability?.highest_offer_price_cents),
    last_sale_price: parsePriceCents(availability?.last_sold_listing_price_cents),
    global_indicator_price: parsePriceCents(availability?.global_indicator_price_cents),

    ask_count: availability?.number_of_listings,
    bid_count: availability?.number_of_offers,

    // Volume metrics are NULL here, populated by ingestAliasRecentSales()
    sales_last_72h: null,
    sales_last_30d: null,

    snapshot_at: options.snapshotAt.toISOString(),
    raw_snapshot_id: rawSnapshotId,
  };

  rows.push(row);
}

// 4. Upsert to master_market_data
await supabase.from('master_market_data').upsert(rows);
```

**Helper Function:**
```typescript
function parsePriceCents(priceCentsString?: string): number | null {
  if (!priceCentsString) return null;
  const cents = parseInt(priceCentsString, 10);
  if (isNaN(cents)) return null;
  return cents / 100; // ⚠️ CONVERT CENTS → MAJOR UNITS
}
```

**Key Points:**
- ⚠️ **Currency:** Alias returns CENTS as strings ("14500") → must divide by 100
- Creates **1-2 rows per size** (depending on `includeConsigned` option)
- Volume metrics start as NULL, get populated by `ingestAliasRecentSales()`
- Filters to NEW + GOOD_CONDITION only (locked standard)

### Alias Recent Sales Mapper

**File:** `src/lib/services/ingestion/alias-mapper.ts`

#### Function: `ingestAliasRecentSales()`

**Signature:**
```typescript
export async function ingestAliasRecentSales(
  rawSnapshotId: string,
  rawPayload: { recent_sales: RecentSale[] },
  options: {
    catalogId: string;
    regionId?: string;
    sku?: string;
    snapshotAt: Date;
  }
): Promise<void>
```

**Logic:**
```typescript
// 1. Group sales by size + consignment status
const salesBySize = new Map<string, Map<boolean, RecentSale[]>>();

for (const sale of rawPayload.recent_sales) {
  const sizeKey = sale.size.toString();
  const consignedKey = sale.consigned;

  if (!salesBySize.has(sizeKey)) {
    salesBySize.set(sizeKey, new Map());
  }

  const sizeMap = salesBySize.get(sizeKey)!;
  if (!sizeMap.has(consignedKey)) {
    sizeMap.set(consignedKey, []);
  }

  sizeMap.get(consignedKey)!.push(sale);
}

// 2. Calculate volume metrics for each group
const now = new Date();
const cutoff72h = new Date(now.getTime() - 72 * 60 * 60 * 1000);
const cutoff30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

const updates: Array<{
  sizeKey: string;
  isConsigned: boolean;
  sales72h: number;
  sales30d: number;
  lastSalePrice: number;
  lastSaleAt: Date;
  volume30d: number;
}> = [];

for (const [sizeKey, consignedMap] of salesBySize) {
  for (const [isConsigned, sales] of consignedMap) {
    // Sort by date descending
    const sortedSales = sales.sort(
      (a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime()
    );

    const sales72h = sortedSales.filter(
      (s) => new Date(s.purchased_at) >= cutoff72h
    ).length;

    const sales30d = sortedSales.filter(
      (s) => new Date(s.purchased_at) >= cutoff30d
    ).length;

    const lastSale = sortedSales[0];
    const lastSalePrice = parseInt(lastSale.price_cents) / 100; // ⚠️ CONVERT CENTS
    const lastSaleAt = new Date(lastSale.purchased_at);

    updates.push({
      sizeKey,
      isConsigned,
      sales72h,
      sales30d,
      lastSalePrice,
      lastSaleAt,
      volume30d: sales30d,
    });
  }
}

// 3. UPDATE existing rows in master_market_data
for (const update of updates) {
  await supabase
    .from('master_market_data')
    .update({
      sales_last_72h: update.sales72h,
      sales_last_30d: update.sales30d,
      last_sale_price: update.lastSalePrice,
      last_sale_at: update.lastSaleAt.toISOString(),
      total_sales_volume: update.volume30d,
      ingested_at: new Date().toISOString(),
    })
    .eq('provider', 'alias')
    .eq('provider_product_id', options.catalogId)
    .eq('size_key', update.sizeKey)
    .eq('is_consigned', update.isConsigned);
}
```

**Key Points:**
- ⚠️ **UPDATES existing rows**, does NOT insert new rows
- Must run AFTER `ingestAliasAvailabilities()`
- Groups by size + consignment status
- Calculates sales counts for 72h and 30d windows
- Updates `last_sale_price` with most recent sale (overrides value from availabilities)

---

## API Client Methods

### StockX Client

**File:** `src/lib/services/stockx/market.ts`

```typescript
export async function getMarketData(
  productId: string,
  currencyCode: string = 'USD'
): Promise<StockxMarketResponse> {
  return await withStockxSnapshot(
    `products/${productId}/market`,
    async () => {
      const response = await fetch(
        `https://api.stockx.com/v2/products/${productId}/market?currencyCode=${currencyCode}`,
        {
          headers: {
            'x-api-key': process.env.STOCKX_API_KEY!,
          },
        }
      );

      return response.json();
    },
    {
      productId,
      currencyCode,
    }
  );
}
```

### Alias Client

**File:** `src/lib/services/alias/client.ts`

#### Method: `listPricingInsights()`

```typescript
async listPricingInsights(
  catalogId: string,
  regionId?: string,
  sizeValue?: number
): Promise<ListPricingInsightsResponse> {
  const params = new URLSearchParams({ catalog_id: catalogId });
  if (regionId) params.append('region_id', regionId);
  if (sizeValue) params.append('size', sizeValue.toString());

  return await withAliasSnapshot(
    'availabilities',
    () => this.request<ListPricingInsightsResponse>(
      `/pricing_insights/list?${params}`
    ),
    { catalogId, regionId, sizeValue }
  );
}
```

#### Method: `getRecentSales()`

```typescript
async getRecentSales(params: {
  catalog_id: string;
  size?: number;
  limit?: number;
  product_condition?: ProductCondition;
  packaging_condition?: PackagingCondition;
  consigned?: boolean;
  region_id?: string;
}): Promise<RecentSalesResponse> {
  const searchParams = new URLSearchParams({
    catalog_id: params.catalog_id,
  });

  if (params.size !== undefined) {
    searchParams.append('size', params.size.toString());
  }
  if (params.limit !== undefined) {
    searchParams.append('limit', params.limit.toString());
  }
  // ... other params

  return await withAliasSnapshot(
    'recent_sales',
    () => this.request<RecentSalesResponse>(
      `/pricing_insights/recent_sales?${searchParams}`
    ),
    {
      catalogId: params.catalog_id,
      sizeValue: params.size,
      regionId: params.region_id,
      productCondition: params.product_condition,
      packagingCondition: params.packaging_condition,
      consigned: params.consigned,
    }
  );
}
```

**⚠️ KNOWN LIMITATION:** The `recent_sales` endpoint REQUIRES a `size` parameter. You cannot fetch all sizes at once.

**Current Implementation:** First version calls without size parameter, which fails gracefully.

**Fix Needed:**
```typescript
// TODO: Loop through sizes from availabilities
const availabilities = await client.listPricingInsights(catalogId);
for (const variant of availabilities.variants) {
  const recentSales = await client.getRecentSales({
    catalog_id: catalogId,
    size: variant.size,  // ← Pass size here
    limit: 100,
  });
  await ingestAliasRecentSales(snapshotId, recentSales, options);
}
```

#### Method: `getOfferHistogram()`

```typescript
async getOfferHistogram(params: {
  catalog_id: string;
  size: number;
  region_id?: string;
  product_condition?: ProductCondition;
  packaging_condition?: PackagingCondition;
  consigned?: boolean;
}): Promise<OfferHistogramResponse> {
  // Wrapped with withAliasSnapshot()
  // Logs to alias_raw_snapshots
  // NOT called in bulk sync (too large)
}
```

#### Method: `getListingHistogram()`

```typescript
async getListingHistogram(params: {
  catalog_id: string;
  size: number;
  region_id?: string;
  product_condition?: ProductCondition;
  packaging_condition?: PackagingCondition;
  consigned?: boolean;
}): Promise<ListingHistogramResponse> {
  // Same pattern as getOfferHistogram()
}
```

### Unified Sync Function

**File:** `src/lib/services/alias/sync.ts`

```typescript
export async function syncAliasToMasterMarketData(
  client: AliasClient,
  catalogId: string,
  options: {
    sku?: string;
    regionId?: string;
    includeConsigned?: boolean;
  } = {}
): Promise<MasterMarketDataSyncResult> {
  const { sku, regionId, includeConsigned = true } = options;
  const recentSalesEnabled = process.env.ALIAS_RECENT_SALES_ENABLED === 'true';

  console.log('[Alias Master Sync] Starting sync for catalog:', catalogId, {
    sku,
    regionId,
    includeConsigned,
    recentSalesEnabled,
  });

  try {
    // Step 1: Fetch availabilities (all sizes)
    console.log('[Alias Master Sync] Fetching availabilities...');
    const availabilities = await client.listPricingInsights(
      catalogId,
      regionId,
      undefined // No size filter - get all sizes
    );

    console.log('[Alias Master Sync] Found', availabilities.variants.length, 'availability variants');

    // Step 2: Ingest availabilities (INSERT rows)
    console.log('[Alias Master Sync] Ingesting availabilities...');
    const ingestionResult = await ingestAliasAvailabilities(
      rawSnapshotId,
      availabilities,
      {
        catalogId,
        regionId,
        sku,
        snapshotAt: new Date(),
        includeConsigned,
      }
    );

    let volumeMetricsUpdated = 0;

    // Step 3: Fetch recent sales (if enabled)
    if (recentSalesEnabled) {
      console.log('[Alias Master Sync] Fetching recent sales (feature flag enabled)...');

      try {
        const recentSales = await client.getRecentSales({
          catalog_id: catalogId,
          limit: 100,
          region_id: regionId,
        });

        console.log('[Alias Master Sync] Found', recentSales.recent_sales.length, 'recent sales');

        // Step 4: Ingest recent sales (UPDATE volume metrics)
        await ingestAliasRecentSales(
          recentSalesSnapshotId,
          recentSales,
          {
            catalogId,
            regionId,
            sku,
            snapshotAt: new Date(),
          }
        );

        volumeMetricsUpdated = recentSales.recent_sales.length;
        console.log('[AliasRecentSales] ✅ Updated volume metrics for catalog_id=', catalogId);
      } catch (recentSalesError) {
        // Non-fatal error - availabilities already ingested
        console.warn('[Alias Master Sync] ⚠️ Recent sales failed (non-fatal):', recentSalesError.message);
      }
    } else {
      console.log('[Alias Master Sync] Recent sales DISABLED (ALIAS_RECENT_SALES_ENABLED=false)');
    }

    console.log('[Alias Master Sync] ✅ Complete:', {
      catalogId,
      sku,
      variantsIngested: availabilities.variants.length,
      volumeMetricsUpdated,
      recentSalesEnabled,
    });

    return {
      success: true,
      catalogId,
      sku,
      variantsIngested: availabilities.variants.length,
      volumeMetricsUpdated,
    };
  } catch (error) {
    console.error('[Alias Master Sync] ❌ Failed:', error);
    return {
      success: false,
      catalogId,
      sku,
      variantsIngested: 0,
      volumeMetricsUpdated: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

**Return Type:**
```typescript
interface MasterMarketDataSyncResult {
  success: boolean;
  catalogId: string;
  sku?: string;
  variantsIngested: number;      // Number of availability rows inserted
  volumeMetricsUpdated: number;  // Number of recent_sales processed
  error?: string;
}
```

---

## Type Definitions

### Alias Types

**File:** `src/lib/services/alias/types.ts`

```typescript
// Recent Sales
export interface RecentSale {
  purchased_at: string;       // ISO 8601 timestamp
  price_cents: string;        // Sale price in CENTS as STRING (must convert)
  size: number;               // Numeric size
  consigned: boolean;         // Consignment flag
  catalog_id: string;         // Catalog ID
}

export interface RecentSalesResponse {
  recent_sales: RecentSale[];
}

// Pricing Insights
export interface AliasPricingVariant {
  size: number;
  size_unit?: string;                        // Added for compatibility
  product_condition: ProductCondition;
  packaging_condition: PackagingCondition;
  consigned?: boolean;
  availability: AliasAvailability | null;    // Made nullable
}

export interface AliasAvailability {
  lowest_listing_price_cents?: string;
  highest_offer_price_cents?: string;
  last_sold_listing_price_cents?: string;
  global_indicator_price_cents?: string;
  number_of_listings?: number;               // Added
  number_of_offers?: number;                 // Added
}

export type ProductCondition = 'new' | 'used';
export type PackagingCondition = 'good_condition' | 'damaged';

// Histograms
export interface OfferHistogramResponse {
  buckets: Array<{
    price_cents: string;
    quantity: number;
  }>;
}

export interface ListingHistogramResponse {
  buckets: Array<{
    price_cents: string;
    quantity: number;
  }>;
}
```

### StockX Types

**File:** `src/lib/services/stockx/types.ts` (inferred from usage)

```typescript
interface StockxMarketResponse {
  variants: Array<{
    variantId: string;
    sizeKey: string;
    lowestAskAmount: string;           // Major units as string
    highestBidAmount: string;
    flexLowestAskAmount?: string;      // Flex pricing (if eligible)
    flexHighestBidAmount?: string;
    lastSaleAmount: string;
    sales72Hours: number;
    sales30Days: number;
    totalSales: number;
    averageDeadstockPrice: string;
    volatility: string;                // "0.12" = 12%
    pricePremium: string;              // "0.35" = 35%
    isFlexEligible: boolean;
  }>;
}
```

---

## Helper Functions

**File:** `src/lib/services/market-pricing-helpers.ts`

### `getAllPricingOptions()`

Get all pricing tiers (standard + flex + consigned) for a product/size.

```typescript
export async function getAllPricingOptions(
  sku: string,
  sizeKey: string,
  currencyCode: string = 'USD'
): Promise<AllPricingOptions> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('master_market_latest')
    .select('*')
    .eq('sku', sku)
    .eq('size_key', sizeKey)
    .eq('currency_code', currencyCode);

  if (error) throw error;

  const stockxStandard = data?.find((r) => r.provider === 'stockx' && !r.is_flex) || null;
  const stockxFlex = data?.find((r) => r.provider === 'stockx' && r.is_flex) || null;
  const aliasStandard = data?.find((r) => r.provider === 'alias' && !r.is_consigned) || null;
  const aliasConsigned = data?.find((r) => r.provider === 'alias' && r.is_consigned) || null;

  return {
    stockx: {
      standard: stockxStandard,
      flex: stockxFlex,
    },
    alias: {
      standard: aliasStandard,
      consigned: aliasConsigned,
    },
  };
}
```

### `getStandardPricing()`

Get only standard pricing (exclude flex/consigned).

```typescript
export async function getStandardPricing(
  sku: string,
  sizeKey: string,
  currencyCode: string = 'USD'
): Promise<{ stockx: PriceData | null; alias: PriceData | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('master_market_latest')
    .select('*')
    .eq('sku', sku)
    .eq('size_key', sizeKey)
    .eq('currency_code', currencyCode)
    .eq('is_flex', false)
    .eq('is_consigned', false);

  if (error) throw error;

  return {
    stockx: data?.find((r) => r.provider === 'stockx') || null,
    alias: data?.find((r) => r.provider === 'alias') || null,
  };
}
```

### `getBestPrice()`

Get absolute best price across all options (all providers, all tiers).

```typescript
export async function getBestPrice(
  sku: string,
  sizeKey: string,
  currencyCode: string = 'USD'
): Promise<{
  provider: string;
  lowest_ask: number;
  is_flex: boolean;
  is_consigned: boolean;
  snapshot_at: string;
} | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('master_market_latest')
    .select('*')
    .eq('sku', sku)
    .eq('size_key', sizeKey)
    .eq('currency_code', currencyCode)
    .not('lowest_ask', 'is', null)
    .order('lowest_ask', { ascending: true })
    .limit(1)
    .single();

  if (error || !data) return null;

  return {
    provider: data.provider,
    lowest_ask: data.lowest_ask,
    is_flex: data.is_flex,
    is_consigned: data.is_consigned,
    snapshot_at: data.snapshot_at,
  };
}
```

---

## Feature Flags

### `ALIAS_RECENT_SALES_ENABLED`

**Type:** Boolean (string "true" or "false")
**Default:** false (if unset)

**Purpose:** Control whether `recent_sales` endpoint is called during Alias sync.

**Behavior:**
- `true`: Calls both availabilities + recent_sales, populates volume metrics
- `false` or unset: Only calls availabilities, volume metrics remain NULL

**Set in:**
```bash
# Production
vercel env add ALIAS_RECENT_SALES_ENABLED production
# Value: true

# Local
echo "ALIAS_RECENT_SALES_ENABLED=true" >> .env.local
```

**Usage in code:**
```typescript
const recentSalesEnabled = process.env.ALIAS_RECENT_SALES_ENABLED === 'true';

if (recentSalesEnabled) {
  const recentSales = await client.getRecentSales({
    catalog_id: catalogId,
    limit: 100,
  });
  await ingestAliasRecentSales(snapshotId, recentSales, options);
}
```

**Why it exists:**
- API limitation: recent_sales requires size parameter (not implemented in loop yet)
- Controlled rollout: Enable after testing
- Non-fatal: If recent_sales fails, availabilities still work

---

## Key Technical Decisions

### 1. Separate Rows for Pricing Tiers

**Decision:** Store Standard, Flex, and Consigned pricing as **separate rows**, not columns.

**Rationale:**
- ✅ Preserves time-series integrity (each tier can snapshot at different times)
- ✅ Allows independent refresh schedules
- ✅ Simpler queries (`WHERE is_flex = true`)
- ✅ Scales to future pricing tiers without schema changes
- ✅ Avoids NULL columns when tiers don't exist

**Example:**
```sql
-- Jordan 1 Low Panda, Size 10.5 → 4 separate rows:
SELECT provider, is_flex, is_consigned, lowest_ask
FROM master_market_data
WHERE sku = 'DD1391-100' AND size_key = '10.5';

-- Result:
-- stockx  | false | false | 145.00  (standard)
-- stockx  | true  | false | 142.00  (flex)
-- alias   | false | false | 142.00  (standard)
-- alias   | false | true  | 138.00  (consigned)
```

### 2. Currency Normalization (MAJOR UNITS)

**Decision:** Store all prices in **MAJOR UNITS** (dollars/pounds), not cents.

**Rationale:**
- ✅ Consistent with financial conventions
- ✅ Easier to read and debug
- ✅ Avoids provider-specific confusion
- ✅ SQL math operations simpler

**Implementation:**
```typescript
// StockX: Returns major units as strings
const stockxPrice = parseFloat("145.00"); // → 145.00 ✅

// Alias: Returns CENTS as strings, MUST CONVERT
const aliasPrice = parseInt("14500") / 100; // → 145.00 ✅
```

**⚠️ CRITICAL:** Every Alias price field must be divided by 100 after parsing.

### 3. Two-Phase Ingestion for Alias

**Decision:** Insert availabilities first, then UPDATE with recent_sales volume metrics.

**Rationale:**
- ✅ availabilities has all sizes, recent_sales requires size parameter
- ✅ Non-fatal: If recent_sales fails, rows still exist with NULL volume
- ✅ Feature-flagged: Can enable recent_sales independently
- ✅ Matches API structure (2 separate endpoints)

**Flow:**
```
1. ingestAliasAvailabilities()
   → INSERT rows with sales_last_72h=NULL, sales_last_30d=NULL

2. ingestAliasRecentSales()
   → UPDATE rows SET sales_last_72h=X, sales_last_30d=Y
```

### 4. Per-Minute Deduplication

**Decision:** Unique constraint includes `DATE_TRUNC('minute', snapshot_at)`.

**Rationale:**
- ✅ Prevents duplicate snapshots within same minute
- ✅ Allows multiple snapshots per day (time-series data)
- ✅ Balances granularity vs storage

**Unique Constraint:**
```sql
UNIQUE (
  provider,
  provider_product_id,
  size_key,
  currency_code,
  region_code,
  is_flex,
  is_consigned,
  DATE_TRUNC('minute', snapshot_at)  -- ← Per-minute dedup
)
```

### 5. Raw Snapshot Logging

**Decision:** Log complete API responses before processing.

**Rationale:**
- ✅ Debugging: Can replay ingestion if mapper has bugs
- ✅ Compliance: Audit trail for price data
- ✅ Re-ingestion: Can backfill if schema changes
- ✅ API monitoring: Detect when providers change response format

**Pattern:**
```typescript
return await withStockxSnapshot(
  'endpoint-name',
  async () => {
    const response = await fetch(apiUrl);
    return response.json();
  },
  { metadata }
);
// Response is logged to stockx_raw_snapshots BEFORE being returned
```

---

## Integration Patterns

### Pattern 1: Add New Provider (eBay Example)

1. **Create raw snapshot table:**
```sql
CREATE TABLE ebay_raw_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL,
  item_id TEXT NULL,
  sku TEXT NULL,
  response JSONB NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

2. **Create API client wrapper:**
```typescript
export async function withEbaySnapshot<T>(
  endpoint: string,
  fetcher: () => Promise<T>,
  metadata: { itemId?: string; sku?: string }
): Promise<T> {
  const response = await fetcher();

  await supabase.from('ebay_raw_snapshots').insert({
    endpoint,
    item_id: metadata.itemId,
    sku: metadata.sku,
    response,
    snapshot_at: new Date().toISOString(),
  });

  return response;
}
```

3. **Create ingestion mapper:**
```typescript
export async function ingestEbayMarketData(
  rawSnapshotId: string,
  rawPayload: any,
  options: { itemId: string; sku?: string; snapshotAt: Date }
): Promise<void> {
  const rows = [];

  for (const item of rawPayload.items) {
    rows.push({
      provider: 'ebay',
      provider_source: 'ebay_completed_listings',
      provider_product_id: options.itemId,
      sku: options.sku,
      size_key: item.size,
      currency_code: item.currency,

      // eBay-specific: Use "Buy It Now" price as lowest_ask
      lowest_ask: parseFloat(item.buyItNowPrice),

      // eBay-specific fields
      ebay_sold_count_30d: item.soldCount,
      ebay_avg_shipping: parseFloat(item.avgShipping),
      ebay_condition_id: item.conditionId,

      snapshot_at: options.snapshotAt.toISOString(),
      raw_snapshot_id: rawSnapshotId,
    });
  }

  await supabase.from('master_market_data').upsert(rows);
}
```

4. **Create sync function:**
```typescript
export async function syncEbayToMasterMarketData(
  client: EbayClient,
  itemId: string,
  options: { sku?: string }
): Promise<MasterMarketDataSyncResult> {
  const data = await client.getCompletedListings(itemId);
  await ingestEbayMarketData(rawSnapshotId, data, {
    itemId,
    sku: options.sku,
    snapshotAt: new Date(),
  });

  return { success: true, variantsIngested: data.items.length };
}
```

### Pattern 2: Add Provider-Specific Field

1. **Add column to master_market_data:**
```sql
ALTER TABLE master_market_data
  ADD COLUMN new_provider_field NUMERIC(12,4) NULL;
```

2. **Update ingestion mapper:**
```typescript
rows.push({
  // ... existing fields
  new_provider_field: parseFloat(variant.newField),
});
```

3. **Update helper functions if needed:**
```typescript
export async function getProviderSpecificData(sku: string) {
  const { data } = await supabase
    .from('master_market_latest')
    .select('new_provider_field')
    .eq('sku', sku);

  return data;
}
```

### Pattern 3: Refresh Materialized View

**Manual refresh:**
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY master_market_latest;
```

**Automated refresh (cron job approach):**
```typescript
// src/app/api/cron/refresh-market-views/route.ts
export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase.rpc('refresh_market_views');

  return NextResponse.json({ success: true });
}
```

**Database function:**
```sql
CREATE OR REPLACE FUNCTION refresh_market_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY master_market_latest;
END;
$$ LANGUAGE plpgsql;
```

---

## Testing & Validation

### Integration Test

**File:** `scripts/test-alias-integration.ts`

**Usage:**
```bash
export ALIAS_RECENT_SALES_ENABLED=true
export TEST_ALIAS_CATALOG_ID="tom-sachs-x-nikecraft-mars-yard-2-0-aa2261-100"
npx tsx scripts/test-alias-integration.ts
```

**What it tests:**
1. ✅ Sync function completes successfully
2. ✅ Rows inserted into master_market_data
3. ✅ Volume metrics populated (if feature flag enabled)
4. ✅ Price data in correct units (not cents)
5. ✅ Consignment tiers created (if available)

### Validation Script

**File:** `scripts/validate-master-market-data.ts`

**Usage:**
```bash
npx tsx scripts/validate-master-market-data.ts
```

**Checks:**
1. ✅ Provider field matches allowed values
2. ✅ Prices are reasonable (not in cents)
3. ✅ Volume metrics present for Alias (if feature enabled)
4. ✅ Flex pricing exists for eligible StockX products
5. ✅ Timestamps are recent
6. ✅ No duplicate snapshots within same minute
7. ✅ Currency codes are valid
8. ✅ Spread calculations are correct
9. ✅ Base currency conversion (if FX rate present)
10. ✅ Provider-specific fields populated correctly

---

## Query Examples

### Cross-Provider Comparison

```sql
SELECT
  provider,
  size_key,
  is_flex,
  is_consigned,
  lowest_ask,
  highest_bid,
  sales_last_30d,
  volatility,
  snapshot_at
FROM master_market_data
WHERE sku = 'DD1391-100'
  AND size_key = '10.5'
  AND snapshot_at >= NOW() - INTERVAL '1 hour'
ORDER BY provider, is_flex, is_consigned;
```

### Find Best Price Across All Tiers

```sql
SELECT
  provider,
  is_flex,
  is_consigned,
  lowest_ask,
  snapshot_at
FROM master_market_data
WHERE sku = 'DD1391-100'
  AND size_key = '10.5'
  AND lowest_ask IS NOT NULL
ORDER BY lowest_ask ASC
LIMIT 1;
```

### Flex Savings Analysis

```sql
SELECT
  sku,
  size_key,
  MAX(CASE WHEN is_flex = false THEN lowest_ask END) AS standard_ask,
  MAX(CASE WHEN is_flex = true THEN lowest_ask END) AS flex_ask,
  MAX(CASE WHEN is_flex = false THEN lowest_ask END) -
  MAX(CASE WHEN is_flex = true THEN lowest_ask END) AS flex_savings,
  ROUND(
    ((MAX(CASE WHEN is_flex = false THEN lowest_ask END) -
      MAX(CASE WHEN is_flex = true THEN lowest_ask END)) /
     MAX(CASE WHEN is_flex = false THEN lowest_ask END)) * 100,
    2
  ) AS savings_pct
FROM master_market_data
WHERE provider = 'stockx'
  AND sku = 'DD1391-100'
GROUP BY sku, size_key
HAVING MAX(CASE WHEN is_flex = true THEN lowest_ask END) IS NOT NULL;
```

### Volume Trending

```sql
SELECT
  sku,
  size_key,
  provider,
  sales_last_72h,
  sales_last_30d,
  ROUND(sales_last_72h::NUMERIC / 3, 2) AS avg_daily_sales,
  snapshot_at
FROM master_market_data
WHERE provider IN ('stockx', 'alias')
  AND sales_last_30d > 20
ORDER BY sales_last_30d DESC
LIMIT 20;
```

### High Volatility Scanner

```sql
SELECT
  sku,
  size_key,
  lowest_ask,
  volatility,
  price_premium,
  sales_last_30d,
  snapshot_at
FROM master_market_data
WHERE provider = 'stockx'
  AND volatility > 0.15  -- High volatility (>15%)
  AND sales_last_30d > 50  -- High volume
  AND snapshot_at >= NOW() - INTERVAL '24 hours'
ORDER BY volatility DESC
LIMIT 10;
```

### Price History (Time-Series)

```sql
SELECT
  DATE_TRUNC('hour', snapshot_at) AS hour,
  AVG(lowest_ask) AS avg_ask,
  MIN(lowest_ask) AS min_ask,
  MAX(lowest_ask) AS max_ask,
  COUNT(*) AS snapshot_count
FROM master_market_data
WHERE sku = 'DD1391-100'
  AND size_key = '10.5'
  AND provider = 'stockx'
  AND is_flex = false
  AND snapshot_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', snapshot_at)
ORDER BY hour DESC;
```

---

## Known Limitations & Future Work

### Current Limitations

1. **Alias recent_sales API Constraint**
   - Endpoint requires `size` parameter
   - Cannot fetch all sizes at once
   - Current implementation: Calls without size (fails gracefully)
   - **Fix needed:** Loop through sizes from availabilities response

2. **Materialized View Manual Refresh**
   - `master_market_latest` doesn't auto-refresh
   - Must run: `REFRESH MATERIALIZED VIEW CONCURRENTLY master_market_latest;`
   - **Fix needed:** Cron job or trigger-based refresh

3. **Histograms Not Auto-Synced**
   - Histogram endpoints wrapped but not called in bulk sync
   - Reason: Too large (10-20 buckets × 20 sizes = 200+ rows per product)
   - **Solution:** Call on-demand from UI for market depth charts

### Future Enhancements

1. **eBay Integration** (Priority: High)
   - Create ebay_raw_snapshots table
   - Implement eBay API client wrapper
   - Create ingestEbayMarketData() mapper
   - Add eBay-specific fields to schema

2. **Bulk Sync Automation** (Priority: High)
   - Create `/api/cron/market/refresh` route
   - Sync all inventory products
   - Rate limiting (500ms delay between calls)
   - Error handling and retry logic

3. **Stale Data Detection** (Priority: Medium)
   - Alert if snapshots > 2 hours old
   - Dashboard showing last sync time per product
   - Auto-refresh stale products

4. **Advanced Metrics** (Priority: Medium)
   - Price prediction using historical data
   - Arbitrage opportunity scanner
   - Profit margin calculator (factoring fees)
   - Multi-currency conversion

5. **Performance Optimization** (Priority: Low)
   - Partition master_market_data by snapshot_at
   - Index optimization for common queries
   - Background worker for large syncs

---

## Migration Status

### Applied Migrations
1. ✅ `20251203_create_raw_snapshot_tables.sql`
2. ✅ `20251203_create_master_market_data.sql`
3. ✅ `20251203_add_flex_consigned_support.sql`

### Pending Migrations
None

### Future Migrations
- eBay raw snapshots table
- Additional provider-specific columns as needed
- Performance indexes

---

## Environment Variables Reference

```bash
# Alias API
ALIAS_PAT=goatapi_xxxxxxxxxxxxx
ALIAS_RECENT_SALES_ENABLED=true

# StockX API
STOCKX_API_KEY=xxxxxxxxxxxxx

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxxxxxxxxxx

# eBay API (future)
# EBAY_APP_ID=xxxxxxxxxxxxx
# EBAY_CERT_ID=xxxxxxxxxxxxx
```

---

## Documentation Index

1. **[MASTER_MARKET_DATA_EXECUTIVE_SUMMARY.md](MASTER_MARKET_DATA_EXECUTIVE_SUMMARY.md)** - High-level overview
2. **[WORK_COMPLETE_SUMMARY.md](WORK_COMPLETE_SUMMARY.md)** - Phase completion summary
3. **[DEPLOYMENT_STATUS_MASTER_MARKET_DATA.md](DEPLOYMENT_STATUS_MASTER_MARKET_DATA.md)** - Deployment guide
4. **[APPLY_MIGRATIONS.md](APPLY_MIGRATIONS.md)** - Migration instructions
5. **[MASTER_MARKET_DATA_COMPLETE_AUDIT.md](MASTER_MARKET_DATA_COMPLETE_AUDIT.md)** - API coverage
6. **[MASTER_MARKET_DATA_TECHNICAL_REFERENCE.md](MASTER_MARKET_DATA_TECHNICAL_REFERENCE.md)** - This file
7. **[PHASE_0_AUDIT.md](PHASE_0_AUDIT.md)** - Endpoint audit
8. **[PHASE_1_COMPLETE.md](PHASE_1_COMPLETE.md)** - Recent sales details
9. **[ALIAS_RECENT_SALES_WIRED.md](ALIAS_RECENT_SALES_WIRED.md)** - Integration guide
10. **[FLEX_CONSIGNED_PRICING.md](FLEX_CONSIGNED_PRICING.md)** - Multi-tier guide

---

**Last Updated:** December 3, 2025
**Status:** Complete reference for StockX + Alias integration
**Next:** eBay integration
