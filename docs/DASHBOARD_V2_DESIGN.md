# Dashboard V2 Design

## Current State Analysis

### Existing Data Sources ✅
- **`/api/portfolio/overview`** - provides:
  - KPIs: estimatedValue, invested, unrealisedPL, unrealisedPLDelta7d, roi
  - series30d: 30-day portfolio value time series
  - categoryBreakdown, missingItems
- **`usePortfolioInventory`** - enriched inventory with:
  - invested, profit, performance_pct
  - StockX market data (bid/ask/last_sale)
- **`useSalesTable`** - sold items with:
  - purchase_price, sold_price, margin_gbp, margin_percent
  - commission, net_payout
- **P&L page** - monthly profit, VAT calculations
- **Expenses & subscriptions** - existing endpoints

### Existing Components ✅
- Card, Badge, Button UI components
- Sparkline component
- ProvenanceBadge for source badges
- ProductLineItem for product display
- TimeRangeControl for date pickers
- CurrencySwitcher

---

## Scout-Inspired Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ HERO SECTION (3 tiles)                                         │
│ ┌─────────────┐ ┌─────────────┐ ┌────────────────┐            │
│ │ EST. VALUE  │ │  INVESTED   │ │ UNREALISED P/L │            │
│ │   £50,000   │ │   £45,000   │ │    +£5,000     │            │
│ │ +£1,087(+68)│ │   11 items  │ │   +11.11%      │            │
│ └─────────────┘ └─────────────┘ └────────────────┘            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PORTFOLIO CHART                                   [24H|1W|1M|…]│
│ ┌───────────────────────────────────────────────────────────┐  │
│ │             📈 Portfolio Value Over Time                  │  │
│ │                                                           │  │
│ │                                                           │  │
│ └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ REPORTS GRID (3×3)                                             │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                        │
│ │Net Profit│ │ Sales    │ │ Item     │                        │
│ │ £5,000   │ │ Income   │ │ Spend    │                        │
│ │ +5.2%    │ │ £50,000  │ │ £45,000  │                        │
│ └──────────┘ └──────────┘ └──────────┘                        │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                        │
│ │Net Profit│ │ Items    │ │ Items    │                        │
│ │From Sold │ │Purchased │ │  Sold    │                        │
│ │ £3,200   │ │    15    │ │    8     │                        │
│ └──────────┘ └──────────┘ └──────────┘                        │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                        │
│ │Subscript.│ │ Expense  │ │  Total   │                        │
│ │  Spend   │ │  Spend   │ │  Spend   │                        │
│ │  £150    │ │  £500    │ │ £45,650  │                        │
│ └──────────┘ └──────────┘ └──────────┘                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ RIGHT COLUMN: "YOUR MOVERS"                    [Sort: % Gain ▼]│
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ 🖼️ Nike Air Jordan 1 Retro High OG     £296    +68.5%   │  │
│ │ 🖼️ New Balance 2002R                   £114    +52.3%   │  │
│ │ 🖼️ Jordan 1 Low Golf                   £74     +41.2%   │  │
│ └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### 1. Hero Metrics
**Source:** Existing `/api/portfolio/overview`

```typescript
interface HeroMetrics {
  estimatedValue: number          // overview.kpis.estimatedValue
  invested: number                // overview.kpis.invested
  unrealisedPL: number            // overview.kpis.unrealisedPL
  unrealisedPLPct: number         // overview.kpis.roi (Performance %)
  itemCount: number               // count of active inventory
  pricesAsOf: string              // meta.pricesAsOf
  provider: string                // overview.kpis.provider
}
```

### 2. Chart Series
**Source:** Existing `/api/portfolio/overview` + timeframe filter

```typescript
interface ChartData {
  series: Array<{ date: string; value: number | null }>
  timeframe: '24h' | '1w' | '1m' | 'ytd' | 'all' | 'custom'
  customRange?: { from: string; to: string }
}
```

### 3. Reports Grid Metrics
**Source:** NEW endpoint `/api/portfolio/reports`

```typescript
interface ReportMetrics {
  // Sales metrics (from sold items)
  salesIncome: number              // sum(sold_price) where status='sold'
  netProfitFromSold: number        // sum(sold_price - purchase_total - fees)
  itemsSold: number                // count where status='sold'

  // Purchase metrics (from active + sold items)
  itemSpend: number                // sum(purchase_total) in period
  itemsPurchased: number           // count of items purchased in period

  // Expense metrics
  subscriptionSpend: number        // sum from subscriptions table
  expenseSpend: number             // sum from expenses table (fees, shipping, etc)

  // Calculated totals
  totalSpend: number               // itemSpend + subscriptionSpend + expenseSpend
  netProfit: number                // salesIncome - totalSpend

  // Period info
  dateRange: { from: string; to: string }
  currency: 'GBP' | 'EUR' | 'USD'
}
```

### 4. Movers List
**Source:** Existing `usePortfolioInventory` + client-side filtering

