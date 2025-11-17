# Dashboard V2 Summary

## Overview

The Dashboard V2 is a complete redesign inspired by Scout 2.0, focusing on providing a clean, informative, and actionable portfolio overview. It replaces the previous dashboard (now archived as `page_v1_old.tsx`) with a modern, data-rich interface.

---

## Architecture

### Components

**Location:** `src/app/portfolio/components/v2/`

1. **DashboardHero** - 3-tile hero section
   - Estimated Value (with unrealised P/L absolute + %)
   - Invested (with item count)
   - Unrealised P/L (with performance % and 7-day delta)

2. **DashboardChart** - Portfolio value over time
   - Timeframe controls: 24H, 1W, 1M, YTD, ALL, Custom (planned)
   - Interactive line chart using Recharts
   - Tooltip with date and value

3. **DashboardReports** - 9-card reports grid
   - Net Profit
   - Sales Income
   - Item Spend
   - Net Profit From Sold Items
   - Items Purchased
   - Items Sold
   - Subscription Spend
   - Expense Spend
   - Total Spend

4. **DashboardMovers** - Top performing inventory items
   - Sortable by Performance % or Market Value
   - Shows thumbnail, brand/model, size, price, and gain
   - Expandable list (shows top 10, can expand to all)

### Hooks

**Location:** `src/hooks/`

1. **useDashboardReports** (`useDashboardReports.ts`)
   - Fetches aggregated metrics from `/api/portfolio/reports`
   - Accepts date range and currency
   - Returns sales, purchase, expense, and profit metrics

2. **useDashboardMovers** (`useDashboardMovers.ts`)
   - Reuses existing `usePortfolioInventory`
   - Filters active items with valid market data
   - Sorts by performance % or market value
   - Returns top N items (default 15)

### API Endpoints

1. **`/api/portfolio/overview`** (existing)
   - Returns KPIs: estimatedValue, invested, unrealisedPL, roi, etc.
   - Returns 30-day series for chart
   - Cached for 60s

2. **`/api/portfolio/reports`** (new)
   - Accepts: `currency`, `from`, `to` query params
   - Returns: salesIncome, netProfit, itemsSold, itemsPurchased, subscriptionSpend, expenseSpend, totalSpend
   - Cached for 60s

---

## Data Flow

### Hero Section

```
/api/portfolio/overview
  ↓
heroMetrics {
  estimatedValue: from overview.kpis.estimatedValue
  invested: from overview.kpis.invested
  unrealisedPL: from overview.kpis.unrealisedPL
  unrealisedPLDelta7d: from overview.kpis.unrealisedPLDelta7d
  roi: from overview.kpis.roi (Performance %)
  itemCount: from Inventory count query
  pricesAsOf: from overview.meta.pricesAsOf
}
  ↓
DashboardHero component
```

### Chart Section

```
/api/portfolio/overview
  ↓
overview.series30d (30-day portfolio value)
  ↓
filterSeriesByTimeframe(series, timeframe)
  ↓
DashboardChart component
```

### Reports Grid

```
User selects timeframe → getDateRangeFromTimeframe(timeframe)
  ↓
useDashboardReports(dateRange, currency)
  ↓
/api/portfolio/reports?from=X&to=Y&currency=Z
  ↓
Aggregates from:
  - Inventory (purchases & sales)
  - Subscriptions table
  - Calculates expenses (tax, shipping, sales_fee)
  ↓
Returns reportMetrics
  ↓
DashboardReports component
```

### Movers List

```
useDashboardMovers(sortBy, limit=15)
  ↓
usePortfolioInventory() - fetches all active items
  ↓
Filter: items with market_value > 0 and performance_pct != null
  ↓
Sort by: performance_pct or market_value (descending)
  ↓
Take top 15 items
  ↓
DashboardMovers component
```

---

## Metric Calculations

### Net Profit
```typescript
salesIncome - totalSpend - salesFees
```
- **salesIncome** = sum(sold_price) for items sold in period
- **totalSpend** = itemSpend + subscriptionSpend
- **salesFees** = sum(sales_fee) for items sold in period

### Net Profit From Sold Items (Realised)
```typescript
salesIncome - costOfSoldItems - salesFees
```
- **salesIncome** = sum(sold_price)
- **costOfSoldItems** = sum(purchase_total) for sold items
- **salesFees** = sum(sales_fee)

### Item Spend
```typescript
sum(purchase_total) for items purchased in period
```
- **purchase_total** = purchase_price + tax + shipping (generated column in DB)

### Subscription Spend
```typescript
sum(monthly_cost * monthsInPeriod) for active subscriptions
```
- **monthsInPeriod** = daysDiff / 30.44
- **monthly_cost** = amount (if monthly) or amount/12 (if annual)

### Expense Spend
```typescript
purchaseExpenses + salesFees
```
- **purchaseExpenses** = sum(tax + shipping) for items purchased in period
- **salesFees** = sum(sales_fee) for items sold in period

### Performance %
```typescript
(profit / invested) * 100
```
- **profit** = market_value - invested
- **invested** = purchase_total

---

