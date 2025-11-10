# Implementation Status – Matrix V2 Complete Workflows

## ✅ Completed Features

### 1. Database Migrations
**Location:** `supabase/migrations/`

Three migrations created (need to be applied via Supabase SQL Editor):

- **`20251109_audit_events.sql`**
  - `audit_events` table with RLS policies
  - Tracks all user actions (items, imports, exports, subscriptions, etc.)
  - Helper function `log_audit_event()` for easy server-side logging
  - Indexes for performance on `user_id`, `created_at`, `event_type`

- **`20251109_mark_as_sold.sql`**
  - Adds sale fields to `inventory` table:
    - `sold_price`, `sold_date`, `sale_platform`
    - `sale_fees`, `sale_shipping`
  - Creates `sales_view` for querying sold items
  - Automatic trigger to log `item.sold` events

- **`20251109_subscriptions.sql`**
  - `subscriptions` table for recurring expenses
  - Fields: name, vendor, amount, currency, interval (monthly/annual), next_charge, notes, is_active
  - `subscription_monthly_cost` view for dashboard KPIs
  - Automatic audit logging for subscription events
  - Full RLS policies (users can CRUD own subscriptions)

### 2. Mark as Sold – Complete Flow
**Files:**
- API: `src/app/api/items/[id]/mark-sold/route.ts`
- Modal: `src/components/modals/MarkAsSoldModal.tsx`

**Features:**
- Full form with sold price, date, platform, fees, shipping, notes
- Real-time margin calculation preview (profit/loss %)
- Toast notification with action to view Sales page
- Automatic audit event via database trigger
- Form validation and error handling
- Matrix V2 styling with glow effects

**Usage:**
```typescript
// From inventory row actions:
<MarkAsSoldModal
  open={open}
  onOpenChange={setOpen}
  item={selectedItem}
  onSuccess={() => router.refresh()}
/>
```

### 3. Activity Feed
**Files:**
- Page: `src/app/portfolio/activity/page.tsx`
- Component: `src/app/portfolio/activity/ActivityFeed.tsx`

**Features:**
- Lists all audit events in reverse chronological order
- Filter chips by event type (items, batch, expenses, subscriptions, etc.)
- Color-coded icons based on event type
- Relative timestamps ("2h ago", "yesterday")
- Links back to entities
- Responsive Matrix V2 design

**Route:** `/portfolio/activity`

### 4. Subscriptions Feature
**Files:**
- Page: `src/app/portfolio/subscriptions/page.tsx`
- Content: `src/app/portfolio/subscriptions/SubscriptionsContent.tsx`
- Dialog: `src/app/portfolio/subscriptions/SubscriptionDialog.tsx`
- Card: `src/app/portfolio/subscriptions/SubscriptionCard.tsx`

**Features:**
- Monthly total KPI card (auto-calculated)
- Add/edit/delete subscriptions
- Toggle active/inactive status
- Annual subscriptions show monthly equivalent
- Next charge date tracking
- Notes field for additional context
- Automatic audit logging
- Separate sections for active/inactive subscriptions

**Route:** `/portfolio/subscriptions`

### 5. Helper Libraries
**File:** `src/lib/logEvent.ts`

Server-side utility for logging audit events:
```typescript
import { logEvent, EventTypes } from '@/lib/logEvent'

await logEvent({
  event_type: EventTypes.ITEM_CREATED,
  entity_type: 'inventory',
  entity_id: item.id,
  title: `Added ${item.name}`,
  description: `${item.brand} ${item.model}`,
  metadata: { sku: item.sku, price: item.purchase_price }
})
```

---

## 📋 Pending Features

### 1. Portfolio Landing Page Overhaul
**Spec Requirements:**
- Header KPIs:
  - Portfolio Market Value
  - Invested
  - Unrealised P/L (£ & %)
- Time-range control (Today / 7d / 30d / 90d / Lifetime)
- Portfolio value chart (Area chart with Recharts, gradient styling)
- Portfolio Breakdown cards by category (Sneakers, Apparel, Accessories, Other):
  - Profit/Loss, Return %, Items count, Invested
  - 2× Most valuable items
  - 5× Top movers

**Data Sources Needed:**
- `item_valuation_snapshots` table for historical chart data
- Aggregated metrics from inventory

