# Scripts Cleanup Summary

**Date:** December 8, 2024
**Total Scripts:** 567
**Scripts to Delete:** ~396 (70%)
**Scripts to Keep:** ~110 (19%)

---

## Quick Stats

| Category | Count | Action |
|----------|-------|--------|
| **Test Scripts** | 121 | 🗑️ DELETE ALL |
| **Debug Scripts** | 32 | 🗑️ DELETE ALL |
| **Check Scripts** | 151 | 🗑️ DELETE 143, Keep 8 |
| **Verify Scripts** | 31 | 🗑️ DELETE 30, Keep 1 |
| **Show Scripts** | 19 | 🗑️ DELETE ALL |
| **Monitor Scripts** | 2 | 🗑️ DELETE ALL |
| **Find/Investigate** | 13 | 🗑️ DELETE ALL |
| **Audit Scripts** | 7 | 🗑️ DELETE ALL |
| **Phase/One-off** | 70 | 🗑️ DELETE ALL |
| **Production Scripts** | 82 | ✅ **KEEP ALL** |
| **Useful Utilities** | 28 | ✅ **KEEP ALL** |
| **debug-archive/** | 20 | 🗑️ DELETE |

---

## ✅ Scripts to KEEP (110 total)

### Production Scripts (82)

#### Referenced in package.json (15)
```
seed_market.ts
seed_market_bridge.mjs
seed_pokemon.ts
seed_sneaker_mock.ts
seed_portfolio_demo.ts
populate-fx-rates.mjs
refresh-all-portfolio-prices.mjs
refresh-mvs.mjs
map-shopify-to-alias.mjs
normalize-market-currency.mjs
sync-alias.mjs
sync-stockx.mjs
apply-fixed-migrations.sh
verify-stockx-connection.mjs ⭐
check-oauth-config.mjs
```

#### Migration Scripts (35)
```
apply-*.mjs/ts/sh scripts
- apply-alias-catalog-migration.mjs
- apply-catalog-id-migration.mjs
- apply-downsampling-migration.{mjs,ts}
- apply-ebay-migration.{mjs,manual.sh}
- apply-master-market-migrations.mjs
- apply-pricing-suggestions-migration.mjs
- apply-raw-snapshots-migration.mjs
... (and 27 more apply-*.mjs scripts)
```

#### Production Sync/Seed Scripts (32)
```
Sync scripts:
- sync-market-catalog.mjs
- sync-market-prices.mjs
- sync-market-sales.mjs
- run-stockx-sync.mjs
- sync-jordan4.{mjs,ts}

Backfill scripts:
- backfill-*.mjs/ts (7 scripts)

Seed scripts:
- seed-*.mjs (7 scripts)
- seed-products-from-skus.mjs
- seed-top-500-products.mjs

Refresh scripts:
- refresh-*.mjs (8 scripts)
```

### Useful Utilities (28)

#### Health Check Scripts (8)
```
check-alias-data.mjs - Quick Alias health check
check-current-state.mjs - System state overview
check-database-size.mjs - Monitor DB growth
check-sync-status.ts - Sync job status
check-sync-coverage.ts - Data coverage monitoring
check-sync-progress-live.ts - Live sync monitoring
sync-status.mjs - Sync dashboard
```

#### Master Market Data Scripts (6)
```
check-master-market-data.mjs
check-master-market-schema.mjs
check-master-schema.mjs
check-master-pipeline.mjs
master-market-health-check.ts
validate-master-market-data.ts
```

#### Data Quality Scripts (5)
```
check-latest-item.ts
check-all-providers.ts
check-which-products-mapped.ts
check-which-products-synced.ts
```

#### Migration Helpers (3)
```
apply-downsampling-via-function.ts
backfill-master-market-data.ts
populate-stockx-products-table.ts
```

#### Catalog Management (3)
```
check-product-id.mjs
check-products-table.mjs
```

#### Generic Sync Utilities (3)
```
fast-comprehensive-sync.ts
resilient-stockx-sync.ts
bulletproof-stockx-sync.ts
```

---

## 🗑️ Scripts to DELETE (396 total)

### Test Scripts (121) - DELETE ALL

**Why delete?** Features are complete and tested (see completion docs: STOCKX_INTEGRATION_COMPLETE.md, ALIAS_FIX_COMPLETE.md, EBAY_READY_TO_TEST.md)

```
StockX Testing (30 scripts):
- test-stockx-*.{mjs,ts}
- test-complete-stockx-integration.mjs
- test-correct-stockx-endpoints.ts
- test-full-stockx-sync.mjs

Alias Testing (30 scripts):
- test-alias-*.{mjs,ts}
- test-alias-fv5029-010.{mjs,ts} (specific SKU)
- test-alias-regions-*.mjs
- test-alias-week{2,3}.mjs

eBay Testing (14 scripts):
- test-ebay-*.{mjs,ts}
- test-finding-api.ts

Other Testing (47 scripts):
- test-add-item-complete.ts
- test-comprehensive-sync.ts
- test-downsampling.ts
- test-gender-*.ts
- test-inngest-*.ts
- test-market-*.mjs
- test-master-market-*.ts
- test-multi-region-sync.mjs
- test-sync-simple.mjs
... and more
```

### Check Scripts (143 of 151) - DELETE MOST

**Why delete?** SKU-specific debugging that's no longer needed

```
SKU-Specific Checks (20 scripts):
- check-aa2261-mapping.mjs
- check-dd1391.mjs
- check-dz5485-612.mjs
- check-fv5029.mjs
- check-chicago-*.mjs (3 scripts)
- check-dunk-*.mjs (3 scripts)
- check-mars-yard-*.mjs (2 scripts)
- check-nardwuar-items.ts

StockX Checks (19 scripts):
- check-stockx-*.{mjs,ts}

Alias Checks (7 scripts):
- check-alias-*.{mjs,ts}

Database Schema Checks (30 scripts):
- check-schema*.mjs
- check-table-*.mjs
- check-catalog-*.mjs
- check-market-*.mjs
- check-inventory-*.mjs

Duplicate/Mapping Checks (67 scripts):
- check-duplicate-*.mjs
- check-mapping-*.mjs
- check-specific-*.mjs
- check-unmapped.mjs
- check-seeded-data.mjs
... and many more
```

### Debug Scripts (32) - DELETE ALL

**Why delete?** Issues resolved

```
- debug-add-item-search.ts
- debug-alias-*.{mjs,ts}
- debug-ebay-*.ts
- debug-stockx-*.{mjs,ts}
- debug-inventory-*.mjs
- debug-mapping.mjs
- debug-product-*.{mjs,ts}
- debug-size-*.mjs
- debug-sync-discrepancy.ts
... all 32 scripts
```

### Verify Scripts (30 of 31) - DELETE MOST

**Why delete?** Verifications complete

**Keep only:** verify-stockx-connection.mjs (referenced in package.json)

```
DELETE:
- verify-alias-*.mjs
- verify-at-50.ts
- verify-catalog-item-fixed.ts
- verify-chicago-*.mjs
- verify-data-quality-deep.ts
- verify-dual-mapping-complete.ts
- verify-duplication-fix.ts
- verify-phase3b-data-quality.ts
- verify-stored-data.mjs
- verify-sync-data-quality.ts
... all except verify-stockx-connection.mjs
```

### Show Scripts (19) - DELETE ALL

**Why delete?** One-time data inspection

```
- show-actual-data.ts
- show-actual-database-state.ts
- show-alias-consigned.ts
- show-all-fields.ts
- show-dual-pricing-comparison.ts
- show-ebay-*.ts
- show-stockx-*.{mjs,ts}
- show-sku-*.{mjs,ts}
... all 19 scripts
```

### Phase/Comprehensive Scripts (10) - DELETE ALL

**Why delete?** One-time migrations (documented in PHASE_X_COMPLETE.md files)

```
- phase2-cleanup-stockx-data.ts
- phase3-resync-all-stockx.ts
- phase3b-resync-all-stockx-correct-table.ts
- phase3c-retry-failed-products.ts
- initial-comprehensive-sync.ts
- comprehensive-cleanup-and-sync.ts
- complete-dual-mapping.ts
- final-alias-audit.ts
- final-ebay-audit.ts
```

### Find/Investigate Scripts (13) - DELETE ALL

**Why delete?** Issues investigated and resolved

```
- find-alias-catalog-id.{mjs,ts}
- find-dd1391-data.mjs
- find-listing-mismatch.mjs
- find-mapped-items*.mjs
- find-missing-snapshots.mjs
- find-sku.mjs
- find-variant-id.mjs
- investigate-product-mapping.ts
- investigate-size-mappings.mjs
```

### Audit Scripts (7) - DELETE ALL

**Why delete?** Audits complete

```
- audit-alias-complete-data.ts
- audit-codebase-comprehensive.mjs
- audit-existing-schema.mjs
- audit-phase1-*.ts
- audit-stockx-market-*.{mjs,ts}
```

### Monitor Scripts (2) - DELETE ALL

**Why delete?** Ad-hoc monitoring scripts

```
- monitor-comprehensive-sync.ts
- monitor-simple-sync.sh
```

### Miscellaneous One-Off Scripts (~60) - DELETE ALL

```
- accurate-status.mjs
- add-if4491-to-catalog.mjs
- add-inventory-fk.mjs
- add-real-images.mjs
- analyze-null-prices.ts
- cleanup-stockx-test-data.mjs
- compare-*.ts
- fetch-dd1391-from-apis.ts
- fix-stockx-mapping.ts
- get-stockx-data-by-sku.mjs
- list-available-skus.mjs
- map-products-*.{mjs,ts}
- simple-uk-only-sync.ts
- conservative-stockx-sync.ts
- parallel-stockx-sync.ts
... and more
```

### debug-archive/ Directory (20 files) - DELETE

Already archived, safe to delete

---

## 📊 Impact Analysis

### Before Cleanup
- **567 scripts** making it hard to find production scripts
- **396 test/debug scripts** cluttering the directory
- Difficult to onboard new developers
- Hard to maintain and understand what's actually used

### After Cleanup
- **~110 essential scripts** (81% reduction)
- Clear separation: production vs utilities
- Easy to find what you need
- Better maintainability
- Cleaner git history going forward

---

## 🚀 How to Run Cleanup

### Option 1: Run the script (recommended)
```bash
./cleanup-scripts.sh
```

This will:
- ✅ Create timestamped backup (.tar.gz)
- ✅ Delete 396 test/debug scripts
- ✅ Keep all 110 production/utility scripts
- ✅ Print detailed summary

### Option 2: Manual cleanup
Review the DELETE lists above and remove files manually.

---

## 🔄 Rollback

If you need to restore:

```bash
# List backups
ls -1 scripts-backup-*.tar.gz

# Restore (use actual filename)
tar -xzf scripts-backup-YYYYMMDD_HHMMSS.tar.gz
```

---

## 💡 Best Practices Going Forward

1. **Delete test scripts after feature is complete** - Don't accumulate test-*.mjs files
2. **Use temporary names** - Name one-off scripts with `temp-` prefix
3. **Document in code** - Add comments explaining why a script exists
4. **Consolidate utilities** - Combine similar check scripts into one with flags
5. **Keep package.json updated** - Add production scripts to npm scripts

---

## ✅ Next Steps

1. Review this summary
2. Run `./cleanup-scripts.sh` when ready
3. Verify backup created successfully
4. Check that production scripts still work
5. Commit the cleanup to git

---

**Ready to clean?** Run:
```bash
./cleanup-scripts.sh
```

**Generated:** 2024-12-08
**Cleanup Script:** [cleanup-scripts.sh](./cleanup-scripts.sh)
