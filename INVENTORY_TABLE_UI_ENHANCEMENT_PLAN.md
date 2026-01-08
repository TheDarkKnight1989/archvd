# Inventory Table UI Enhancement Plan
**Goal:** Match the inventory table UI to the master market data schema capabilities

---

## Current State (Before)

| Column | Data Source | Limitations |
|--------|-------------|-------------|
| Market Value | `stockx_market_latest.lowest_ask` | Single provider only |
| Highest Bid | `stockx_market_latest.highest_bid` | No Alias comparison |
| Listed Price | `stockx_listings.amount` | No visibility into tier options |
| Performance % | Calculated | Based on single price point |

**Problems:**
- Users can't see if Alias has better prices
- No visibility into Flex/Consigned savings
- No volume indicators (is this a liquid item?)
- No market depth info (how many buyers/sellers?)

---

## Enhanced State (After)

### New Columns to Add

#### 1. **Best Market Price** (Enhanced)
```
Current: £145.00 (StockX)
Enhanced: £145.00 ↓ £138 Alias  [Compare]
```
- Shows best price across all providers
- Highlights savings opportunity
- Click "Compare" to see full breakdown

#### 2. **Volume Indicator** (New)
```
🔥 High (98 sales/30d)
📊 Medium (42 sales/30d)
📉 Low (5 sales/30d)
```
- Visual indicator of liquidity
- Helps users prioritize which items to list
- Sourced from `sales_last_30d` in master_market_data

#### 3. **Tier Options** (New)
```
Standard: £145
Flex: £142 (-2%)
Consigned: £138 (-5%)
```
- Shows all available pricing tiers
- User can choose which tier to list at
- Sourced from `is_flex`, `is_consigned` rows

#### 4. **Market Depth** (New)
```
87 asks | 43 bids
Spread: 7.2%
```
- Shows supply/demand balance
- Tight spread = liquid market
- Sourced from `ask_count`, `bid_count`

#### 5. **Volatility Badge** (New)
```
🟢 Stable (4% volatility)
🟡 Moderate (12% volatility)
🔴 Volatile (24% volatility)
```
- Risk indicator for holding inventory
- Sourced from `volatility` column (StockX only)

---

## Visual Mockup (Desktop)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ Item                      │ Best Price    │ Volume   │ Tiers      │ Depth     │ P&L      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ 🖼️ Jordan 1 Low Panda    │ £145.00       │ 🔥 High  │ Std: £145  │ 87 asks   │ +£23     │
│    DD1391-100 · UK 10.5   │ ↓ £138 Alias  │ 98/30d   │ Flex: £142 │ 43 bids   │ (+18%)   │
│                           │ [Compare]     │          │ [Select]   │ 7.2% spr  │ 🟢 Stable│
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Visual Mockup (Mobile)

```
┌───────────────────────────────────┐
│ 🖼️ Jordan 1 Low Panda            │
│ DD1391-100 · UK 10.5              │
│                                   │
│ Best Price: £145.00 (StockX)      │
│ ↓ Save £7 on Alias [View]         │
│                                   │
│ 🔥 High Volume (98 sales/30d)    │
│ 📊 Spread: 7.2% (87 asks, 43 bids)│
│ 🟢 Stable (4% volatility)         │
│                                   │
│ P&L: +£23 (+18%)                  │
│ [List] [Reprice] [Compare]        │
└───────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Quick Wins (1-2 hours)
**Goal:** Show multi-provider pricing without major UI changes

1. ✅ Fix broken useInventoryV3.ts (DONE)
2. Add Alias price to existing Market Value column:
   ```tsx
   {stockxPrice > aliasPrice && (
     <div className="text-xs text-green-500">
       ↓ £{aliasPrice} on Alias
     </div>
   )}
   ```
3. Add volume badge next to SKU:
   ```tsx
   {sales30d > 50 && <Badge>🔥 High Volume</Badge>}
   ```

**Result:** Users can see Alias savings and volume at a glance

---

### Phase 2: Tier Selector (2-3 hours)
**Goal:** Let users choose Standard/Flex/Consigned when listing

1. Add "Tier" dropdown to ListOnStockXModal:
   ```tsx
   <Select value={tier} onChange={setTier}>
     <option value="standard">Standard (£145)</option>
     <option value="flex">Flex (£142) - Save £3</option>
   </Select>
   ```

2. Fetch tier prices from `master_market_latest`:
   ```ts
   const tiers = await supabase
     .from('master_market_latest')
     .select('lowest_ask, is_flex, is_consigned')
     .eq('provider', 'stockx')
     .eq('provider_variant_id', variantId)
   ```

3. Pass selected tier to listing API

**Result:** Users can choose cheapest tier when listing

---

### Phase 3: Comparison Modal (3-4 hours)
**Goal:** Full side-by-side provider comparison

1. Create `<PriceComparisonModal>` component
2. Show table:
   ```
   Provider | Lowest Ask | Highest Bid | Sales (30d) | Spread
   ─────────────────────────────────────────────────────────
   StockX   | £145       | £130        | 98          | 10.3%
   Alias    | £138       | £125        | 42          | 9.4%
   ```
3. Add "List Here" button for each provider

**Result:** Users can make informed listing decisions

---

### Phase 4: Advanced Metrics (2-3 hours)
**Goal:** Show volatility, market depth, price premium

1. Add expandable row in table (click to expand)
2. Show advanced metrics:
   - Volatility chart (30-day price fluctuation)
   - Price premium over retail
   - Market depth histogram
   - Sales velocity trend

**Result:** Power users get full market intelligence

---

## Data Requirements

### Already Available ✅
- Multi-provider prices (`master_market_latest`)
- Volume metrics (`sales_last_30d`)
- Spread calculations (`spread_percentage`)
- Tier flags (`is_flex`, `is_consigned`)

### Need to Populate ⚠️
- `master_market_data` table is likely empty
- Need to run sync scripts to populate

### To Implement 🔨
- Tier selection in listing modals
- Price comparison modal component
- Volume badge component
- Volatility indicator component

---

## Quick Test Checklist

Before building UI, verify data is ready:

1. ✅ `master_market_data` table exists
2. ⚠️ Table has data (run: `SELECT COUNT(*) FROM master_market_data`)
3. ⚠️ `master_market_latest` view is populated
4. ⚠️ Multiple tiers exist (Flex/Consigned rows)

**If counts are 0, you need to:**
1. Run StockX sync script
2. Run Alias sync script
3. Refresh materialized view: `SELECT refresh_master_market_latest()`

---

## Success Metrics

After full implementation, users should be able to:

- ✅ See best price across all providers at a glance
- ✅ Identify high-volume items worth listing first
- ✅ Choose Flex/Consigned to save on fees
- ✅ Avoid volatile items (reduce risk)
- ✅ Find tight-spread items (quick flips)
- ✅ Compare providers side-by-side before listing

---

## Next Steps

1. **Immediate:** Verify `master_market_data` has data
2. **Quick Win:** Implement Phase 1 (Alias price hint)
3. **High Value:** Implement Phase 2 (Tier selector)
4. **Polish:** Implement Phases 3-4 when ready

**Estimated Total Time:** 8-12 hours for full implementation