## Currency Handling

1. **User Currency Preference**
   - Stored in `profiles.currency_pref`
   - Accessible via `useCurrency()` hook
   - Options: GBP, EUR, USD

2. **Market Prices**
   - StockX prices are fetched in user's preferred currency
   - If price not available in user's currency, fallback to GBP with FX conversion via `fx_rates` table

3. **Reports**
   - All calculations in user's currency
   - Subscriptions: TODO - need currency conversion if subscription currency !== user currency

4. **Important**
   - Never treat USD as GBP
   - Always filter prices by currency
   - Use `useCurrency().format()` for display

---

## Timeframe Logic

| Timeframe | Date Range |
|-----------|------------|
| 24H | today - 1 day to today |
| 1W | today - 7 days to today |
| 1M | today - 1 month to today |
| YTD | Jan 1 (current year) to today |
| ALL | 2020-01-01 to today |
| Custom | User-selected (TODO) |

**Note:** For timeframes longer than 30 days (YTD, ALL), the chart currently filters the existing 30-day series. Future enhancement: fetch extended series from API.

---

## Key Features

### ✅ Implemented

- Hero section with 3 KPI tiles
- Portfolio value chart with timeframe controls (24H, 1W, 1M, YTD, ALL)
- 9-card reports grid with sales/purchase/expense metrics
- Top movers list with sort by performance or value
- Currency switching (GBP/EUR/USD)
- Responsive layout (mobile, tablet, desktop)
- Loading states for all components
- Real-time data updates (60s cache)

### 🚧 Planned

- Custom date range picker
- Extended time series for ALL/YTD (currently limited to 30 days)
- Currency conversion for subscriptions
- Export reports to CSV
- Drill-down modals (click on a metric to see details)
- Comparison mode (compare current period vs previous period)

---

## Performance Optimizations

1. **Server-Side Caching**
   - `/api/portfolio/overview` - 60s cache per user+currency
   - `/api/portfolio/reports` - 60s cache per user+currency+dateRange

2. **Client-Side Memoization**
   - `useMemo` for derived data (heroMetrics, chartSeries)
   - Prevents unnecessary recalculations on re-renders

3. **Parallel Fetching**
   - Overview and Reports fetched concurrently
   - Movers data computed client-side from inventory (single fetch)

4. **Lazy Loading**
   - Movers list shows top 10, expands on demand
   - Reduces initial render time

---

## Migration Notes

### What Changed

- **Old Dashboard** (`page_v1_old.tsx`)
  - PortfolioOverview component (4 KPI cards + sparkline)
  - Recent Activity feed
  - Items Table
  - Toolbar with filters

- **New Dashboard** (`page.tsx`)
  - DashboardHero (3 KPI tiles)
  - DashboardChart (interactive time series)
  - DashboardReports (9 metric cards)
  - DashboardMovers (top performers list)

### What Stayed

- `/portfolio/inventory` - Inventory table page (unchanged)
- `/portfolio/sales` - Sales page (unchanged)
- `/portfolio/pnl` - P&L page (unchanged)
- `/api/portfolio/overview` - Overview endpoint (unchanged, reused)

### Breaking Changes

- **None** - Old routes still work
- Old dashboard backed up as `page_v1_old.tsx`

---

## Troubleshooting

### Issue: Reports showing $0 for all metrics

**Cause:** Date range doesn't match any data in Inventory table

**Solution:**
- Check `purchase_date` and `sold_date` fields are populated
- Try expanding timeframe to "ALL"
- Verify Inventory table has data for user

### Issue: Movers list is empty

**Cause:** No items with valid market data

**Solution:**
- Ensure items have StockX/Alias links in `inventory_market_links`
- Verify market prices exist in `stockx_latest_prices` or equivalent
- Check `market_value` field is populated

### Issue: Chart shows "No data available"

**Cause:** No portfolio value history in `portfolio_value_daily`

**Solution:**
- Check if `portfolio_value_daily` table is being populated
- Verify scheduler/cron job is running
- For new accounts, it may take 24h to build history

---

## Future Enhancements

1. **Custom Date Range Picker**
   - Add calendar UI for selecting custom date ranges
   - Save favorite date ranges

2. **Period Comparison**
   - Show % change vs previous period
   - "This month vs last month" comparison mode

3. **Export Functionality**
   - Export reports to CSV/PDF
   - Email scheduled reports

4. **Drill-Down Views**
   - Click on a metric to see detailed breakdown
   - Filter reports by brand, category, etc.

5. **Real-Time Updates**
   - WebSocket integration for live price updates
   - Auto-refresh every 60s

6. **Mobile Optimizations**
   - Swipeable cards on mobile
   - Bottom sheet for movers list

---

## Related Documentation

- [Portfolio Overview API](../src/app/api/portfolio/overview/route.ts)
- [Reports API](../src/app/api/portfolio/reports/route.ts)
- [Currency Hook](../src/hooks/useCurrency.ts)
- [Inventory Hook](../src/hooks/usePortfolioInventory.ts)
- [Design Spec](./DASHBOARD_V2_DESIGN.md)
