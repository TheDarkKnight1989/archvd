# Market Data Rules

## Overview

This document defines how market prices are fetched, selected, and displayed across the Archvd portfolio system.

---

## Currency Handling

### 1. User Currency Preference
- Stored in `profiles.currency_pref` (GBP, EUR, or USD)
- Accessible via `useCurrency()` hook
- All market data queries filter by this currency

### 2. StockX Price Filtering
**Location:** `src/hooks/usePortfolioInventory.ts:113`

```typescript
const { data: stockxPrices } = await supabase
  .from('stockx_latest_prices')
  .select('sku, size, currency, lowest_ask, highest_bid, last_sale, as_of')
  .eq('currency', userCurrency)  // CRITICAL: Only fetch user's currency
  .order('as_of', { ascending: false })
```

**Key Rules:**
- ✅ **Only fetch prices matching user's currency** - prevents USD overwriting GBP
- ✅ **Order by `as_of DESC`** - ensures most recent prices come first
- ✅ **Deduplicate per SKU:size** - only keep first (most recent) entry per combination

### 3. No Cross-Currency Conversion for StockX
- If StockX price exists in user's currency → use directly
- If StockX price exists in different currency → **ignore** (don't fetch it)
- Currency conversion via `fx_rates` table is only used for fallback scenarios

---

## Price Selection Priority

### StockX Price Fallback Chain
**Location:** `src/hooks/usePortfolioInventory.ts:284`

```typescript
const marketPrice = stockxPrice.last_sale || stockxPrice.lowest_ask || stockxPrice.highest_bid
```

**Priority Order:**
1. **`last_sale`** - Actual transaction price (most accurate)
2. **`lowest_ask`** - Current lowest seller price (instant buy floor)
3. **`highest_bid`** - Current highest buyer price (instant sell floor)
4. **Custom value** - If user has set `custom_market_value` (not yet implemented)
5. **Invested fallback** - Show `purchase_total` if no market data exists

---

## Market Value Calculation

### For Items WITH Market Data

```typescript
market_value = selected_price_from_fallback_chain
market_currency = stockxPrice.currency  // Already filtered to user's currency
market_source = 'stockx'
```

### For Items WITHOUT Market Data

**Current Behavior:**
```typescript
market_value = null
Total £ = invested (purchase_total)
```

**Future Enhancement:**
Allow users to set custom market values:
```typescript
if (item.custom_market_value) {
  market_value = item.custom_market_value
  market_source = 'custom'
}
```

---

## Display Rules

### Portfolio Inventory Table
- **Market £ column**:
  - If `market_value` exists → `format(market_value × quantity)`
  - Else → `"No live price yet"` in `text-neutral-400`

- **Total £ column**:
  - If `market_value` exists → `market_value × quantity`
  - Else → `invested` (so never £0.00)

### Hero Tiles (Estimated Value)
```typescript
estimatedValue = sum of all (market_value × quantity) for items with market data
                + sum of all (invested) for items without market data
```

### Performance Calculation
```typescript
unrealisedPL = estimatedValue - invested
roi = (unrealisedPL / invested) × 100
```

---

## Data Flow Diagram

```
User opens /portfolio
    ↓
1. useCurrency() → userCurrency = 'GBP'
    ↓
2. usePortfolioInventory()
    ↓
3. Fetch StockX prices WHERE currency = 'GBP' ORDER BY as_of DESC
    ↓
4. Build price map (dedupe per SKU:size, keep most recent)
    ↓
5. For each inventory item:
    - Look up stockxPrice by SKU:size
    - Select price: last_sale || lowest_ask || highest_bid
    - If found: set market_value, market_currency, market_source
    - If not found: market_value = null
    ↓
6. Calculate totals:
    - estimatedValue = Σ(market_value × qty) + Σ(invested for unmapped items)
    - invested = Σ(purchase_total)
    - unrealisedPL = estimatedValue - invested
    ↓
7. Display in UI with proper currency formatting
```

---

## Edge Cases & Handling

### 1. No StockX Data for Item
- **Behavior**: Show invested as Total £
- **Label**: "No live price yet" in Market £ column
- **Impact**: Item still contributes to portfolio totals via invested amount

### 2. StockX Data Exists but Not in User's Currency
- **Behavior**: Ignore the price (don't fetch it due to currency filter)
- **Future**: Could add FX conversion with clear labeling

### 3. Multiple Prices for Same SKU:Size
- **Behavior**: Keep most recent (first in `as_of DESC` order)
- **Ensures**: No stale prices pollute the data

### 4. Item Quantity > 1
- **Behavior**: `market_value` and `Total £` multiply by quantity
- **Example**: 3x Yeezy @ £200 each = £600 total

---

## Testing Checklist

✅ **Currency Isolation**
- [ ] GBP user sees only GBP prices
- [ ] EUR user sees only EUR prices
- [ ] USD prices never overwrite GBP prices

✅ **Price Selection**
- [ ] Items with `last_sale` show that price
- [ ] Items without `last_sale` but with `lowest_ask` show that
- [ ] Items with only `highest_bid` show that
- [ ] Items with no StockX data show invested

✅ **Display**
- [ ] Market £ column shows prices correctly
- [ ] Total £ never shows £0.00 for added items
- [ ] Hero tile totals match sum of inventory
- [ ] Performance % calculates correctly

✅ **Edge Cases**
- [ ] Items with qty > 1 multiply correctly
- [ ] Unmapped items still show invested in Total £
- [ ] Mixed portfolio (some mapped, some not) calculates correctly

---

## Future Enhancements

### 1. Custom Market Values
Allow users to override market prices:
```typescript
if (item.custom_market_value) {
  market_value = item.custom_market_value
  market_source = 'custom'
  show_badge = '⚠️ Custom price'
}
```

### 2. Multi-Source Aggregation
Support multiple market data providers:
```typescript
const providers = ['stockx', 'goat', 'alias']
const prices = await fetchAllProviders(sku, size, userCurrency)
const bestPrice = selectBestPrice(prices, user_preference)
```

### 3. Historical Price Tracking
Store daily snapshots for:
- Portfolio value over time charts
- Individual item price history
- Performance attribution analysis

---

## Related Files

- `src/hooks/usePortfolioInventory.ts` - Main market data enrichment logic
- `src/hooks/useCurrency.ts` - Currency preference handling
- `src/app/api/portfolio/overview/route.ts` - Portfolio totals calculation
- `supabase/migrations/` - Database schema for `stockx_latest_prices`, `fx_rates`

---

**Last Updated:** 2025-11-16
**Author:** Claude Code
**Status:** Production
