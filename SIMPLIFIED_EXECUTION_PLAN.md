# Simplified Execution Plan: Use Existing Infrastructure
**Start Date**: December 6, 2024
**Target Completion**: December 20, 2024 (2 weeks!)
**Approach**: Fix and populate existing tables (don't rebuild)

---

## 🎯 What We're NOT Doing

❌ Creating new tables (you already have them!)
❌ Complex migration (schema is good!)
❌ 6-week timeline (cut to 2 weeks!)

---

## ✅ What We ARE Doing

✅ Seed 500 products into existing `products` table
✅ Build sync jobs to fill `master_market_data`
✅ Add performance indexes
✅ Fix inventory table queries
✅ Fix market page queries
✅ Set up auto-sync

---

## 📅 2-Week Timeline

```
WEEK 1 (Dec 6-13): POPULATE DATA
├─ Day 1-2: Seed 500 products
├─ Day 3-4: Build sync jobs
├─ Day 5: First data sync
└─ Friday: You test - data exists!

WEEK 2 (Dec 16-20): FIX QUERIES & SHIP
├─ Day 1-2: Fix inventory table
├─ Day 3: Fix market pages
├─ Day 4: Set up auto-sync
└─ Day 5: SHIP! 🚀
```

---

## 📋 Week 1: Populate Data (Dec 6-13)

### Day 1-2 (Fri-Mon): Seed Products
**What I'm building:**
- Top 500 products list (Jordan, Nike, Yeezy, NB, etc.)
- Seed script to populate `products` table (which is empty)
- Map to StockX/Alias/eBay IDs
- Create size variants in `product_variants`

**What you do:**
- Review product list Tuesday (10 mins)

**Deliverable:**
- `products` table: 0 rows → 500 rows
- `product_variants` table: 0 rows → 5000+ rows

---

### Day 3-4 (Tue-Wed): Build Sync Jobs
**What I'm building:**
- Sync orchestrator (fetches data from APIs)
- StockX sync → `master_market_data`
- Alias sync → `master_market_data`
- Job queue for reliability

**What you do:**
- Nothing! I'm coding.

**Deliverable:**
- API route: `/api/cron/sync-market-data`
- Ready to sync 500 products

---

### Day 5 (Thu): First Data Sync
**What I'm building:**
- Run sync job for first 50 products
- Verify data quality
- Check `master_market_data` filling up

**What you do:**
- Nothing yet!

**Deliverable:**
- `master_market_data`: 2,371 rows → 10,000+ rows

---

### Friday Check-in (Dec 13)
**30-minute call:**
1. I demo: Database now has 500 products + market data
2. You: Check database (I'll show you SQL query)
3. We: Approve Week 2 plan

**YOUR ACTION:**
- [ ] Review product list I sent Tuesday
- [ ] Join Friday call
- [ ] Run simple SELECT query to see data

---

## 📋 Week 2: Fix Queries & Ship (Dec 16-20)

### Day 1-2 (Mon-Tue): Fix Inventory Table
**What I'm building:**
- Update `useInventoryV3` hook
- Query `master_market_data` for pricing
- Graceful fallbacks if no data
- Test with your 31 items

**What you do:**
- Test inventory page Monday evening (15 mins)
- Report if prices showing correctly

**Deliverable:**
- Inventory table shows live prices ✅

---

### Day 3 (Wed): Fix Market Pages
**What I'm building:**
- Update market page queries
- Use `master_market_data` for pricing
- Add 7-day price chart (using existing data)
- Size run comparison table

**What you do:**
- Test market pages Wednesday evening (15 mins)

**Deliverable:**
- Market pages work for 500 products ✅

---

### Day 4 (Thu): Auto-Sync Setup
**What I'm building:**
- Vercel cron job (every 6 hours)
- Tiered sync (hot products hourly, rest 6h)
- Cleanup old data (keep 30 days)

**What you do:**
- Nothing!

**Deliverable:**
- Auto-sync running ✅

---

### Day 5 (Fri): Ship!
**What I'm building:**
- Final bug fixes
- Performance testing
- Monitoring setup

**What you do:**
- Final QA (30 mins)
- Approve launch

**Deliverable:**
- PRODUCTION READY 🚀

---

## 🎯 Your Involvement (2 Weeks)

**Week 1:**
- Tuesday: Review product list (10 mins)
- Friday: Check-in call (30 mins)

**Week 2:**
- Monday: Test inventory (15 mins)
- Wednesday: Test market pages (15 mins)
- Friday: Final QA + approve (30 mins)

**Total time:** ~2 hours over 2 weeks

---

## 📊 Existing Tables We're Using

| Table | Current State | After Week 1 | After Week 2 |
|-------|---------------|--------------|--------------|
| `products` | 0 rows | 500 rows | 500 rows |
| `product_variants` | 0 rows | 5000+ rows | 5000+ rows |
| `master_market_data` | 2,371 rows | 10,000+ rows | 50,000+ rows |
| `stockx_market_latest` | 194 rows | Working | Working |
| `alias_market_snapshots` | 11 rows | Working | Working |

---

## 🚀 What You Get (In 2 Weeks!)

✅ **Inventory table**: Shows live prices for all 31 items
✅ **Market pages**: Work for 500+ products
✅ **7-day price charts**: Historical trends
✅ **Auto-sync**: Updates every 6 hours
✅ **Size run comparison**: StockX vs Alias
✅ **Free tier**: Still $0/month

---

## 🛠️ Files I'm Creating/Updating

**New files:**
```
scripts/seed-top-500-products.mjs        (populate products table)
scripts/sync-market-data.mjs             (fetch from APIs)
src/app/api/cron/sync-market-data/route.ts  (cron job)
src/lib/sync/orchestrator.ts             (sync logic)
```

**Updated files:**
```
src/hooks/useInventoryV3.ts              (fix query)
src/app/portfolio/market/[slug]/page.tsx (fix query)
vercel.json                              (add cron)
```

**NOT creating:**
```
❌ New database migrations (using existing schema)
❌ New tables (already exist)
❌ Complex architecture (keeping it simple)
```

---

## 📞 Communication

**Daily Slack updates:**
- "Starting Day X - building Y"
- You: 👍 (30 seconds)

**Tuesday:**
- I send: Product list for review
- You: Approve or suggest changes (10 mins)

**Friday:**
- 30-min call
- Demo + planning

---

## ✅ Success Metrics

**Week 1 Success:**
- [ ] `products` table has 500 rows
- [ ] `master_market_data` has 10,000+ rows
- [ ] Can query and see pricing data

**Week 2 Success:**
- [ ] Inventory table shows prices (100% working)
- [ ] Market pages load for any of 500 products
- [ ] Auto-sync running every 6 hours
- [ ] Zero errors in production

---

## 🎯 Status

**Current**: Week 1, Day 1 - Starting seed script
**Next**: Creating top 500 products list
**Your next action**: Tuesday - review product list

Let's build! 🚀
