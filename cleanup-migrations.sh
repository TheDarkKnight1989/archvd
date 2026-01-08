#!/bin/bash
# Migration Cleanup Script
# Generated: 2024-12-08
# Purpose: Remove duplicate, superseded, and test migration files

set -e

MIGRATIONS_DIR="supabase/migrations"
BACKUP_DIR="supabase/migrations_backup_$(date +%Y%m%d_%H%M%S)"

echo "🔍 Migration Cleanup Script"
echo "======================================"
echo ""

# Create backup
echo "📦 Creating backup at: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
cp -r "$MIGRATIONS_DIR"/* "$BACKUP_DIR/"
echo "✅ Backup created"
echo ""

# Navigate to migrations directory
cd "$MIGRATIONS_DIR"

echo "🗑️  Removing duplicate and test files..."
echo ""

# Sales Table Duplicates (keep M2_clean.sql)
echo "Removing M2 sales split duplicates..."
rm -f 20251115_M2_sales_split_and_fx_snapshots.sql
rm -f 20251115_M2_sales_split_FIXED.sql
rm -f 20251115_M2_sales_split_FIXED_v2.sql
rm -f 20251115_M2_sales_split_FINAL.sql
rm -f 20251115_M2_sales_split_WORKING.sql
rm -f 20251115_M2_standalone.sql
echo "  ✅ Removed 6 M2 duplicates"

# Releases Duplicates (keep _v2.sql)
echo "Removing releases table duplicates..."
rm -f 20251108_create_releases_table.old.sql
echo "  ✅ Removed 1 releases duplicate"

# Views Duplicates (keep _FIXED.sql)
echo "Removing views and observability duplicates..."
rm -f 20251117_views_and_observability.sql
echo "  ✅ Removed 1 views duplicate"

# Watchlist Duplicates (keep _FIXED.sql)
echo "Removing watchlist duplicates..."
rm -f 20251113_watchlist_alerts_and_activity.sql
echo "  ✅ Removed 1 watchlist duplicate"

# Transactions Duplicates (keep _clean.sql)
echo "Removing transactions duplicates..."
rm -f 20251119_transactions.sql
rm -f 20251119_transactions_fixed.sql
echo "  ✅ Removed 2 transactions duplicates"

# Alias Links Duplicates (keep _v2.sql)
echo "Removing alias links duplicates..."
rm -f 20251125_create_inventory_alias_links.sql
echo "  ✅ Removed 1 alias links duplicate"

# StockX Foundations Duplicates (keep _idempotent.sql)
echo "Removing StockX foundations duplicates..."
rm -f 20251116_stockx_foundations.sql
echo "  ✅ Removed 1 StockX duplicate"

# Test/Debug/Verify Files
echo "Removing test and verification files..."
rm -f 20250109_test_view.sql
rm -f 20250109_verify_data.sql
rm -f 20250109_complete_fix.sql
echo "  ✅ Removed 3 test files"

echo ""
echo "======================================"
echo "✨ Cleanup Complete!"
echo "======================================"
echo ""
echo "📊 Summary:"
echo "  - Removed 16 duplicate migrations"
echo "  - Removed 3 test files"
echo "  - Total removed: 19 files"
echo ""
echo "💾 Backup location: $BACKUP_DIR"
echo ""
echo "⚠️  NEXT STEPS:"
echo "  1. Review future-dated migrations (202501xx) - check if dates are correct"
echo "  2. Fix typo: 202512053_add_stockx_pricing_suggestions.sql"
echo "  3. Test migrations on a fresh database"
echo "  4. Update your migration tracking system"
echo ""
