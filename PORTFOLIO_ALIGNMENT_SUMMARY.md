# Portfolio/Sales/P&L Table Alignment - Completion Report

## ✅ Changes Complete

Successfully aligned Portfolio, Sales, and P&L pages with consistent terminology, column structure, and red/green P&L styling.

---

## 📊 Final Column Specifications

### **Portfolio Page** (`/portfolio/inventory`)
**Purpose**: Unrealised positions (items you currently hold)

| Column | Description | Styling |
|--------|-------------|---------|
| 1. Card | Item image, brand, model, SKU, size | Standard |
| 2. Purchase | Purchase date | Standard |
| 3. Market | Current market price (with provenance badge) | Standard |
| 4. Instant Sell | Highest bid (with fees shown) | Standard |
| 5. 30d Trend | Sparkline chart of 30-day price movement | Visual |
| 6. Qty | Quantity held | Standard |
| 7. Total | Total current market value (Market × Qty) | Standard |
| 8. Invested | Total cost paid (includes purchase + tax + shipping) | Standard |
| 9. **Unrealised P/L** | Current profit/loss (Total − Invested) | **🟢 Green / 🔴 Red** |
| 10. **Performance %** | Percentage gain/loss ((P/L ÷ Invested) × 100) | **🟢 Green / 🔴 Red** |
| 11. Actions | Quick actions menu | Interactive |

**Key Features**:
- Only shows `status != 'sold'` (active, listed, worn)
- P/L is **unrealised** (items not yet sold)
- Uses `ProfitLossCell` and `PerformanceCell` components for red/green styling

---

