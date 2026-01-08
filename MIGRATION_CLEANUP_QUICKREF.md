# Migration Cleanup - Quick Reference

## TL;DR
- **107 total migrations** → **88 after cleanup** (19 files removed)
- Run `./cleanup-migrations.sh` to delete duplicates safely
- Backup created automatically before deletion
- Review 39 future-dated files afterward

---

## Files Being Deleted (19 total)

### Keep These ✅
- `20251115_M2_clean.sql` (sales table)
- `20251108_create_releases_table_v2.sql` (releases)
- `20251117_views_and_observability_FIXED.sql` (views)
- `20251113_watchlist_alerts_FIXED.sql` (watchlist)
- `20251119_transactions_clean.sql` (transactions)
- `20251125_create_inventory_alias_links_v2.sql` (alias links)
- `20251116_stockx_foundations_idempotent.sql` (stockx)

### Delete These ❌
| Category | Count | Files |
|----------|-------|-------|
| M2 Sales Duplicates | 6 | `M2_sales_split_*` (FIXED, v2, FINAL, WORKING, standalone, fx_snapshots) |
| Other Duplicates | 10 | releases.old, views, watchlist, transactions, alias_links, stockx_foundations |
| Test Files | 3 | test_view, verify_data, complete_fix |

---

## Quick Commands

### Run Cleanup
```bash
# Make executable and run
chmod +x cleanup-migrations.sh
./cleanup-migrations.sh
```

### Check Results
```bash
# Count files before/after
ls -1 supabase/migrations/*.sql | wc -l

# Find remaining duplicates (should be empty)
ls -1 supabase/migrations/*.sql | grep -E "(FIXED|FINAL|_v2|old|test_|verify_)"

# Check future-dated files
ls -1 supabase/migrations/202501*.sql
```

### Fix Filename Typo
```bash
cd supabase/migrations
mv 202512053_add_stockx_pricing_suggestions.sql \
   20251205_add_stockx_pricing_suggestions.sql
```

### Restore from Backup (if needed)
```bash
# List backups
ls -d supabase/migrations_backup_*

# Restore (use actual backup directory name)
cp supabase/migrations_backup_YYYYMMDD_HHMMSS/* supabase/migrations/
```

---

## Critical Migrations (Don't Delete!)

### Foundation
- `20241206_create_production_schema.sql`
- `COMBINED_20251128_fix_all_schema.sql`

### Master Market Data (Latest Features)
- `20251203_create_master_market_data.sql`
- `20251203_create_raw_snapshot_tables.sql`
- `20251204_create_ebay_time_series_tables.sql`
- `20251205_add_size_conversions.sql`
- `20251207_add_data_retention_policy.sql`

---

## Danger Zone ⚠️

**DO NOT delete these patterns:**
- Anything with `master_market_data`
- Anything with `COMBINED`
- Anything dated December 2024 (2024120x, 2025120x)
- The "clean", "FIXED", or "idempotent" versions

**SAFE to delete:**
- Files with .old extension
- Multiple versions (_v1 when _v2 exists)
- Iterations (FIXED, FINAL, WORKING when "clean" exists)
- Test/verify/debug scripts

---

## What the Cleanup Script Does

1. ✅ Creates timestamped backup
2. ✅ Removes 16 duplicate iterations
3. ✅ Removes 3 test/verify files
4. ✅ Prints summary of actions
5. ❌ Does NOT modify any "keep" files
6. ❌ Does NOT touch future-dated files (manual review needed)

---

## Post-Cleanup Checklist

- [ ] Run cleanup script
- [ ] Verify 19 files removed
- [ ] Review future-dated files (202501xx)
- [ ] Fix pricing suggestions filename typo
- [ ] Test migrations on local Supabase
- [ ] Document migration strategy
- [ ] Commit cleanup to git
- [ ] Apply to Supabase production (if needed)

---

## Rollback Plan

If something goes wrong:
```bash
# Find backup
BACKUP=$(ls -td supabase/migrations_backup_* | head -1)

# Restore all files
rm -f supabase/migrations/*.sql
cp $BACKUP/* supabase/migrations/

echo "Restored from $BACKUP"
```

---

**Last Updated:** 2024-12-08
**Full Report:** [MIGRATION_AUDIT_REPORT.md](./MIGRATION_AUDIT_REPORT.md)
