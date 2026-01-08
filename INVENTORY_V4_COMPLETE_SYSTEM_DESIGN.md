# ARCHVD Inventory V4 — Complete System Design

> **Version**: 1.0
> **Last Updated**: December 2024
> **Namespace**: All new code under `v4` suffix/prefix

---

## Table of Contents

1. [Executive Summary](#part-1-executive-summary)
2. [Design Philosophy](#part-2-design-philosophy)
3. [ARCHVD Smart Pricing](#part-3-archvd-smart-pricing)
4. [Fee-Adjusted Net Profit](#part-4-fee-adjusted-net-profit)
5. [Data Architecture](#part-5-data-architecture)
6. [Search & Resolution Flow](#part-6-search--resolution-flow)
7. [Sync Queue System](#part-7-sync-queue-system)
8. [Add Item Modal Flow](#part-8-add-item-modal-flow)
9. [Inventory Table & Row States](#part-9-inventory-table--row-states)
10. [Component Architecture](#part-10-component-architecture)
11. [API Endpoints](#part-11-api-endpoints)
12. [Implementation Phases](#part-12-implementation-phases)
13. [File Structure](#part-13-file-structure)
14. [Testing Strategy](#part-14-testing-strategy)

---

## Part 1: Executive Summary

### What We're Building

A premium inventory management system that:
1. Shows a single trusted **ARCHVD Market Price** (like Kelley Blue Book for sneakers)
2. Calculates **real profit after fees** (not misleading gross profit)
3. Recommends **which platform to sell on** for maximum profit
4. Lets users **search by name or SKU** across our database + StockX + Alias
5. **Syncs new SKUs automatically** when users add items we haven't seen before
6. Handles all **UI states gracefully** (syncing, ready, failed, no data)

### Key Differentiators

| Feature | Competitors | ARCHVD |
|---------|-------------|--------|
| Market price | Single platform | Unified across StockX + Alias |
| Profit calculation | Gross (misleading) | Net after fees (honest) |
| Platform recommendation | None | "Sell on Alias for £10 more" |
| Unknown SKUs | Error or manual | Auto-sync from APIs |
| Search | SKU only | SKU, name, URL |

---

## Part 2: Design Philosophy

### Core Principles

1. **Single Source of Truth**
   - `inventory_v4_style_catalog.style_id` is THE canonical SKU identifier
   - No duplicate lookup paths, no fallback searches

2. **Instant Feedback, Async Sync**
   - User's item appears in inventory immediately
   - Market data syncs in background
   - UI shows "Syncing..." state until ready

3. **Honest Numbers**
   - Never show misleading profit
   - Always factor in platform fees
   - Show users what they'll ACTUALLY receive

4. **Search-First UX**
   - Users don't always know SKUs
   - Search by "Jordan 4 Black Cat" must work
   - Merge results from local DB + StockX + Alias

5. **V4 Namespace**
   - All new tables: `inventory_v4_*`
   - All new hooks: `useInventoryV4*`
   - All new components: `InventoryV4*`
   - Keep isolated from legacy code

---

## Part 3: ARCHVD Smart Pricing

### The Formula

```typescript
ARCHVD_PRICE = min(
  stockx_lowest_ask_in_user_currency,
  alias_lowest_ask_in_user_currency
)
```

### Type Definition

```typescript
interface ArchvdPrice {
  // The headline number users see
  value: number
  currency: Currency // User's preferred currency

  // Attribution
  source: 'stockx' | 'alias' | 'blended'
  confidence: 'high' | 'medium' | 'low'

  // The raw inputs (for transparency)
  inputs: {
    stockxAsk: number | null       // Converted to user currency
    stockxAskOriginal: number      // Original GBP value
    stockxCurrency: 'GBP'

    aliasAsk: number | null        // Converted to user currency
    aliasAskOriginal: number       // Original USD value
    aliasCurrency: 'USD'

    fxRateUsed: number
    fxRateTimestamp: string
  }

  // Metadata
  calculatedAt: string
  dataFreshness: 'live' | 'recent' | 'stale'
}
```

### Calculation Logic

```typescript
function calculateArchvdPrice(
  stockxAsk: number | null,  // GBP
  aliasAsk: number | null,   // USD
  fxRates: FxRates,
  userCurrency: Currency
): ArchvdPrice | null {
  // Step 1: Normalize to user's currency
  const stockxInUserCurrency = stockxAsk
    ? convertCurrency(stockxAsk, 'GBP', userCurrency, fxRates)
    : null

  const aliasInUserCurrency = aliasAsk
    ? convertCurrency(aliasAsk, 'USD', userCurrency, fxRates)
    : null

  // Step 2: Determine ARCHVD price
  if (stockxInUserCurrency && aliasInUserCurrency) {
    // Both available - take minimum
    const value = Math.min(stockxInUserCurrency, aliasInUserCurrency)
    const source = stockxInUserCurrency <= aliasInUserCurrency ? 'stockx' : 'alias'
    return {
      value,
      currency: userCurrency,
      source,
      confidence: 'high', // Two sources = high confidence
      inputs: { /* ... */ },
      calculatedAt: new Date().toISOString(),
      dataFreshness: 'live',
    }
  }

  if (stockxInUserCurrency) {
    return {
      value: stockxInUserCurrency,
      source: 'stockx',
      confidence: 'medium', // Single source
      // ...
    }
  }

  if (aliasInUserCurrency) {
    return {
      value: aliasInUserCurrency,
      source: 'alias',
      confidence: 'medium',
      // ...
    }
  }

  return null // No data
}
```

---

## Part 4: Fee-Adjusted Net Profit

### Why This Matters

**Current state everywhere (misleading):**
```
Market Price: £240
Your Cost: £200
Profit: £40 (20%)  ← THIS IS A LIE
```

**Reality:**
```
Sale Price (StockX): £240
- StockX fee (9.5%): -£22.80
- Payment processing (3%): -£7.20
- Shipping to StockX: -£5.00
= You receive: £205

Your cost: £200
ACTUAL Profit: £5 (2.5%)  ← THE TRUTH
```

### Platform Fee Configuration

```typescript
interface PlatformFeeConfig {
  sellerFeePercent: number      // Platform's cut
  paymentProcessingPercent: number
  shippingCost: number          // Fixed cost to ship to platform
  minimumFee: number
  currency: Currency
}

const PLATFORM_FEES: Record<string, PlatformFeeConfig> = {
  stockx: {
    sellerFeePercent: 0.095,      // 9.5% for Level 1 sellers
    paymentProcessingPercent: 0.03,
    shippingCost: 5.00,           // £5 UK shipping
    minimumFee: 5.00,
    currency: 'GBP',
  },
  alias: {
    sellerFeePercent: 0.08,       // 8%
    paymentProcessingPercent: 0.029,
    shippingCost: 0,              // Free UK shipping
    minimumFee: 0,
    currency: 'USD',
  },
}
```

### Net Proceeds Calculation

```typescript
interface PlatformNetProceeds {
  platform: 'stockx' | 'alias'
  grossPrice: number              // Sale price
  grossPriceCurrency: Currency

  fees: {
    platformFee: number
    paymentFee: number
    shipping: number
    total: number
  }

  netReceive: number              // What you actually get
  netReceiveCurrency: Currency
  netReceiveUserCurrency: number  // Converted to user's currency
}

function calculateNetProceeds(
  grossPrice: number,
  platform: 'stockx' | 'alias',
  fxRates: FxRates,
  userCurrency: Currency
): PlatformNetProceeds {
  const config = PLATFORM_FEES[platform]

  const platformFee = Math.max(
    grossPrice * config.sellerFeePercent,
    config.minimumFee
  )
  const paymentFee = grossPrice * config.paymentProcessingPercent
  const shipping = config.shippingCost
  const totalFees = platformFee + paymentFee + shipping

  const netReceive = grossPrice - totalFees
  const netReceiveUserCurrency = convertCurrency(
    netReceive,
    config.currency,
    userCurrency,
    fxRates
  )

  return {
    platform,
    grossPrice,
    grossPriceCurrency: config.currency,
    fees: {
      platformFee,
      paymentFee,
      shipping,
      total: totalFees,
    },
    netReceive,
    netReceiveCurrency: config.currency,
    netReceiveUserCurrency,
  }
}
```

### Extended ARCHVD Price with Fees

```typescript
interface ArchvdPriceWithFees extends ArchvdPrice {
  // Net proceeds by platform
  netProceeds: {
    stockx: PlatformNetProceeds | null
    alias: PlatformNetProceeds | null
  }

  // Platform recommendation
  bestPlatformToSell: 'stockx' | 'alias' | null
  bestNetProceeds: number | null
  platformAdvantage: number | null  // How much more on best platform

  // Real profit (using best platform)
  realProfit: number | null
  realProfitPercent: number | null
}

function calculateArchvdPriceWithFees(
  stockxAsk: number | null,
  aliasAsk: number | null,
  userCost: number | null,
  fxRates: FxRates,
  userCurrency: Currency
): ArchvdPriceWithFees | null {
  const basePrice = calculateArchvdPrice(stockxAsk, aliasAsk, fxRates, userCurrency)
  if (!basePrice) return null

  // Calculate net proceeds for each platform
  const stockxNet = stockxAsk
    ? calculateNetProceeds(stockxAsk, 'stockx', fxRates, userCurrency)
    : null

  const aliasNet = aliasAsk
    ? calculateNetProceeds(aliasAsk, 'alias', fxRates, userCurrency)
    : null

  // Determine best platform
  let bestPlatform: 'stockx' | 'alias' | null = null
  let bestNet: number | null = null

  if (stockxNet && aliasNet) {
    if (stockxNet.netReceiveUserCurrency >= aliasNet.netReceiveUserCurrency) {
      bestPlatform = 'stockx'
      bestNet = stockxNet.netReceiveUserCurrency
    } else {
      bestPlatform = 'alias'
      bestNet = aliasNet.netReceiveUserCurrency
    }
  } else if (stockxNet) {
    bestPlatform = 'stockx'
    bestNet = stockxNet.netReceiveUserCurrency
  } else if (aliasNet) {
    bestPlatform = 'alias'
    bestNet = aliasNet.netReceiveUserCurrency
  }

  // Calculate real profit
  const realProfit = bestNet && userCost ? bestNet - userCost : null
  const realProfitPercent = realProfit && userCost
    ? (realProfit / userCost) * 100
    : null

  // Platform advantage
  const platformAdvantage = stockxNet && aliasNet
    ? Math.abs(stockxNet.netReceiveUserCurrency - aliasNet.netReceiveUserCurrency)
    : null

  return {
    ...basePrice,
    netProceeds: {
      stockx: stockxNet,
      alias: aliasNet,
    },
    bestPlatformToSell: bestPlatform,
    bestNetProceeds: bestNet,
    platformAdvantage,
    realProfit,
    realProfitPercent,
  }
}
```

### UI Display

```
┌──────────────────────────────────────────────────────────────┐
│ Market: £240 [StockX]                                        │
│                                                              │
│ ┌─────────────────────┐  ┌─────────────────────┐            │
│ │ Sell on StockX      │  │ Sell on Alias       │            │
│ │ Price: £240         │  │ Price: $305         │            │
│ │ Fees:  -£30         │  │ Fees:  -$24         │            │
│ │ ─────────────       │  │ ─────────────       │            │
│ │ You get: £210       │  │ You get: £222       │            │
│ └─────────────────────┘  └─────────────────────┘            │
│                                                              │
│ ✅ Best: Alias (+£12)                                       │
│                                                              │
│ Cost: £200  →  Real Profit: +£22 (+11%)                     │
└──────────────────────────────────────────────────────────────┘
```

---

## Part 5: Data Architecture

### Tables (V4 Namespace)

```sql
-- Style catalog (the single source of truth for SKUs)
inventory_v4_style_catalog (
  style_id TEXT PRIMARY KEY,        -- "DD1391-100" - THE canonical identifier
  stockx_product_id UUID,           -- FK to stockx_products (nullable)
  stockx_url_key TEXT,              -- StockX URL slug
  alias_catalog_id TEXT,            -- FK to alias_products (nullable)
  brand TEXT,
  name TEXT,
  colorway TEXT,
  primary_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)

-- StockX data chain
inventory_v4_stockx_products (stockx_product_id UUID PK)
  └── inventory_v4_stockx_variants (stockx_variant_id UUID PK)
        ├── variant_value TEXT ("10", "10.5")
        └── inventory_v4_stockx_market_data
              ├── lowest_ask, highest_bid (GBP)
              └── flex_lowest_ask, earn_more, sell_faster

-- Alias data chain
inventory_v4_alias_products (alias_catalog_id TEXT PK)
  └── inventory_v4_alias_variants (id BIGSERIAL PK)
        ├── size_value NUMERIC (10.0, 10.5)
        ├── region_id ("1"=UK, "2"=EU, "3"=US)
        ├── consigned BOOLEAN
        └── inventory_v4_alias_market_data
              ├── lowest_ask, highest_bid (USD always)
              └── last_sale_price, global_indicator_price

-- Sync queue (for background syncing of new SKUs)
inventory_v4_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  style_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('stockx', 'alias')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (style_id, provider, status) WHERE status IN ('pending', 'processing')
)

-- User's inventory items
inventory_v4_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users,
  style_id TEXT NOT NULL REFERENCES inventory_v4_style_catalog,
  size TEXT NOT NULL,                -- US size as text
  purchase_price NUMERIC(10,2),
  purchase_currency TEXT DEFAULT 'GBP',
  purchase_date DATE,
  condition TEXT DEFAULT 'new',
  status TEXT DEFAULT 'in_stock',    -- in_stock, listed_stockx, listed_alias, consigned, sold
  consignment_location TEXT,         -- If status = 'consigned'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)
```

### Existing RPC Functions

```sql
-- Already exists: get unified market data
get_unified_market_data(p_style_id, p_alias_region, p_consigned)
get_unified_market_data_batch(p_style_ids, p_sizes, p_alias_region, p_consigned)
```

---

## Part 6: Search & Resolution Flow

### Input Types

```typescript
type InputType = 'sku' | 'search_query' | 'stockx_url' | 'alias_url'

function detectInputType(input: string): InputType {
  const trimmed = input.trim()

  // URL detection
  if (trimmed.includes('stockx.com')) return 'stockx_url'
  if (trimmed.includes('alias.co') || trimmed.includes('aliasldn.com')) return 'alias_url'

  // SKU patterns
  const skuPatterns = [
    /^[A-Z]{2}\d{4}-\d{3}$/i,      // Nike: DD1391-100
    /^\d{6}-\d{3}$/,               // Jordan: 554724-136
    /^[MW]\d{3,4}[A-Z]{2,3}\d?$/i, // New Balance: M990GL6
    /^[A-Z]{2}\d{4}$/i,            // Adidas: GY7924
  ]

  for (const pattern of skuPatterns) {
    if (pattern.test(trimmed)) return 'sku'
  }

  return 'search_query'
}
```

### Unified Search

```typescript
interface SearchResult {
  styleId: string                    // SKU - canonical identifier
  name: string
  brand: string
  colorway?: string
  imageUrl?: string

  // Source tracking
  source: 'local' | 'stockx' | 'alias'
  inDatabase: boolean

  // External IDs (for syncing)
  stockxProductId?: string
  stockxUrlKey?: string
  aliasCatalogId?: string

  // Preview pricing
  previewPrice?: {
    value: number
    currency: string
    source: 'stockx' | 'alias'
  }

  // Available sizes
  availableSizes?: string[]
}

interface UnifiedSearchResponse {
  results: SearchResult[]
  query: string
  queryType: InputType
  searchTime: number
  sources: {
    local: { searched: boolean; count: number; error?: string }
    stockx: { searched: boolean; count: number; error?: string }
    alias: { searched: boolean; count: number; error?: string }
  }
}

async function unifiedSearchV4(
  query: string,
  options?: { limit?: number; includeExternal?: boolean }
): Promise<UnifiedSearchResponse>
```

### Search Flow Diagram

```
User Input: "Jordan 4 Black Cat" or "CU1110-010"
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    INPUT DETECTION                           │
│   detectInputType() → 'search_query' or 'sku'               │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              PARALLEL SEARCH (3 sources)                     │
│                                                              │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│   │ LOCAL DB     │  │ STOCKX API   │  │ ALIAS API    │     │
│   │ style_catalog│  │ /search      │  │ /catalog     │     │
│   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│          │                 │                 │              │
│          └─────────────────┼─────────────────┘              │
│                            ▼                                 │
│                  ┌─────────────────┐                        │
│                  │ MERGE & DEDUPE  │                        │
│                  │ by style_id     │                        │
│                  │ prefer local    │                        │
│                  └─────────────────┘                        │
│                            │                                 │
└────────────────────────────┼────────────────────────────────┘
                             ▼
                     SearchResult[]
```

### Merge Logic

```typescript
function mergeAndDedupeResults(results: SearchResult[]): SearchResult[] {
  const byStyleId = new Map<string, SearchResult>()

  for (const result of results) {
    const normalizedSku = result.styleId.toUpperCase()
    const existing = byStyleId.get(normalizedSku)

    if (!existing) {
      byStyleId.set(normalizedSku, { ...result, styleId: normalizedSku })
      continue
    }

    // Local always wins, but enrich with external data
    if (result.source === 'local') {
      byStyleId.set(normalizedSku, {
        ...result,
        styleId: normalizedSku,
        stockxProductId: result.stockxProductId ?? existing.stockxProductId,
        aliasCatalogId: result.aliasCatalogId ?? existing.aliasCatalogId,
        previewPrice: result.previewPrice ?? existing.previewPrice,
      })
    } else if (existing.source !== 'local') {
      // Both external - merge IDs
      byStyleId.set(normalizedSku, {
        ...existing,
        stockxProductId: existing.stockxProductId ?? result.stockxProductId,
        aliasCatalogId: existing.aliasCatalogId ?? result.aliasCatalogId,
        imageUrl: existing.imageUrl ?? result.imageUrl,
      })
    }
  }

  return [...byStyleId.values()]
}
```

---

## Part 7: Sync Queue System

### Purpose

When a user adds a SKU we've never seen:
1. Create `style_catalog` row immediately
2. Enqueue sync jobs for StockX + Alias
3. Worker processes jobs in background
4. UI shows "Syncing..." until complete

### Sync Queue Table

```sql
CREATE TABLE inventory_v4_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  style_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('stockx', 'alias')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,

  -- Prevent duplicate pending jobs
  UNIQUE (style_id, provider, status) WHERE status IN ('pending', 'processing')
);

-- Index for worker polling
CREATE INDEX idx_v4_sync_queue_pending
  ON inventory_v4_sync_queue (status, next_retry_at)
  WHERE status IN ('pending', 'processing');
```

### Enqueue Function

```typescript
async function createStyleAndEnqueueSyncV4(
  styleId: string,
  externalIds?: {
    stockxProductId?: string
    stockxUrlKey?: string
    aliasCatalogId?: string
  },
  metadata?: {
    brand?: string
    name?: string
    imageUrl?: string
  }
): Promise<{ style: StyleCatalogRow; syncJobs: SyncJob[] }> {
  const supabase = createServiceClient()
  const normalizedSku = styleId.toUpperCase()

  // 1. Create style_catalog row (with external IDs if we have them)
  const { data: style, error: styleError } = await supabase
    .from('inventory_v4_style_catalog')
    .insert({
      style_id: normalizedSku,
      stockx_product_id: externalIds?.stockxProductId ?? null,
      stockx_url_key: externalIds?.stockxUrlKey ?? null,
      alias_catalog_id: externalIds?.aliasCatalogId ?? null,
      brand: metadata?.brand ?? null,
      name: metadata?.name ?? null,
      primary_image_url: metadata?.imageUrl ?? null,
    })
    .select()
    .single()

  if (styleError?.code === '23505') {
    // Already exists - return existing
    const existing = await resolveStyleIdV4(normalizedSku)
    return { style: existing.style!, syncJobs: [] }
  }

  if (styleError) throw styleError

  // 2. Enqueue sync jobs
  const { data: syncJobs } = await supabase
    .from('inventory_v4_sync_queue')
    .insert([
      { style_id: normalizedSku, provider: 'stockx' },
      { style_id: normalizedSku, provider: 'alias' },
    ])
    .select()

  return { style, syncJobs: syncJobs ?? [] }
}
```

### Sync Worker

```typescript
// Cron endpoint: /api/cron/v4-sync-worker
async function processSyncQueueV4() {
  const supabase = createServiceClient()

  // Fetch pending jobs
  const { data: jobs } = await supabase
    .from('inventory_v4_sync_queue')
    .select('*')
    .in('status', ['pending'])
    .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
    .order('created_at', { ascending: true })
    .limit(10)

  for (const job of jobs ?? []) {
    await processJobV4(supabase, job)
  }
}

async function processJobV4(supabase: SupabaseClient, job: SyncJob) {
  // Mark as processing
  await supabase
    .from('inventory_v4_sync_queue')
    .update({ status: 'processing', last_attempt_at: new Date().toISOString() })
    .eq('id', job.id)

  try {
    if (job.provider === 'stockx') {
      await syncStockXForStyleV4(supabase, job.style_id)
    } else {
      await syncAliasForStyleV4(supabase, job.style_id)
    }

    // Mark completed
    await supabase
      .from('inventory_v4_sync_queue')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', job.id)

  } catch (error) {
    const attempts = job.attempts + 1

    if (attempts >= job.max_attempts) {
      await supabase
        .from('inventory_v4_sync_queue')
        .update({ status: 'failed', attempts, last_error: error.message })
        .eq('id', job.id)
    } else {
      // Schedule retry (exponential backoff)
      const retryDelay = Math.pow(2, attempts) * 60 * 1000
      await supabase
        .from('inventory_v4_sync_queue')
        .update({
          status: 'pending',
          attempts,
          last_error: error.message,
          next_retry_at: new Date(Date.now() + retryDelay).toISOString(),
        })
        .eq('id', job.id)
    }
  }
}
```

---

## Part 8: Add Item Modal Flow

### State Machine

```
[IDLE]
   │ User types query
   ▼
[SEARCHING]
   │ unifiedSearchV4()
   ├─► Results found ──► [RESULTS]
   │                        │ User selects result
   │                        ▼
   │                    [SELECTED]
   │                        │ Result.inDatabase?
   │                        ├─► Yes ──► [READY_TO_ADD]
   │                        └─► No ───► [CONFIRM_CREATE]
   │                                        │ User confirms
   │                                        ▼
   │                                    [READY_TO_ADD]
   │                                        │ User fills size + cost
   │                                        ▼
   │                                    [ADDING]
   │                                        │ Success
   │                                        ▼
   │                                    [ADDED] ──► Close modal
   │
   └─► No results ──► [NO_RESULTS]
```

### Modal Component

```typescript
interface AddItemModalV4State {
  // Search
  searchQuery: string
  searchResults: SearchResult[]
  isSearching: boolean

  // Selection
  selectedResult: SearchResult | null
  confirmCreateNew: boolean

  // Form
  selectedSize: string | null
  purchasePrice: number | null
  purchaseDate: Date | null
  condition: 'new' | 'used'

  // Submission
  isSubmitting: boolean
  error: Error | null
}

function AddItemModalV4({ onClose, onItemAdded }: Props) {
  // ... state management

  const handleAddItem = async () => {
    if (!selectedResult || !selectedSize || !purchasePrice) return

    setIsSubmitting(true)

    try {
      if (selectedResult.inDatabase) {
        // SKU exists - just add to inventory
        await addToInventoryV4({
          styleId: selectedResult.styleId,
          size: selectedSize,
          purchasePrice,
          // ...
        })
      } else {
        // SKU doesn't exist - create style + enqueue sync + add to inventory
        await createStyleAndAddV4({
          styleId: selectedResult.styleId,
          stockxProductId: selectedResult.stockxProductId,
          aliasCatalogId: selectedResult.aliasCatalogId,
          name: selectedResult.name,
          brand: selectedResult.brand,
          imageUrl: selectedResult.imageUrl,
          size: selectedSize,
          purchasePrice,
          // ...
        })
      }

      onItemAdded()
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog>
      {/* Search input */}
      {/* Search results list */}
      {/* Selected product preview */}
      {/* "New to ARCHVD" notice if !inDatabase */}
      {/* Size selector */}
      {/* Price input */}
      {/* Add button */}
    </Dialog>
  )
}
```

---

## Part 9: Inventory Table & Row States

### Row Market Data States

```
┌─────────────────────────────────────────────────────────────┐
│                    ROW MARKET DATA STATES                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [LOADING]     → Skeleton UI during initial load            │
│       │                                                      │
│       ▼                                                      │
│  [SYNCING]     → "Syncing..." with spinner                  │
│       │          (sync_queue has pending jobs)              │
│       │                                                      │
│       ├──► [READY]    → Full market data + profit           │
│       │                                                      │
│       ├──► [PARTIAL]  → One provider ready, one syncing     │
│       │                                                      │
│       └──► [FAILED]   → "No data" with retry button         │
│                        (sync_queue jobs failed)             │
│                                                              │
│  [NO_STYLE]    → "Unknown SKU" (shouldn't happen)           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Row Component

```typescript
interface InventoryV4RowProps {
  item: InventoryV4Item
  marketData: ArchvdPriceWithFees | null
  syncStatus: SyncStatus | null
  isLoading: boolean
}

function InventoryV4Row({ item, marketData, syncStatus, isLoading }: Props) {
  const marketState = determineMarketState(isLoading, syncStatus, marketData)

  return (
    <tr className="h-14">
      <td><ItemCellV4 item={item} /></td>
      <td>US {item.size}</td>
      <td><MarketPriceCellV4 state={marketState} data={marketData} /></td>
      <td><CostCellV4 cost={item.purchase_price} currency={item.purchase_currency} /></td>
      <td><ProfitCellV4 state={marketState} data={marketData} /></td>
      <td><ActionsCellV4 item={item} /></td>
    </tr>
  )
}
```

### Market Price Cell

```typescript
function MarketPriceCellV4({ state, data }: Props) {
  switch (state) {
    case 'loading':
      return <Skeleton className="h-5 w-20" />

    case 'syncing':
      return (
        <div className="flex items-center gap-2 text-muted">
          <Spinner className="h-4 w-4" />
          <span>Syncing...</span>
        </div>
      )

    case 'ready':
      return (
        <Tooltip content={<MarketBreakdownTooltipV4 data={data} />}>
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-medium">
              {formatMoney(data.value)}
            </span>
            <PlatformBadge platform={data.source} size="xs" />
          </div>
        </Tooltip>
      )

    case 'failed':
      return (
        <div className="flex items-center gap-2">
          <span className="text-muted">No data</span>
          <Button variant="ghost" size="xs" onClick={onRetry}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      )

    default:
      return <span className="text-muted">—</span>
  }
}
```

### Profit Cell (Fee-Adjusted)

```typescript
function ProfitCellV4({ state, data }: Props) {
  if (state !== 'ready' || !data?.realProfit) {
    return <span className="text-muted">—</span>
  }

  const isPositive = data.realProfit >= 0

  return (
    <div className={cn(
      "font-mono text-sm",
      isPositive ? "text-green-600" : "text-red-600"
    )}>
      <div className="flex items-center gap-1">
        <span>{isPositive ? '+' : ''}{formatMoney(data.realProfit)}</span>
        <span className="text-xs opacity-70">
          ({data.realProfitPercent?.toFixed(1)}%)
        </span>
      </div>
      {data.bestPlatformToSell && (
        <div className="text-xs text-muted">
          via {data.bestPlatformToSell === 'stockx' ? 'StockX' : 'Alias'}
        </div>
      )}
    </div>
  )
}
```

---

## Part 10: Component Architecture

### File Structure

```
src/
├── lib/
│   ├── inventory-v4/
│   │   ├── types.ts                    # All V4 types
│   │   ├── search.ts                   # unifiedSearchV4()
│   │   ├── resolve.ts                  # resolveStyleIdV4()
│   │   ├── sync-queue.ts               # Sync queue operations
│   │   └── index.ts                    # Re-exports
│   │
│   └── pricing/
│       ├── archvd.ts                   # ARCHVD price calculation
│       ├── fees.ts                     # Platform fee config & calculation
│       └── types.ts                    # Pricing types
│
├── hooks/
│   ├── useInventoryV4.ts               # Basic inventory hook
│   ├── useInventoryV4WithMarket.ts     # Inventory + market data
│   └── useUnifiedSearchV4.ts           # Search hook
│
├── app/
│   ├── api/
│   │   ├── v4/
│   │   │   ├── search/route.ts         # Unified search endpoint
│   │   │   ├── inventory/
│   │   │   │   ├── route.ts            # GET inventory, POST add item
│   │   │   │   └── add-new/route.ts    # Create style + add item
│   │   │   └── sync/
│   │   │       └── retry/route.ts      # Manual resync
│   │   └── cron/
│   │       └── v4-sync-worker/route.ts # Sync worker cron
│   │
│   └── portfolio/inventory/
│       └── _components/
│           ├── InventoryV4Table.tsx
│           ├── InventoryV4Row.tsx
│           ├── InventoryV4MobileCard.tsx
│           ├── cells/
│           │   ├── ItemCellV4.tsx
│           │   ├── MarketPriceCellV4.tsx
│           │   ├── ProfitCellV4.tsx
│           │   └── ActionsCellV4.tsx
│           └── modals/
│               └── AddItemModalV4/
│                   ├── index.tsx
│                   ├── SearchInput.tsx
│                   ├── SearchResults.tsx
│                   ├── SelectedProduct.tsx
│                   └── SizeSelector.tsx
│
└── components/
    └── platform/
        ├── PlatformBadge.tsx           # Existing
        └── PlatformFeeBreakdown.tsx    # NEW
```

---

## Part 11: API Endpoints

```typescript
// Unified search
POST /api/v4/search
Body: { query: string, limit?: number, includeExternal?: boolean }
Returns: UnifiedSearchResponse

// Get user's inventory with market data
GET /api/v4/inventory
Returns: { items: InventoryV4ItemWithMarket[], syncStatuses: Record<string, SyncStatus> }

// Add item (SKU exists in database)
POST /api/v4/inventory
Body: { styleId, size, purchasePrice, purchaseCurrency?, condition?, notes? }
Returns: { item: InventoryV4Item }

// Create style + add item (new SKU)
POST /api/v4/inventory/add-new
Body: {
  styleId, stockxProductId?, aliasCatalogId?, name?, brand?, imageUrl?,
  size, purchasePrice, purchaseCurrency?, condition?, notes?
}
Returns: { item: InventoryV4Item, style: StyleCatalogRow, syncJobs: SyncJob[] }

// Retry failed sync
POST /api/v4/sync/retry
Body: { styleId, provider?: 'stockx' | 'alias' }
Returns: { syncJobs: SyncJob[] }

// Sync worker (cron, every 30 seconds)
POST /api/cron/v4-sync-worker
Returns: { processed: number, succeeded: number, failed: number }
```

---

## Part 12: Implementation Phases

### Phase 1: Foundation
**Goal**: Basic infrastructure

- [ ] Create `inventory_v4_sync_queue` table
- [ ] Create `inventory_v4_items` table
- [ ] Create `src/lib/inventory-v4/types.ts`
- [ ] Create `src/lib/pricing/fees.ts` with platform fee config
- [ ] Create `src/lib/pricing/archvd.ts` with fee-adjusted calculation

### Phase 2: Search & Resolution
**Goal**: Users can search by name or SKU

- [ ] Create `src/lib/inventory-v4/search.ts` (unifiedSearchV4)
- [ ] Create `src/lib/inventory-v4/resolve.ts` (resolveStyleIdV4)
- [ ] Create `/api/v4/search` endpoint
- [ ] Create `useUnifiedSearchV4` hook

### Phase 3: Sync Queue
**Goal**: New SKUs sync automatically

- [ ] Create `src/lib/inventory-v4/sync-queue.ts`
- [ ] Create `/api/cron/v4-sync-worker` endpoint
- [ ] Create `/api/v4/sync/retry` endpoint
- [ ] Add sync status checking to hooks

### Phase 4: Add Item Modal
**Goal**: Complete add item flow

- [ ] Create `AddItemModalV4` component
- [ ] Create search input with debounce
- [ ] Create search results list
- [ ] Create "New to ARCHVD" notice
- [ ] Create size selector
- [ ] Wire up to `/api/v4/inventory` and `/api/v4/inventory/add-new`

### Phase 5: Inventory Table
**Goal**: Display inventory with market data

- [ ] Create `useInventoryV4WithMarket` hook
- [ ] Create `InventoryV4Table` component
- [ ] Create `InventoryV4Row` component
- [ ] Create all cell components with states
- [ ] Create `MarketBreakdownTooltipV4`
- [ ] Add polling for sync completion

### Phase 6: Polish
**Goal**: Production ready

- [ ] Loading skeletons
- [ ] Empty states
- [ ] Error states with retry
- [ ] Mobile card layout
- [ ] Search debouncing
- [ ] Virtual scrolling for large lists

---

## Part 13: File Structure (Complete)

```
src/
├── lib/
│   ├── inventory-v4/
│   │   ├── types.ts
│   │   ├── search.ts
│   │   ├── resolve.ts
│   │   ├── sync-queue.ts
│   │   └── index.ts
│   │
│   ├── pricing/
│   │   ├── archvd.ts
│   │   ├── fees.ts
│   │   └── types.ts
│   │
│   └── services/
│       └── unified-market/
│           └── index.ts              # Existing
│
├── hooks/
│   ├── useInventoryV4.ts
│   ├── useInventoryV4WithMarket.ts
│   └── useUnifiedSearchV4.ts
│
├── app/
│   ├── api/
│   │   ├── v4/
│   │   │   ├── search/route.ts
│   │   │   ├── inventory/
│   │   │   │   ├── route.ts
│   │   │   │   └── add-new/route.ts
│   │   │   └── sync/retry/route.ts
│   │   └── cron/
│   │       └── v4-sync-worker/route.ts
│   │
│   └── portfolio/inventory/
│       └── _components/
│           ├── InventoryV4Table.tsx
│           ├── InventoryV4Row.tsx
│           ├── InventoryV4MobileCard.tsx
│           ├── cells/
│           │   ├── ItemCellV4.tsx
│           │   ├── MarketPriceCellV4.tsx
│           │   ├── ProfitCellV4.tsx
│           │   └── ActionsCellV4.tsx
│           ├── MarketBreakdownTooltipV4.tsx
│           └── modals/
│               └── AddItemModalV4/
│                   ├── index.tsx
│                   ├── SearchInput.tsx
│                   ├── SearchResults.tsx
│                   ├── SelectedProduct.tsx
│                   └── SizeSelector.tsx
│
└── components/
    └── platform/
        ├── PlatformBadge.tsx
        └── PlatformFeeBreakdown.tsx

supabase/migrations/
└── 20251212_inventory_v4_sync_queue.sql
```

---

## Part 14: Testing Strategy

### Unit Tests

```typescript
// archvd.test.ts
describe('calculateArchvdPriceWithFees', () => {
  it('calculates correct net proceeds for StockX', () => {
    const result = calculateArchvdPriceWithFees(
      240,  // StockX ask (GBP)
      null, // No Alias
      200,  // User cost
      mockFxRates,
      'GBP'
    )

    expect(result.netProceeds.stockx.grossPrice).toBe(240)
    expect(result.netProceeds.stockx.fees.total).toBeCloseTo(35) // 9.5% + 3% + £5
    expect(result.netProceeds.stockx.netReceive).toBeCloseTo(205)
    expect(result.realProfit).toBeCloseTo(5)
  })

  it('recommends Alias when it has better net proceeds', () => {
    const result = calculateArchvdPriceWithFees(
      240,  // StockX £240
      305,  // Alias $305 (≈ £241)
      200,
      mockFxRates,
      'GBP'
    )

    // Alias has lower fees, so net should be better
    expect(result.bestPlatformToSell).toBe('alias')
  })
})
```

### Integration Tests

```typescript
// unifiedSearchV4.test.ts
describe('unifiedSearchV4', () => {
  it('merges results from all sources', async () => {
    const response = await unifiedSearchV4('Jordan 4 Black Cat')

    expect(response.sources.local.searched).toBe(true)
    expect(response.sources.stockx.searched).toBe(true)
    expect(response.sources.alias.searched).toBe(true)
    expect(response.results.length).toBeGreaterThan(0)
  })

  it('prefers local results over external', async () => {
    // Add a style to local DB first
    await createStyleCatalogRow({ style_id: 'CU1110-010', name: 'Local Name' })

    const response = await unifiedSearchV4('CU1110-010')

    const result = response.results[0]
    expect(result.inDatabase).toBe(true)
    expect(result.name).toBe('Local Name')
  })
})
```

---

## Summary

This design provides:

1. **ARCHVD Smart Pricing** - Single trusted price from StockX + Alias
2. **Fee-Adjusted Net Profit** - Honest numbers after platform fees
3. **Platform Recommendation** - "Sell on Alias for £10 more"
4. **Unified Search** - SKU, name, or URL across all sources
5. **Auto-Sync for New SKUs** - Background sync with queue
6. **Clear UI States** - Loading, syncing, ready, failed
7. **V4 Namespace** - Clean separation from legacy code

All code follows the `V4` naming convention and integrates with existing `inventory_v4_*` tables.

---

*Document created: December 2024*
