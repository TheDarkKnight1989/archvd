# P&L and Sales Table Fixes - Summary

## Issues Found & Status

### ✅ FIXED: Red/Green Color Formatting
**Issue:** Margin £ and % Gain/Loss columns weren't showing color coding
**Root Cause:** Tailwind CSS variable classes not being detected properly
**Fix Applied:** Changed from CSS variable classes (`text-success`/`text-danger`) to inline styles with hex colors
- Green: `#22DA6E` for positive values
- Red: `#FF4D5E` for negative values

**Files Modified:**
- [src/lib/format/money.tsx](src/lib/format/money.tsx:47-53)

---

### ✅ FIXED: "UK UK" Double Prefix on Size Display
**Issue:** Sales and P&L tables showing "UK UK 10" instead of "UK 10"
**Root Cause:** Database already stores sizes with "UK" prefix, but code was adding another "UK" prefix
**Fix Applied:**
- Created [formatSize()](src/lib/format/size.ts) helper function that checks if region prefix already exists
- Updated Sales table to use helper
- Updated P&L table to use helper

**Files Modified:**
- `src/lib/format/size.ts` (created)
- [src/app/portfolio/sales/_components/SalesTable.tsx:18,75](src/app/portfolio/sales/_components/SalesTable.tsx)
- [src/app/portfolio/pnl/page.tsx:12,408](src/app/portfolio/pnl/page.tsx)

---

### ⚠️  ACTION REQUIRED: P&L Table Missing Data
**Issue:** P&L table not showing size or sold price data
**Root Cause:** Database view column names don't match TypeScript interface
- View has: `purchase_price`, `sold_price`
- Code expects: `buy_price`, `sale_price`

**Migration Created:** [supabase/migrations/20250109_fix_pnl_view_columns.sql](supabase/migrations/20250109_fix_pnl_view_columns.sql)

**To Apply:**
```bash
# Option 1: Using psql (if installed)
psql "$DATABASE_URL" -f supabase/migrations/20250109_fix_pnl_view_columns.sql

# Option 2: Via Supabase Dashboard
# Go to SQL Editor and paste the contents of the migration file

# Option 3: Using migration script (set env vars first)
export NEXT_PUBLIC_SUPABASE_URL="your-url"
export SUPABASE_SERVICE_ROLE_KEY="your-key"
node scripts/apply-migration.mjs supabase/migrations/20250109_fix_pnl_view_columns.sql
```

**What the migration does:**
- Updates `vat_margin_detail_view` to alias columns correctly:
  - `purchase_price AS buy_price`
  - `sold_price AS sale_price`
  - `(sold_price - purchase_price) AS margin_gbp`
  - `vat_due AS vat_due_gbp`

---

### ⚠️  ACTION REQUIRED: Revenue KPI Not Displaying
**Issue:** P&L page KPI box shows "3 sales" but no revenue amount
**Likely Cause:** Revenue calculation in frontend might be using wrong field name or data is null
**Investigation Needed:**
Check [src/app/portfolio/pnl/page.tsx](src/app/portfolio/pnl/page.tsx) around line 350-360 where KPIs are calculated

---

### 📋 FUTURE: Size System Change (UK → US)
**User Request:** Switch from UK sizes to US sizes as default since platforms like StockX and GOAT use US sizing

**Required Changes:**
1. **Database Schema Updates:**
   - Add `size_us` column to `Inventory` table
   - Optionally add `size_eu` for European sizing
   - Keep `size_uk` for backward compatibility
   - Add conversion logic or manual entry

2. **Code Changes:**
   - Update all size inputs to default to US
   - Update `formatSize()` to default to 'US' instead of 'UK'
   - Update display logic across:
     - Portfolio table
     - Sales table
     - P&L table
     - Item forms/modals

3. **Data Migration:**
   - Convert existing UK sizes to US equivalent (approx. UK size + 0.5 for sneakers)
   - Or manually update via admin interface

**Files Affected:**
- Database: `supabase/migrations/` (new migration needed)
- [src/lib/format/size.ts](src/lib/format/size.ts) - Change default region
- All forms with size inputs
- All table columns displaying sizes

**Note:** This is a significant change affecting data model and requires careful planning for existing data.

---

## Testing Checklist

- [x] Color coding displays on Margin £ columns (green for positive, red for negative)
- [x] Color coding displays on Margin % columns
- [x] Color coding displays on % Gain/Loss columns
- [x] Sales table shows "UK 10" not "UK UK 10"
- [x] P&L table shows "UK 10" not "UK UK 10"
- [ ] Apply P&L view migration
- [ ] P&L table displays size column correctly
- [ ] P&L table displays sold price correctly
- [ ] Revenue KPI shows correct amount
- [ ] All three tables compile without errors

---

## Quick Reference

### Color Coding
- **Success (Green):** `#22DA6E` - Used for positive values, gains
- **Danger (Red):** `#FF4D5E` - Used for negative values, losses

### Size Formatting
```typescript
import { formatSize } from '@/lib/format/size'

formatSize('10', 'UK')        // "UK 10"
formatSize('UK 10', 'UK')     // "UK 10" (doesn't duplicate)
formatSize(null, 'UK')        // "—"
```

### Money Formatting
```typescript
import { MoneyCell, PercentCell, PlainMoneyCell } from '@/lib/format/money'

<MoneyCell value={margin} showArrow />  // Green/red with arrow
<PercentCell value={gainPct} />          // Green/red percentage
<PlainMoneyCell value={price} />         // No color coding
```

---

**Date:** 2025-11-09
**Status:** Partially Complete - Migration Required