**Hooks to Create:**
- `usePortfolioKPIs(range)`
- `usePortfolioSeries(range)`
- `usePortfolioBreakdown(range)`

### 2. Market Page (Read-only MVP)
**Spec Requirements:**
- Search by SKU/brand/model
- Table of sizes with latest price, source, as_of timestamp
- MarketModal component (already exists at `src/components/MarketModal.tsx`)
- 30-day price chart per size
- Stats: median, min, max

**Data Sources Needed:**
- `product_catalog` table (SKU, brand, model, colorway, image_url, retail_price)
- `product_market_prices` table (SKU, size, source, price, as_of, currency)

**API Endpoint:**
- `GET /api/market/:sku` → returns product + latest prices per size

**Route:** `/portfolio/market` (already exists, needs enhancement)

### 3. Polish & Accessibility
**Improvements:**
- Sidebar hover-expand animation (Matrix glow/focus)
- Currency switcher (GBP ↔ EUR) with `fx_rates` helper
- KPI number animations (120ms, respect `prefers-reduced-motion`)
- Skeleton/empty states across all pages
- Right-align all currency columns
- Tabular numerals everywhere
- Focus rings visible, modals trap focus, keyboard navigation

---

## 🚀 Next Steps

### Immediate (Apply Migrations)
1. Go to Supabase SQL Editor
2. Run `20251109_audit_events.sql`
3. Run `20251109_mark_as_sold.sql`
4. Run `20251109_subscriptions.sql`

### Quick Wins
1. Add "Mark as Sold" button to inventory table row actions
2. Link to Activity Feed from sidebar
3. Link to Subscriptions from sidebar
4. Test entire Mark as Sold flow end-to-end

### Medium Priority
1. Build Portfolio landing page overhaul
   - Design KPI cards component
   - Integrate Recharts for portfolio value chart
   - Create breakdown cards per category
2. Seed market data for demos
3. Enhance Market page with real data

### Polish Phase
1. Add animations and transitions
2. Improve empty states
3. Add keyboard navigation
4. Test accessibility with screen reader

---

## File Structure Summary

```
src/
├─ app/
│  ├─ api/
│  │  └─ items/[id]/mark-sold/route.ts      ✅ New
│  └─ portfolio/
│     ├─ activity/
│     │  ├─ page.tsx                         ✅ New
│     │  └─ ActivityFeed.tsx                 ✅ New
│     └─ subscriptions/
│        ├─ page.tsx                          ✅ New
│        ├─ SubscriptionsContent.tsx          ✅ New
│        ├─ SubscriptionDialog.tsx            ✅ New
│        └─ SubscriptionCard.tsx              ✅ New
├─ components/
│  └─ modals/
│     └─ MarkAsSoldModal.tsx                  ✅ Updated
└─ lib/
   └─ logEvent.ts                             ✅ New

supabase/
└─ migrations/
   ├─ 20251109_audit_events.sql               ✅ New
   ├─ 20251109_mark_as_sold.sql               ✅ New
   └─ 20251109_subscriptions.sql              ✅ New
```

---

## Testing Checklist

### Mark as Sold
- [ ] Apply migrations
- [ ] Mark item as sold from inventory
- [ ] Verify item moves to Sales page
- [ ] Check audit event appears in Activity Feed
- [ ] Verify P&L reflects the sale
- [ ] Test margin calculation accuracy

### Subscriptions
- [ ] Apply migrations
- [ ] Add new subscription
- [ ] Edit subscription
- [ ] Toggle active/inactive
- [ ] Delete subscription
- [ ] Verify monthly total calculation
- [ ] Check audit events

### Activity Feed
- [ ] Apply migrations
- [ ] Verify events appear for all actions
- [ ] Test type filters
- [ ] Check entity links work
- [ ] Verify timestamps

### RLS Security
- [ ] Test with second user account
- [ ] Verify users can't see each other's data
- [ ] Confirm authenticated users can read/write own data

---

## Notes

- All new features use Matrix V2 design tokens (elev-1, elev-2, accent, etc.)
- All forms respect 120ms transition timing
- All currency values use tabular-nums and right alignment
- Toast notifications use sonner library
- Server components for data fetching, client components for interactions
- RLS enabled on all new tables
