# Migration Audit Report
**Date:** December 8, 2024
**Total Migrations:** 107 files
**Recommended for Deletion:** 19 confirmed + 39 to review

---

## Executive Summary

Your migrations folder has accumulated significant duplication from iterative development. This audit identifies:

- ✅ **50 production migrations to keep**
- 🗑️ **19 duplicates/test files to delete immediately**
- ⚠️ **39 future-dated files requiring review** (dated Jan 2025 but it's Dec 2024)

**Impact:** Removing duplicates will reduce migration count by ~53% and improve maintainability.

---

## ✅ Production Migrations to Keep (50 files)

### Foundation Schema
- `20241206_create_production_schema.sql` - Core products/variants/market_snapshots tables
- `COMBINED_20251128_fix_all_schema.sql` - Critical schema fixes for product_catalog

### Sales & Accounting (9 files)
- `20251108_split_sales_remove_instock.sql`
- `20251109_add_usd_to_fx_rates.sql`
- `20251109_fix_fx_rates_generated_column.sql`
- `20251110_add_profiles_currency.sql`
- `20251111_fx_snapshots_accounting_per_user_base.sql`
- `20251112_pnl_vat_views_base_currency.sql`
- `20251113_populate_fx_rates.sql`
- `20251114_M1_enums_and_base_currency.sql`
- `20251115_M2_clean.sql` ⭐ **Keep this (clean version)**
- `20251116_M3_fx_rates_hardening.sql`
- `20251117_views_and_observability_FIXED.sql` ⭐ **Keep this (fixed version)**

### Releases (3 files)
- `20251108_create_releases_table_v2.sql` ⭐ **Keep this (v2)**
- `20251108_allow_authenticated_write_releases.sql`
- `20251108_fix_releases_rls_policies.sql`

### Market Data & Providers (15 files)
- `20251110_market_foundations_no_live.sql`
- `20251111_market_unified.sql`
- `20251111_add_seed_provider.sql`
- `20251111_seed_provider_clean.sql`
- `20251111_fix_mv_refresh.sql`
- `20251116_stockx_foundations_idempotent.sql` ⭐ **Keep this (idempotent version)**
- `20251118_integrate_stockx_prices.sql`
- `20251118_stockx_accounts_oauth.sql`
- `20251110_stockx_refresh_token_nullable.sql`
- `20251118_fix_stockx_latest_prices_view.sql`
- `20251118_market_queue.sql`
- `20251119_market_products_cache.sql`
- `20251119_provider_metrics.sql`
- `20251118_disable_size_release_source.sql`

### Alias Integration (7 files)
- `20251114_alias_v1_core.sql`
- `20251114_alias_v2_snapshots_links.sql`
- `20251115_shopify_alias_mapping.sql`
- `20251115_shopify_alias_complete.sql`
- `20251125_create_inventory_alias_links_v2.sql` ⭐ **Keep this (v2)**
- `20251125_alias_remaining_tables.sql`
- `20251125_alias_catalog_items.sql`

### Transactions & Portfolio (9 files)
- `20251119_transactions_clean.sql` ⭐ **Keep this (clean version)**
- `20251116_create_portfolio_snapshots.sql`
- `20251111_sneaker_mock_and_portfolio_value_daily.sql`
- `20251113_watchlist_alerts_FIXED.sql` ⭐ **Keep this (fixed version)**
- `20251109_create_watchlists_schema.sql`
- `20251109_fix_market_rls_public_read.sql`
- `20251109_audit_events.sql`
- `20251109_subscriptions.sql`
- `20251109_mark_as_sold.sql`

### StockX Features (7 files)
- `20251120_stockx_integration.sql`
- `20251118_create_listing_history.sql`
- `20251118_update_stockx_accounts_status.sql`
- `20251118_fix_market_links_insert_policy.sql`
- `20251119_fix_stockx_size_matching_comprehensive.sql`
- `20251119_fix_inventory_market_links_rls.sql`
- `20251120_create_refresh_function.sql`
- `20251120_add_mapping_status_to_inventory_market_links.sql`
- `20251120_remove_last_sale_price.sql`

### User Settings & Lists (5 files)
- `20251123_create_sell_lists.sql`
- `20251123_create_user_settings.sql`
- `20251123_fix_inventory_market_links_update_policy.sql`
- `20251124_initial_refresh_portfolio_mv.sql`
- `20250129_oauth_sessions.sql`

### Catalog & Inventory (5 files)
- `20251128_create_purchase_places.sql`
- `20251128_add_missing_catalog_columns.sql`
- `20251128_fix_product_catalog_id.sql`
- `20251128_add_alias_fee_settings.sql`
- `20251128_add_new_sale_platforms.sql`
- `20251128_fix_inventory_platform_constraint.sql`

### Recent Market Links (3 files)
- `20251130_add_stockx_listing_sync_columns.sql`
- `20251130_add_user_id_to_inventory_market_links.sql`
- `20251130_add_inventory_fk_to_market_links.sql`

### Master Market Data (11 files) - December 2024
- `20251203_create_master_market_data.sql`
- `20251203_create_raw_snapshot_tables.sql`
- `20251203_add_flex_consigned_support.sql`
- `20251204_create_alias_offer_histograms.sql`
- `20251204_create_ebay_time_series_tables.sql`
- `202512053_add_stockx_pricing_suggestions.sql` ⚠️ **Typo in filename**
- `20251205_add_size_conversions.sql`
- `20251205_add_data_freshness.sql`
- `20251205_add_alias_sales_detail.sql`
- `20251205_add_alias_catalog_id.sql`
- `20251205_add_price_bounds.sql`
- `20251206_add_catalog_id_to_inventory.sql`
- `20251206_allow_null_stockx_variant.sql`
- `20251207_add_data_retention_policy.sql`
- `20251207_create_daily_market_summary.sql`

---

## 🗑️ Files to Delete (19 confirmed)

### Sales Table Duplicates (6 files)
❌ Delete these - superseded by `20251115_M2_clean.sql`:
- `20251115_M2_sales_split_and_fx_snapshots.sql`
- `20251115_M2_sales_split_FIXED.sql`
- `20251115_M2_sales_split_FIXED_v2.sql`
- `20251115_M2_sales_split_FINAL.sql`
- `20251115_M2_sales_split_WORKING.sql`
- `20251115_M2_standalone.sql`

**Reason:** The `M2_clean.sql` version is cleaner, uses DROP CASCADE for idempotency, and has simpler structure.

### Releases Table Duplicates (1 file)
❌ Delete:
- `20251108_create_releases_table.old.sql`

**Keep:** `20251108_create_releases_table_v2.sql`

### Views & Observability Duplicates (1 file)
❌ Delete:
- `20251117_views_and_observability.sql`

**Keep:** `20251117_views_and_observability_FIXED.sql`

### Watchlist Duplicates (1 file)
❌ Delete:
- `20251113_watchlist_alerts_and_activity.sql`

**Keep:** `20251113_watchlist_alerts_FIXED.sql`
**Reason:** Original references non-existent `currency` column

### Transactions Duplicates (2 files)
❌ Delete:
- `20251119_transactions.sql`
- `20251119_transactions_fixed.sql`

**Keep:** `20251119_transactions_clean.sql`

### Alias Links Duplicates (1 file)
❌ Delete:
- `20251125_create_inventory_alias_links.sql`

**Keep:** `20251125_create_inventory_alias_links_v2.sql`

### StockX Foundations Duplicates (1 file)
❌ Delete:
- `20251116_stockx_foundations.sql`

**Keep:** `20251116_stockx_foundations_idempotent.sql`
**Reason:** Idempotent version has proper `DROP POLICY IF EXISTS`

### Test/Debug Files (3 files)
❌ Delete - these are test queries, not migrations:
- `20250109_test_view.sql` - Just a SELECT query to verify a view
- `20250109_verify_data.sql` - Diagnostic queries only
- `20250109_complete_fix.sql` - Appears incomplete

---

## ⚠️ Files Requiring Review (39 files)

### Issue: Future-Dated Migrations
All files dated `202501xx` (January 2025) were created on December 8, 2024. This suggests:
1. Date typo (should be `202412xx`)
2. Intentionally scheduled for future deployment

**Files affected:**
```
20250107_pnl_vat_views.sql
20250108_fix_release_sources_columns.sql
20250108_rename_coplist_to_watchlist.sql
20250109_fix_pnl_view_columns.sql
20250109_tcg_price_daily_medians.sql
20250109_trading_cards_foundation.sql
... (and 33 more)
```

**Recommendation:**
- If these are misdated, rename them to December 2024
- If intentionally future-dated, document why in a README

---

## 🔧 Issues to Fix

### 1. Filename Typo
`202512053_add_stockx_pricing_suggestions.sql` - Extra "3" in date
**Should be:** `20251205_add_stockx_pricing_suggestions.sql`

### 2. Migration Order Verification
After cleanup, verify migration order with:
```bash
ls -1 supabase/migrations/*.sql | sort
```

---

## 📋 Cleanup Instructions

### Step 1: Run Cleanup Script
```bash
chmod +x cleanup-migrations.sh
./cleanup-migrations.sh
```

This will:
- Create timestamped backup in `supabase/migrations_backup_YYYYMMDD_HHMMSS/`
- Remove 19 confirmed duplicate/test files
- Print summary

### Step 2: Review Future-Dated Files
Manually review all `202501xx` files and decide:
- Rename to correct December 2024 dates, OR
- Keep as-is if intentionally scheduled

### Step 3: Fix Filename Typo
```bash
cd supabase/migrations
mv 202512053_add_stockx_pricing_suggestions.sql 20251205_add_stockx_pricing_suggestions.sql
```

### Step 4: Verify Cleanup
```bash
# Count remaining files
ls -1 supabase/migrations/*.sql | wc -l

# Verify no duplicates remain
ls -1 supabase/migrations/*.sql | grep -E "(FIXED|FINAL|_v2|_v3|clean|old)"
```

---

## 📊 Impact Summary

### Before Cleanup
- Total migrations: 107 files
- Duplicate iterations: 16 files
- Test files: 3 files
- Questionable dates: 39 files

### After Cleanup (Confirmed)
- Total migrations: 88 files (19 removed)
- Clean production migrations: 50 files
- Review needed: 39 files (future-dated)

### Final State (After Review)
- Estimated final count: 50-88 files
- Reduction: 18-53%
- Improved clarity and maintainability

---

## 🎯 Next Steps

1. **Run cleanup script** - Remove 19 confirmed duplicates
2. **Review future-dated files** - Determine correct dates
3. **Fix filename typo** - Rename pricing suggestions file
4. **Test on fresh DB** - Verify migrations run correctly
5. **Update documentation** - Document migration strategy
6. **Set up governance** - Prevent future duplication

---

## 📝 Notes

### Best Practices Going Forward
1. **Use idempotent migrations** - Always use `DROP ... IF EXISTS` and `CREATE ... IF NOT EXISTS`
2. **Delete failed attempts** - Don't leave `_v2`, `_FIXED`, etc. in production
3. **Use proper dates** - Ensure migration timestamps are accurate
4. **Test before committing** - Run migrations on test DB first
5. **One migration per feature** - Avoid combining unrelated changes

### Migration Naming Convention
```
YYYYMMDD_descriptive_name.sql
```
- `YYYYMMDD` - Date in format 20241208
- `descriptive_name` - Clear, concise description
- No version suffixes in production (no `_v2`, `_FINAL`, etc.)

---

**Generated:** December 8, 2024
**Script:** [cleanup-migrations.sh](./cleanup-migrations.sh)
