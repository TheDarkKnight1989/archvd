# V4 Market Page - Design Specification

## Data Sources (V4 ONLY)

| UI Section | Data Source | Query |
|------------|-------------|-------|
| Last Sale | `inventory_v4_alias_sales_history` | Most recent sale for this SKU |
| Lowest Ask | `inventory_v4_stockx_market_data` + `inventory_v4_alias_market_data` | Current lowest ask across providers |
| Highest Bid | `inventory_v4_stockx_market_data` + `inventory_v4_alias_market_data` | Current highest bid across providers |
| Market Price | `inventory_v4_alias_sales_daily` | 7-day weighted avg of actual sales |
| Sales Chart | `sales_history` (7D/30D/90D) or `sales_daily` (13M) or `sales_monthly` (ALL) | Aggregated by period |
| Size Grid | `unified-market` service | StockX + Alias market_data joined |
| Liquidity | `inventory_v4_alias_sales_history` | COUNT of sales in 72h/30d |

## NOT Showing (and Why)

- **Price History Line Chart**: We do NOT have historical bid/ask data. Our price_history only stores snapshots, not continuous time series.
- **Price Trend %**: Would require comparing bid/ask over time - we don't have this data reliably.
- **Volume Histogram**: Sales volume is what we have, not price histogram.

---

## Mobile Layout (Primary)

```
┌─────────────────────────────────────┐
│  ← Back                       •••   │  Header
├─────────────────────────────────────┤
│                                     │
│         [PRODUCT IMAGE]             │  Hero Image (320x320)
│                                     │
├─────────────────────────────────────┤
│  Brand                              │
│  Product Name                       │  Product Info
│  SKU: XX-XXXX-XXX                   │
├─────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│ │ Last    │ │ Ask     │ │ Bid     │ │  Key Stats Row
│ │ $XXX    │ │ $XXX    │ │ $XXX    │ │  (horizontal scroll)
│ └─────────┘ └─────────┘ └─────────┘ │
├─────────────────────────────────────┤
│  7D   30D   90D   13M   ALL         │  Time Range Toggle
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │   [SALES PRICE CHART]       │    │  Single Chart
│  │   Area + Volume Bars        │    │  (Dark BG)
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  High: $XXX  Low: $XXX  Avg: $XXX   │  Summary Stats
│  Volume: XXX sales                  │
├─────────────────────────────────────┤
│  Size: [ All Sizes ▼ ]              │  Size Filter
├─────────────────────────────────────┤
│  Asks | Bids | Sales                │  Tab Bar
├─────────────────────────────────────┤
│ ┌─────┬─────────┬─────────┬───────┐ │
│ │Size │ StockX  │  Alias  │ Spread│ │  Price Grid
│ ├─────┼─────────┼─────────┼───────┤ │
│ │ 8   │  $280   │  $265   │  $15  │ │
│ │ 8.5 │  $290   │  $275   │  $15  │ │
│ │ 9   │  $285   │  $260   │  $25  │ │
│ └─────┴─────────┴─────────┴───────┘ │
└─────────────────────────────────────┘
```

---

## Desktop Layout (Expanded)

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Back to Inventory                                        •••  │
├────────────────────────┬─────────────────────────────────────────┤
│                        │                                         │
│   [PRODUCT IMAGE]      │  Brand                                  │
│                        │  Product Name                           │
│   320x320              │  SKU: XX-XXXX-XXX                       │
│                        │  Release: Jan 1, 2025                   │
│                        │  Retail: $XXX                           │
│                        │                                         │
│                        │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────────┐   │
│                        │  │Last │ │ Ask │ │ Bid │ │Market   │   │
│                        │  │$XXX │ │$XXX │ │$XXX │ │$XXX     │   │
│                        │  └─────┘ └─────┘ └─────┘ └─────────┘   │
├────────────────────────┴─────────────────────────────────────────┤
│  7D   30D   90D   13M   ALL                Size: [All Sizes ▼]   │
├──────────────────────────────────────────┬───────────────────────┤
│                                          │                       │
│  ┌────────────────────────────────────┐  │   ┌───────────────┐   │
│  │                                    │  │   │ Summary       │   │
│  │                                    │  │   │               │   │
│  │     [SALES PRICE CHART]            │  │   │ High: $XXX    │   │
│  │     Line + Volume                  │  │   │ Low:  $XXX    │   │
│  │                                    │  │   │ Avg:  $XXX    │   │
│  │                                    │  │   │ Vol:  XXX     │   │
│  │                                    │  │   │               │   │
│  └────────────────────────────────────┘  │   ├───────────────┤   │
│                                          │   │ Liquidity     │   │
│                                          │   │               │   │
│                                          │   │ 72h: XX sales │   │
│                                          │   │ 30d: XXX      │   │
│                                          │   │ Avg: X.X/day  │   │
│                                          │   └───────────────┘   │
├──────────────────────────────────────────┴───────────────────────┤
│  Asks | Bids | Sales                                             │
├──────────────────────────────────────────────────────────────────┤
│ ┌──────┬──────────────────────┬──────────────────────┬─────────┐ │
│ │ Size │      StockX          │       Alias          │ Spread  │ │
│ ├──────┼──────────────────────┼──────────────────────┼─────────┤ │
│ │  8   │ Ask: $280  Bid: $240 │ Ask: $265  Bid: $230 │  -$15   │ │
│ │  8.5 │ Ask: $290  Bid: $250 │ Ask: $275  Bid: $235 │  -$15   │ │
│ │  9   │ Ask: $285  Bid: $245 │ Ask: $260  Bid: $225 │  -$25   │ │
│ └──────┴──────────────────────┴──────────────────────┴─────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## Chart Logic