```typescript
interface Mover {
  id: string
  sku: string
  brand: string
  model: string
  colorway?: string
  size: string
  image_url?: string
  market_value: number
  invested: number
  profit: number
  performance_pct: number          // (profit / invested) * 100
  currency: 'GBP' | 'EUR' | 'USD'
  market_source: string            // 'stockx', 'alias', etc.
  price_as_of?: string
}

interface MoversData {
  movers: Mover[]
  sortBy: 'performance' | 'market_value' | 'quantity'
}
```

---

## Implementation Plan

### Phase 1: New API Endpoint
**File:** `src/app/api/portfolio/reports/route.ts`

**Responsibilities:**
- Accept `dateRange: { from, to }` and `currency` params
- Query:
  - Inventory table for purchases/sales in period
  - Expenses table for expense spend
  - Subscriptions table for subscription charges
- Return aggregated metrics

**Example Response:**
```json
{
  "salesIncome": 50000,
  "netProfitFromSold": 3200,
  "itemsSold": 8,
  "itemSpend": 45000,
  "itemsPurchased": 15,
  "subscriptionSpend": 150,
  "expenseSpend": 500,
  "totalSpend": 45650,
  "netProfit": 4350,
  "dateRange": { "from": "2025-01-01", "to": "2025-11-16" },
  "currency": "GBP"
}
```

### Phase 2: New Hooks
**Files:**
- `src/hooks/useDashboardReports.ts`
- `src/hooks/useDashboardMovers.ts`

**useDashboardReports:**
```typescript
export function useDashboardReports(dateRange: DateRange, currency: Currency) {
  const [data, setData] = useState<ReportMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch from /api/portfolio/reports
  // Return { data, loading, error }
}
```

**useDashboardMovers:**
```typescript
export function useDashboardMovers(sortBy: 'performance' | 'market_value' = 'performance') {
  const { items, loading } = usePortfolioInventory()

  // Filter active items
  // Sort by selected criteria
  // Return top 10-15 items
}
```

### Phase 3: Dashboard Page Redesign
**File:** `src/app/portfolio/page.tsx`

**Components to Create:**
- `DashboardHero` - 3 KPI tiles (Estimated Value, Invested, Unrealised P/L)
- `DashboardChart` - Portfolio value chart with timeframe chips
- `DashboardReports` - 9-card reports grid
- `DashboardMovers` - Right column movers list

**Layout:**
```tsx
<DashboardPage>
  <DashboardHeader />
  <DashboardHero data={overview.kpis} />
  <DashboardChart series={chartSeries} timeframe={timeframe} />
  <div className="grid lg:grid-cols-3 gap-6">
    <div className="lg:col-span-2">
      <DashboardReports data={reports} />
    </div>
    <div className="lg:col-span-1">
      <DashboardMovers movers={movers} />
    </div>
  </div>
</DashboardPage>
```

### Phase 4: Documentation
**File:** `docs/DASHBOARD_V2_SUMMARY.md`

Document:
- What data each tile uses
- Which endpoints feed the dashboard
- How metrics are calculated
- Currency handling
- Timeframe logic

---

## Key Decisions

### Currency Handling
- All calculations respect user's active currency (from `useCurrency`)
- Market prices: prefer price in user's currency if available
- Fallback to GBP with FX conversion via `fx_rates`
- Never treat USD as GBP

### Unrealised vs Realised P/L
- **Hero + Chart:** Unrealised P/L (active portfolio value - invested)
- **Reports Grid:** Realised P/L (actual sales - costs - fees)

### Timeframe Controls
- Default: Last 30 days
- Options: 24H, 1W, 1M, YTD, ALL, Custom
- Apply to:
  - Portfolio chart (series filtering)
  - Reports grid metrics (date range filter)

### Performance Optimizations
- Reuse existing `/api/portfolio/overview` (cached 60s)
- New `/api/portfolio/reports` should cache (60s)
- Client-side filtering where possible (movers list)
- Avoid duplicate data fetches

---

## Migration Strategy

1. ✅ **No Breaking Changes**
   - Keep existing `/portfolio`, `/portfolio/inventory`, `/portfolio/sales`, `/portfolio/pnl` routes
   - Reuse existing hooks where possible
   - Don't delete current components until new ones are validated

2. ✅ **Incremental Rollout**
   - Build new components in parallel
   - Test with real data
   - Switch dashboard page atomically

3. ✅ **Validation**
   - Ensure `npm run build` passes
   - Test all timeframe combinations
   - Verify currency switching works
   - Check mobile responsiveness

---

## Next Steps

1. Create `/api/portfolio/reports` endpoint
2. Create `useDashboardReports` and `useDashboardMovers` hooks
3. Build new dashboard components (Hero, Chart, Reports, Movers)
4. Update `/portfolio` page with new layout
5. Write `DASHBOARD_V2_SUMMARY.md`
6. Test and validate
