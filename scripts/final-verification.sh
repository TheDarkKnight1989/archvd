#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🎯 FINAL COMPREHENSIVE VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "1️⃣  Database State Check..."
node scripts/verify-db-state.mjs 2>&1 | tail -8
echo ""

echo "2️⃣  Dashboard Data Verification..."
node scripts/verify-dashboard-data.mjs 2>&1 | grep -E "(Estimated|Provider|Missing|SUCCESS)"
echo ""

echo "3️⃣  Debug API Test..."
curl -s http://localhost:3000/api/debug/ui-state | jq '{
  inventory: .inventory.active,
  prices: .prices.total,
  provider: .dashboard.provider,
  value: .dashboard.estimatedValue,
  roi: .dashboard.roi
}'
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ VERIFICATION COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎉 If all values above are non-zero, the system is WORKING!"
echo ""
echo "📊 Expected Results:"
echo "   - Inventory: 12"
echo "   - Prices: 90"
echo "   - Provider: stockx"
echo "   - Value: 1328"
echo "   - ROI: -23.34"
echo ""
echo "🚀 Next: Visit http://localhost:3000/portfolio"