### Time Range → Data Source

| Range | Source Table | Aggregation |
|-------|--------------|-------------|
| 7D | `inventory_v4_alias_sales_history` | Daily (by `purchased_at`) |
| 30D | `inventory_v4_alias_sales_history` | Daily (by `purchased_at`) |
| 90D | `inventory_v4_alias_sales_history` | Daily (by `purchased_at`) |
| 13M | `inventory_v4_alias_sales_daily` | Already daily aggregates |
| ALL | `inventory_v4_alias_sales_monthly` | Already monthly aggregates |

### Chart Data Points

```typescript
interface ChartPoint {
  date: string           // YYYY-MM-DD or YYYY-MM
  avgPrice: number       // Weighted average sale price
  minPrice: number       // Lowest sale in period
  maxPrice: number       // Highest sale in period
  volume: number         // Number of sales
}
```

### Chart Visual

- **Primary**: Area chart for avg price (smooth line, gradient fill)
- **Secondary**: Volume bars (subtle, behind price line)
- **Colors**: Dark background, primary accent for price
- **No grid lines**: Minimal, clean
- **Tooltip**: Date, Avg, High, Low, Volume

---

## Key Stats Logic

### Last Sale
```sql
SELECT price, purchased_at
FROM inventory_v4_alias_sales_history
WHERE alias_catalog_id = ?
ORDER BY purchased_at DESC
LIMIT 1
```

### Market Price (7-day weighted avg)
```sql
SELECT ROUND(SUM(price) / COUNT(*), 0) as market_price
FROM inventory_v4_alias_sales_history
WHERE alias_catalog_id = ?
  AND purchased_at >= NOW() - INTERVAL '7 days'
```

### Lowest Ask (cross-provider)
```typescript
const lowestAsk = Math.min(
  stockxMarketData.lowest_ask ?? Infinity,
  aliasMarketData.lowest_ask ?? Infinity
)
```

### Highest Bid (cross-provider)
```typescript
const highestBid = Math.max(
  stockxMarketData.highest_bid ?? 0,
  aliasMarketData.highest_bid ?? 0
)
```

---

## Size Grid Logic

### Tab: Asks
Show lowest ask per size, per provider:
- Green highlight: Better price (lower)
- Spread = StockX Ask - Alias Ask

### Tab: Bids
Show highest bid per size, per provider:
- Green highlight: Better price (higher)
- Spread = Alias Bid - StockX Bid

### Tab: Sales
Show last sale per size from `sales_history`:
```sql
SELECT DISTINCT ON (size_value)
  size_value, price, purchased_at
FROM inventory_v4_alias_sales_history
WHERE alias_catalog_id = ?
ORDER BY size_value, purchased_at DESC
```

---

## Component Breakdown

```
src/app/portfolio/market-v4/[slug]/
├── page.tsx                    # Server wrapper
├── _components/
│   ├── MarketPageV4.tsx        # Main client component
│   ├── ProductHero.tsx         # Image + info + key stats
│   ├── KeyStatsRow.tsx         # Last/Ask/Bid/Market cards
│   ├── TimeRangeToggle.tsx     # 7D/30D/90D/13M/ALL
│   ├── SalesChart.tsx          # Area + volume chart
│   ├── ChartSummary.tsx        # High/Low/Avg/Vol
│   ├── LiquidityCard.tsx       # 72h/30d/avg
│   ├── SizeFilter.tsx          # Dropdown
│   ├── PriceGridTabs.tsx       # Asks/Bids/Sales tabs
│   └── PriceGrid.tsx           # Size × Provider table
```

---

## Visual Guidelines

1. **Dark chart background**: `bg-zinc-900` or `bg-slate-900`
2. **Minimal grid**: No visible grid lines, maybe subtle Y-axis
3. **High contrast**: White text on dark, accent colors for prices
4. **Green/Red**: Up=green, Down=red (for trends)
5. **Provider colors**: StockX=emerald, Alias=blue
6. **Font**: Monospace for prices, regular for labels
7. **Spacing**: Generous padding, no cramped elements
8. **Mobile-first**: Everything works on 375px width

---

## Implementation Order

1. ✅ Fix Alias null prices (sync + query)
2. Create `useMarketPageData` hook (combines all data fetching)
3. Build `SalesChart` with time range toggle
4. Build `KeyStatsRow` with derived values
5. Build `PriceGrid` with tabs
6. Build `LiquidityCard`
7. Assemble into `MarketPageV4`
8. Polish mobile styling
9. Add desktop enhancements
