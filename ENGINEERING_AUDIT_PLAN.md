# Engineering Audit & Migration Plan
**Project**: ARCHVD Market Data Platform
**Date**: December 2024
**Status**: Phase 0 - Discovery & Planning

---

## 🎯 Objective

Migrate from fragmented market data architecture to best-in-class, scalable system ready for production growth.

---

## 📋 Phase 0: Comprehensive Audit (Week 1)

### Day 1-2: Codebase Discovery

#### ✅ Automated Audit Complete
- **142 API routes** identified
  - 84 Market Data routes
  - 18 User/Portfolio routes
  - 1 Sync/Cron route (likely incomplete)
  - 37 Other routes
- **75 Components** mapped
- **32 Pages** catalogued

#### 🔍 Key Findings

**Market Data Routes** (84 endpoints):
```
High concentration of routes:
├─ /api/alias/* → 28 routes (Alias integration)
├─ /api/stockx/* → 48 routes (StockX integration)
├─ /api/market/* → 8 routes (Generic market data)
└─ /api/cron/* → Minimal sync infrastructure

⚠️ CONCERN: Heavy duplication between providers
⚠️ CONCERN: No unified market data API
```

**Sync Infrastructure** (Only 4 cron routes found):
```
├─ /api/cron/stockx/prices
├─ /api/cron/sync-alias-prices
├─ /api/cron/sync-stockx-prices
└─ /api/cron/cleanup-old-sales

⚠️ CONCERN: Ad-hoc sync jobs, no orchestration
⚠️ CONCERN: No job queue or retry logic
⚠️ CONCERN: No monitoring/observability
```

---

### Day 3: Database Schema Analysis

#### Tables to Audit (Manual SQL Required)

```sql
-- Run in Supabase SQL Editor

-- 1. Get all public tables
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY size_bytes DESC
LIMIT 30;

-- 2. Get table row counts
SELECT
  schemaname || '.' || tablename AS table_name,
  n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- 3. Find foreign key relationships
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 4. Find indexes
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexname::regclass) DESC
LIMIT 30;
```

#### Expected Tables (From Migration Files)

**Market Data Layer:**
- `master_market_data` - Unified market snapshots
- `stockx_market_latest` - StockX materialized view
- `alias_market_snapshots` - Alias snapshots
- `ebay_sold_transactions` - eBay sales
- `ebay_computed_metrics` - eBay aggregates
- `stockx_raw_snapshots` - Raw API responses
- `alias_raw_snapshots` - Raw API responses
- `alias_offer_histograms` - Bid depth data

**Product Catalog:**
- `alias_catalog_items` - Alias product catalog
- `stockx_products` - StockX product catalog
- `product_catalog` - Unified catalog (if exists)
- `stockx_variants` - StockX size variants

**User Data:**
- `Inventory` - User inventory items
- `inventory_market_links` - StockX mappings
- `inventory_alias_links` - Alias mappings

#### Questions to Answer:
1. **Which tables are actually being used?** (Row counts > 0)
2. **Which tables overlap?** (Duplicate data across tables)
3. **What's the foreign key graph?** (Data dependencies)
4. **Where are the orphaned records?** (Broken relationships)
5. **What's the data quality?** (NULL columns, stale data)

---

### Day 4: Data Flow Mapping

#### Critical User Journeys

**Journey 1: Add Item to Inventory**
```
Current Flow (suspected):
1. User enters SKU → /api/items/add-by-sku
2. Search catalog (which table? alias_catalog_items?)
3. Create Inventory row
4. Create market links (inventory_market_links, inventory_alias_links)
5. Trigger sync? (uncertain)
6. Display item in inventory table

Questions:
- What if SKU not in catalog?
- Does it auto-sync market data?
- Which table does inventory table query for prices?
```

