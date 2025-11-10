# Migration Fix Required

## Issue Found

The initial migration `20251113_watchlist_alerts_and_activity.sql` had schema errors:

### Problems:
1. ❌ Referenced `wi.currency` column that doesn't exist in `watchlist_items`
2. ❌ Referenced `NEW.currency` in trigger that doesn't exist
3. ❌ Referenced `NEW.user_id` in watchlist trigger (user_id is in parent `watchlists` table)

### Root Cause:
The `watchlist_items` table schema is:
```sql
CREATE TABLE watchlist_items (
  id UUID,
  watchlist_id UUID,  -- FK to watchlists (which has user_id)
  sku TEXT,
  size TEXT,
  target_price NUMERIC,
  created_at TIMESTAMPTZ,
  last_triggered_at TIMESTAMPTZ  -- our new column
);
```

**No `currency` or `user_id` columns in watchlist_items!**

---

## ✅ Solution: FIXED Migration Created

**File:** `supabase/migrations/20251113_watchlist_alerts_FIXED.sql`

### Fixes Applied:

1. **Removed currency references** - Hardcoded to 'GBP' for now
2. **Fixed user_id lookup** - Gets `user_id` from parent `watchlists` table via JOIN
3. **Added DROP statements** - Allows clean reapplication if partially applied
4. **Fixed trigger** - Properly queries `watchlists` table for `user_id`

### Key Changes:

```sql
-- BEFORE (broken):
SELECT median_price FROM tcg_latest_prices
WHERE sku = v_item.sku AND currency = v_item.currency  -- ❌ v_item.currency doesn't exist

-- AFTER (fixed):
SELECT median_price FROM tcg_latest_prices
WHERE sku = v_item.sku AND currency = 'GBP'  -- ✅ Hardcoded GBP

-- BEFORE (broken):
PERFORM log_portfolio_activity(NEW.user_id, ...)  -- ❌ NEW.user_id doesn't exist

-- AFTER (fixed):
SELECT user_id INTO v_user_id FROM watchlists WHERE id = NEW.watchlist_id;
PERFORM log_portfolio_activity(v_user_id, ...)  -- ✅ Fetched from parent table
```

---

## 🚀 Next Steps

### 1. Apply FIXED Migration

**Via Supabase Dashboard (Recommended):**
1. Go to Supabase Dashboard → SQL Editor
2. Copy **entire contents** of `supabase/migrations/20251113_watchlist_alerts_FIXED.sql`
3. Paste and Execute
4. Verify success message

**Via CLI (if psql available):**
```bash
psql "$DATABASE_URL" -f supabase/migrations/20251113_watchlist_alerts_FIXED.sql
```

### 2. Verify Installation

Run the verification script:
```bash
source .env.local && node scripts/verify-watchlist-migration.mjs
```

Expected output:
```
✅ Column last_triggered_at exists
✅ Table portfolio_activity_log exists
✅ Function refresh_watchlist_alerts works
   Triggered count: 0
```

### 3. Test Endpoints

```bash
# Test check-targets (requires auth cookie)
curl -X POST "http://localhost:3000/api/watchlists/check-targets" \
  -H "Cookie: ..." \
  | jq '.triggered_count'

# Test alerts
curl "http://localhost:3000/api/watchlists/alerts?days=7" \
  -H "Cookie: ..." \
  | jq '.count'

# Test activity
curl "http://localhost:3000/api/portfolio/activity?limit=10" \
  -H "Cookie: ..." \
  | jq '.count'
```

### 4. Manual Testing

1. **Test Alert Trigger:**
   - Add watchlist item with low target (e.g., £100)
   - Make sure current market price is below target
   - Call `/api/watchlists/check-targets`
   - Check Alerts tab - should show triggered alert

2. **Test Activity Logging:**
   - Add new portfolio item
   - Check activity feed - should show "Added..." entry
   - Mark item as sold
   - Check activity feed - should show "Sold..." entry

---

## 📋 Migration Files

| File | Status | Notes |
|------|--------|-------|
| `20251113_watchlist_alerts_and_activity.sql` | ❌ Broken | Has schema errors, do not use |
| `20251113_watchlist_alerts_FIXED.sql` | ✅ **Use This** | All schema issues fixed |

---

## 🔧 Technical Details

### Currency Handling

For now, alerts default to GBP. To support multi-currency:
1. Add `currency` column to `watchlist_items` table
2. Update migration to use `v_item.currency` instead of hardcoded 'GBP'
3. Update UI to allow currency selection when adding watchlist items

### User ID Lookup

The trigger now properly fetches `user_id`:
```sql
-- In trigger_log_watchlist_alert():
SELECT user_id INTO v_user_id
FROM watchlists
WHERE id = NEW.watchlist_id;
```

This is necessary because `watchlist_items` doesn't have `user_id` - only `watchlist_id`.

---

## ✅ Acceptance Criteria (After FIXED Migration)

- [ ] `watchlist_items.last_triggered_at` column exists
- [ ] `portfolio_activity_log` table exists with RLS
- [ ] `refresh_watchlist_alerts()` function works without errors
- [ ] `/api/watchlists/check-targets` returns valid JSON
- [ ] `/api/watchlists/alerts` returns enriched alerts
- [ ] `/api/portfolio/activity` returns activity entries
- [ ] Watchlists page has Alerts tab
- [ ] Portfolio page has activity feed panel
- [ ] Triggers auto-log add/sale events
- [ ] Alert trigger logs "Price alert..." activity

---

**Status:** Ready for FIXED migration application
**Date:** 2025-11-13
**Files:** See `supabase/migrations/20251113_watchlist_alerts_FIXED.sql`
