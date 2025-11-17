#!/bin/bash
# Fix all database schema mismatches in useInventoryV3.ts

FILE="src/hooks/useInventoryV3.ts"

echo "Fixing schema mismatches in $FILE..."

# 1. Fix sparkline column names
sed -i '' "s/.select('sku, size, price_date, median_price')/.select('sku, size_uk, day, median')/" "$FILE"
sed -i '' "s/.gte('price_date'/.gte('day'/" "$FILE"
sed -i '' "s/.order('price_date'/.order('day'/" "$FILE"

# 2. Fix sparkline map building
sed -i '' "s/point.size_uk || ''/point.size_uk || ''/" "$FILE"  # Already correct from earlier
sed -i '' "s/date: point.price_date/date: point.day/" "$FILE"
sed -i '' "s/price: point.median_price/price: point.median/" "$FILE"

# 3. Fix __none__ UUID issue - wrap in conditional
sed -i '' 's/\.in('\''id'\'', listingIds\.length > 0 \? listingIds : \['\''__none__'\''\])/listingIds.length > 0 ? .in('\''id'\'', listingIds) : { data: [], error: null }/' "$FILE"

echo "✅ Schema mismatches fixed!"