**Journey 2: View Market Page**
```
Current Flow (from code):
1. User visits /portfolio/market/[slug]
2. Query catalog by slug
3. Query inventory item (if itemId provided)
4. Query StockX via inventory_market_links
5. Query Alias via SKU match
6. Query size run (how?)
7. Render

Issues Found:
- Queries multiple tables sequentially
- No caching
- Falls back to SKU search if slug not found
- Commented out debug code
```

**Journey 3: Background Sync**
```
Current Flow (unclear):
1. Cron triggers /api/cron/sync-stockx-prices
2. Does it sync all products? User products only?
3. Where does it write? (master_market_data? stockx_market_latest?)
4. How does inventory table get updated prices?

⚠️ CRITICAL GAP: Need to trace sync flow completely
```

#### Data Flow Diagram (To Create)

```
Need to map:
┌─────────────┐
│  External   │
│   APIs      │
│(StockX/Alias│
│   /eBay)    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Sync      │
│   Jobs      │
│  (Cron)     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Database   │
│  (Which     │
│   tables?)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   API       │
│  Routes     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   UI        │
│ Components  │
└─────────────┘
```

---

### Day 5: Gap Analysis & Risk Assessment

#### Current State Assessment

| Area | Status | Quality | Risk |
|------|--------|---------|------|
| **Database Schema** | 🟡 Partial | Multiple overlapping tables | High |
| **Market Data Sync** | 🔴 Broken | No orchestration, manual only | Critical |
| **API Routes** | 🟡 Working | Fragmented, duplicative | Medium |
| **Inventory Table** | 🔴 Broken | Relies on empty tables | Critical |
| **Market Pages** | 🟢 Working | For products with data | Low |
| **Product Catalog** | 🟡 Partial | Only 13 products | Medium |
| **Monitoring** | 🔴 None | No visibility | High |
| **Testing** | 🟡 Minimal | No integration tests | Medium |

#### Gap Analysis

**Gap 1: No Unified Product Catalog**
- Current: Products scattered across alias_catalog_items, stockx_products
- Impact: Can't build market pages for products users don't own
- Priority: **CRITICAL**

**Gap 2: No Market Data Pipeline**
- Current: Manual syncs, no automation
- Impact: Stale data, broken user experience
- Priority: **CRITICAL**

**Gap 3: No Job Queue System**
- Current: Direct API calls in cron jobs
- Impact: No retry, no error handling, no observability
- Priority: **HIGH**

**Gap 4: Fragmented API Layer**
- Current: 84 market data routes, heavy duplication
- Impact: Hard to maintain, inconsistent behavior
- Priority: **MEDIUM**

**Gap 5: No Caching Strategy**
- Current: Every page load hits database
- Impact: Slow, expensive, doesn't scale
- Priority: **MEDIUM**

---

## 🎯 Phase 1: Migration Strategy (Week 2)

### Option A: "Big Bang" Rewrite
```
Pros:
✅ Clean slate
✅ Best-in-class from day 1
✅ No technical debt

Cons:
❌ High risk
❌ Long development time (8-12 weeks)
❌ No revenue during rewrite
❌ All or nothing

Verdict: ❌ Too risky for startup
```

### Option B: "Strangler Fig" Pattern (RECOMMENDED)
```
Pros:
✅ Low risk - gradual migration
✅ Keep current system running
✅ Can ship features during migration
✅ Learn and iterate

Cons:
⚠️ Temporary complexity (old + new coexist)
⚠️ Requires discipline (don't add to old system)

Verdict: ✅ Industry best practice
```

### Strangler Fig Migration Plan

**Week 1: New Foundation (Parallel to Old)**
```
1. Create new tables (products_v2, market_snapshots_v2)
2. Seed 100 products
3. Build new sync pipeline
4. Run in parallel to old system (don't migrate yet)
```

**Week 2-3: Prove It Works**
```
5. Monitor new pipeline (data quality, freshness)
6. Build new API routes (/api/v2/market/*)
7. A/B test: 10% traffic → new system
8. Validate performance
```