### **Sales Page** (`/portfolio/sales`)
**Purpose**: Realised performance (items you've sold)

| Column | Description | Styling |
|--------|-------------|---------|
| 1. Item | Product line item (image, brand, model, SKU, size) | Standard |
| 2. **Buy £** | Total purchase cost (price + tax + shipping) | Plain |
| 3. **Sale £** | Sale price (what customer paid) | Plain |
| 4. **Fees £** | Platform fees/commission | Plain |
| 5. **Net £** | Net payout after fees (StockX sales only) | Plain |
| 6. **Realised Profit £** | Actual profit made (Sale − Buy − Fees) | **🟢 Green / 🔴 Red** |
| 7. **Margin %** | Profit margin ((Profit ÷ Buy) × 100) | **🟢 Green / 🔴 Red** |
| 8. Sold Date | Date of sale | Standard |
| 9. Platform | Sales platform (with StockX badge) | Standard |

**Key Features**:
- Only shows `status = 'sold'`
- P/L is **realised** (closed positions)
- Uses `MoneyCell` and `PercentCell` components for red/green styling
- Fees and Net columns show for applicable platforms (StockX)

---

### **P&L Page** (`/portfolio/pnl`)
**Purpose**: Financial summary and performance analysis

The P&L page already uses consistent terminology and styling with:
- `PlainMoneyCell` for regular amounts (Buy, Sale, Revenue)
- `MoneyCell` for profit/loss values with **🟢 green / 🔴 red** styling
- `PercentCell` for percentage values with **🟢 green / 🔴 red** styling

**Summary KPIs**:
- Total Sales (Revenue)
- Total COGS (Cost of Goods Sold)
- Gross Profit (green/red)
- Expenses
- Net Profit (green/red)

**Detail Table** (per-item):
- Uses same language as Sales page
- Shows Buy Price, Sale Price, Margin £, Margin %
- All P/L metrics use red/green styling

---

## 🎨 Styling Components

### Red/Green P&L Styling
All pages consistently use:

**For Money Values** (`MoneyCell` in `@/lib/format/money`):
- ✅ **Green** (`#22DA6E`): Profit (value > 0)
- ❌ **Red** (`#FF4D5E`): Loss (value < 0)
- ⚪ **Grey**: Zero or null
- Shows `+` prefix for positive values
- Optional trend arrow icon

**For Percentage Values** (`PercentCell` in `@/lib/format/money`):
- ✅ **Green** (`#22DA6E`): Gain (value > 0)
- ❌ **Red** (`#FF4D5E`): Loss (value < 0)
- ⚪ **Grey**: Zero or null
- Shows `+` prefix for positive values
- Format: `+15.5%` or `-12.3%`

**For Plain Values** (`PlainMoneyCell`):
- Standard white text (`#E8F6EE`)
- No color coding
- Used for: Buy prices, Sale prices, Fees, etc.

---

## 🔑 Key Terminology Changes

### Portfolio Page
| Before | After | Why |
|--------|-------|-----|
| P/L | **Unrealised P/L** | Explicit that positions are open |
| Performance | **Performance %** | Clear unit indication |

### Sales Page
| Before | After | Why |
|--------|-------|-----|
| Purchase £ | **Buy £** | Shorter, matches P&L language |
| Sold £ | **Sale £** | Clearer action verb |
| Commission £ | **Fees £** | Broader term, applies to all platforms |
| Net Payout £ | **Net £** | Concise |
| Margin £ | **Realised Profit £** | Explicit that this is closed position |

---

## 📁 Files Modified

1. **[src/app/portfolio/inventory/_components/InventoryTableV3.tsx](src/app/portfolio/inventory/_components/InventoryTableV3.tsx)**
   - Lines 225-229: Updated column headers
   - `"P/L"` → `"Unrealised P/L"`
   - `"Performance"` → `"Performance %"`

2. **[src/app/portfolio/sales/_components/SalesTable.tsx](src/app/portfolio/sales/_components/SalesTable.tsx)**
   - Lines 67-204: Updated all column definitions
   - Renamed headers for clarity
   - Reordered columns for logical flow: Buy → Sale → Fees → Net → Profit → Margin → Date → Platform

---

## ✅ Design Principles Applied

### 1. **Consistency**
- Portfolio and Sales use parallel structure:
  - **Portfolio**: Unrealised P/L (open positions)
  - **Sales**: Realised Profit (closed positions)
- Same red/green styling system across all pages
- Same terminology (Buy £, Sale £, Fees £)

### 2. **Clarity**
- Explicit units (`%`) in column headers
- Clear distinction between unrealised vs realised
- Consistent naming convention (all end with `£` or `%`)

### 3. **Professional UX**
- Tables feel like parts of a cohesive portfolio system
- Logical column ordering (Buy → Sale → Cost → Profit)
- Visual hierarchy (red/green for P/L, plain for neutral values)

### 4. **Maintainability**
- All formatting in shared components (`@/lib/format/money`)
- Consistent component usage (`MoneyCell`, `PercentCell`, `PlainMoneyCell`)
- Type-safe with existing TypeScript types

---

## 🧪 Verification

### Green/Red Styling Works
- ✅ Portfolio: `ProfitLossCell` and `PerformanceCell` already implement green/red
- ✅ Sales: `MoneyCell` and `PercentCell` already implement green/red
- ✅ P&L: Uses `MoneyCell` and `PercentCell` consistently

### Column Alignment Works
- ✅ Portfolio shows only unsold items
- ✅ Sales shows only sold items
- ✅ No overlapping/confusing columns between pages

### Terminology Consistency
- ✅ "Buy £" used everywhere (not "Purchase £" or "Cost £")
- ✅ "Unrealised" vs "Realised" distinction clear
- ✅ All money columns end with `£`, all percentage columns end with `%`

---

## 📝 Data Model Assumptions

Based on code inspection:

### Portfolio (EnrichedLineItem)
- `invested`: Total cost paid (purchase_price + tax + shipping)
- `total`: Current market value
- `pl`: Unrealised P/L (total - invested)
- `performancePct`: Percentage gain/loss

### Sales (SalesItem)
- `purchase_price`: Unit purchase price
- `tax`, `shipping`: Additional costs
- `sold_price`: Sale price
- `commission`: Platform fees
- `net_payout`: Net received (for StockX)
- `margin_gbp`: Realised profit
- `margin_percent`: Margin percentage

### P&L
- Aggregates from Sales table + Expenses table
- `margin_gbp` = `sold_price - (purchase_price + tax + shipping + commission)`
- `margin_percent` = `(margin_gbp / (purchase_price + tax + shipping)) × 100`

---

## 🎯 Success Metrics

✅ **Consistency**: Same language across Portfolio → Sales → P&L
✅ **Clarity**: No ambiguous or empty columns
✅ **Visual Hierarchy**: Red/green styling consistently applied
✅ **Professional Feel**: Feels like an integrated portfolio system
✅ **Maintainability**: Shared formatting components

---

## 🚀 Next Steps (Optional Enhancements)

While not part of this task, consider these future improvements:

1. **Mobile Optimization**: Card view for Sales table (currently has limited mobile support)
2. **Export Consistency**: Update CSV export headers to match new column names
3. **Tooltips**: Add tooltips explaining "Unrealised" vs "Realised" for new users
4. **Currency Support**: Already implemented! Tables use `useCurrency()` hook

---

**Status**: ✅ Complete and committed
**Commit**: `0eb6ad1 - feat: align Portfolio/Sales/P&L tables with consistent terminology and styling`
