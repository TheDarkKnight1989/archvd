#!/bin/bash
# Scripts Cleanup Script
# Generated: 2024-12-08
# Purpose: Remove 396 test/debug/check scripts while keeping production scripts

set -e

SCRIPTS_DIR="scripts"
BACKUP_FILE="scripts-backup-$(date +%Y%m%d_%H%M%S).tar.gz"

echo "🔍 Scripts Cleanup"
echo "======================================"
echo ""
echo "📊 Current state:"
echo "  Total scripts: $(ls -1 $SCRIPTS_DIR/*.{mjs,ts,sh} 2>/dev/null | wc -l)"
echo ""

# Create backup
echo "📦 Creating backup: $BACKUP_FILE"
tar -czf "$BACKUP_FILE" "$SCRIPTS_DIR"
echo "✅ Backup created"
echo ""

cd "$SCRIPTS_DIR"

# Count files before deletion
BEFORE_COUNT=$(ls -1 *.{mjs,ts,sh} 2>/dev/null | wc -l | tr -d ' ')

echo "🗑️  Removing test/debug/check scripts..."
echo ""

# Delete test scripts
echo "Removing test-* scripts..."
rm -f test-*.{mjs,ts} 2>/dev/null || true
TEST_DELETED=$(echo $?)

# Delete check scripts (specific SKUs and features)
echo "Removing SKU-specific check scripts..."
rm -f check-{stockx,alias,ebay,chicago,dunk,mars,nardwuar,aa2261,dd1391,dz5485,fv5029}-*.{mjs,ts} 2>/dev/null || true
rm -f check-{specific,duplicate,table,schema,market,inventory,catalog,mapping,unmapped,seeded}-*.{mjs,ts} 2>/dev/null || true
rm -f check-{aged,availabilities,batch,both,currency,dashboard,db,dunk,enriched}-*.{mjs,ts} 2>/dev/null || true
rm -f check-{image,latest,link,listing,low,null,oauth,platform,price,product,purchase}-*.{mjs,ts} 2>/dev/null || true
rm -f check-{raw,recent,region,rls,sale,sales,size,snapshot,sku,sold,status,sync,trade,user,variant,which}-*.{mjs,ts} 2>/dev/null || true
rm -f check-30day-data.mjs check-and-populate-catalog.mjs 2>/dev/null || true

# Delete debug scripts
echo "Removing debug-* scripts..."
rm -f debug-*.{mjs,ts} 2>/dev/null || true

# Delete verify scripts (keep verify-stockx-connection.mjs)
echo "Removing verify-* scripts..."
TEMP_VERIFY=$(mktemp)
if [ -f "verify-stockx-connection.mjs" ]; then
  cp verify-stockx-connection.mjs "$TEMP_VERIFY"
fi
rm -f verify-*.{mjs,ts} 2>/dev/null || true
if [ -f "$TEMP_VERIFY" ]; then
  mv "$TEMP_VERIFY" verify-stockx-connection.mjs
fi

# Delete show scripts
echo "Removing show-* scripts..."
rm -f show-*.{mjs,ts} 2>/dev/null || true

# Delete phase/comprehensive/final scripts
echo "Removing phase/comprehensive scripts..."
rm -f phase*.ts 2>/dev/null || true
rm -f *comprehensive*.ts 2>/dev/null || true
rm -f complete-dual-mapping.ts 2>/dev/null || true
rm -f initial-comprehensive-sync.ts 2>/dev/null || true

# Delete find/investigate/audit/monitor scripts
echo "Removing find/investigate/audit/monitor scripts..."
rm -f find-*.{mjs,ts} 2>/dev/null || true
rm -f investigate-*.{mjs,ts} 2>/dev/null || true
rm -f audit-*.{mjs,ts} 2>/dev/null || true
rm -f monitor-*.{ts,sh} 2>/dev/null || true

# Delete final/audit scripts
echo "Removing final-* and audit-* scripts..."
rm -f final-*.ts 2>/dev/null || true

# Delete debug-archive directory
if [ -d "debug-archive" ]; then
  echo "Removing debug-archive/ directory..."
  rm -rf debug-archive/
fi

# Delete specific one-off scripts
echo "Removing one-off utility scripts..."
rm -f accurate-status.mjs add-if4491-to-catalog.mjs 2>/dev/null || true
rm -f add-inventory-fk.mjs add-real-images.mjs add-seed-prices.mjs 2>/dev/null || true
rm -f analyze-null-prices.ts auto-map-stockx.mjs 2>/dev/null || true
rm -f cleanup-stockx-test-data.mjs compare-*.ts 2>/dev/null || true
rm -f fetch-dd1391-from-apis.ts fix-stockx-mapping.ts 2>/dev/null || true
rm -f full-status.mjs full-stockx-*.{mjs,ts} 2>/dev/null || true
rm -f get-stockx-data-by-sku.mjs list-available-skus.mjs 2>/dev/null || true
rm -f map-products-to-catalogs.mjs map-products-via-api.ts 2>/dev/null || true
rm -f demo-size-categories.ts 2>/dev/null || true

# Delete sync test/experimental scripts (keep production sync scripts)
echo "Removing experimental sync scripts..."
rm -f simple-uk-only-sync.ts 2>/dev/null || true
rm -f conservative-stockx-sync.ts parallel-stockx-sync.ts 2>/dev/null || true

# Count files after deletion
AFTER_COUNT=$(ls -1 *.{mjs,ts,sh} 2>/dev/null | wc -l | tr -d ' ')
DELETED=$((BEFORE_COUNT - AFTER_COUNT))

echo ""
echo "======================================"
echo "✨ Cleanup Complete!"
echo "======================================"
echo ""
echo "📊 Summary:"
echo "  Before: $BEFORE_COUNT scripts"
echo "  After:  $AFTER_COUNT scripts"
echo "  Deleted: $DELETED scripts"
echo ""
echo "💾 Backup: $BACKUP_FILE"
echo ""
echo "✅ Kept production scripts:"
echo "  - Migration scripts (apply-*.mjs/ts)"
echo "  - Seed scripts (seed-*.mjs/ts)"
echo "  - Sync scripts (sync-*.mjs)"
echo "  - Backfill scripts (backfill-*.mjs)"
echo "  - Useful utilities (health checks, monitoring)"
echo ""
echo "🗑️  Deleted:"
echo "  - All test-* scripts"
echo "  - All debug-* scripts"
echo "  - Most verify-* scripts (kept verify-stockx-connection.mjs)"
echo "  - Most check-* scripts (kept generic health checks)"
echo "  - All show-* scripts"
echo "  - All phase/comprehensive/final scripts"
echo "  - All find/investigate/audit/monitor scripts"
echo "  - debug-archive/ directory"
echo ""