**Week 4-5: Cut Over**
```
9. Update inventory table → query new tables
10. Update market pages → query new tables
11. Migrate old data (if needed)
12. Sunset old tables (mark as deprecated)
```

**Week 6: Cleanup**
```
13. Remove old API routes
14. Drop old tables
15. Celebrate 🎉
```

---

## 🚨 Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Data loss during migration | Low | Critical | Backup before migration, run old+new in parallel |
| Inventory table breaks | Medium | Critical | Feature flag, rollback plan |
| Market pages go down | Low | High | Gradual rollout, monitoring |
| User data corruption | Low | Critical | Foreign key constraints, transactions |
| Sync jobs fail | Medium | Medium | Job queue with retry, alerting |
| Free tier exceeded | Low | Low | Monitor DB size daily |

---

## 📊 Success Metrics

**Technical Metrics:**
- [ ] Database size < 100 MB (free tier safe)
- [ ] All products sync successfully (>95% success rate)
- [ ] API p95 latency < 500ms
- [ ] Zero data loss
- [ ] Zero user-facing errors

**Business Metrics:**
- [ ] Inventory table works 100% of time
- [ ] Market pages load for all 100 products
- [ ] Users can add any product to inventory
- [ ] 7-day price charts working

**Timeline:**
- [ ] Week 1: Foundation complete
- [ ] Week 3: A/B test running
- [ ] Week 5: Full cutover
- [ ] Week 6: Old system deprecated

---

## 🛠️ Implementation Checklist

### Week 1: Audit & Planning ✅
- [x] Run automated codebase audit
- [ ] Manual database schema analysis (SQL queries)
- [ ] Map data flows for critical journeys
- [ ] Create risk assessment
- [ ] Get stakeholder buy-in

### Week 2: Foundation
- [ ] Create new database schema
- [ ] Seed 100 products
- [ ] Build sync orchestrator
- [ ] Deploy to staging

### Week 3-4: Validation
- [ ] A/B test with 10% traffic
- [ ] Monitor data quality
- [ ] Fix bugs
- [ ] Optimize performance

### Week 5: Migration
- [ ] Update inventory table queries
- [ ] Update market page queries
- [ ] Gradual rollout (10% → 50% → 100%)
- [ ] Monitor for errors

### Week 6: Cleanup
- [ ] Deprecate old tables
- [ ] Remove old API routes
- [ ] Documentation
- [ ] Postmortem

---

## 🎓 How Big Companies Do This

### Examples from Industry

**Stripe** (Payment Processing):
1. Built new system alongside old
2. Shadow mode (process in both, only use old)
3. Gradual cutover (1% → 10% → 50% → 100%)
4. Kept old system running for 6 months
5. Monitored extensively

**Shopify** (E-commerce Platform):
1. Feature flags for everything
2. Database migrations via dual-write
3. Rollback plan at every step
4. Dark launches (code ships, flag off)
5. Gradual rollout with monitoring

**Airbnb** (Booking Platform):
1. Service-by-service migration
2. API versioning (/v1, /v2)
3. Proxy pattern (new calls old)
4. Comprehensive testing
5. Automated rollback

### Key Principles

1. **Never big bang** - Gradual migration always
2. **Run old + new in parallel** - Prove new works
3. **Feature flags** - Turn things on/off without deploy
4. **Monitoring** - Know immediately if something breaks
5. **Rollback plan** - Always have escape hatch
6. **Documentation** - Future you will thank you

---

## 📚 Next Steps

1. **Review this document** with team
2. **Run SQL queries** to complete database audit
3. **Map data flows** for 3 critical journeys
4. **Make go/no-go decision** on migration
5. **Start Week 2** if approved

---

## 📞 Questions for Discussion

1. What's the business priority? Speed to market vs. technical excellence?
2. Can we afford 6 weeks of development time?
3. Do we pause feature development during migration?
4. Who will QA the new system?
5. What's our rollback criteria (what metrics = "abort")?

