#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function debugEnrichedItems() {
  console.log('=== Fetching inventory items ===')

  // Mimic the hook's fetch logic
  const { data: inventoryData, error: inventoryError } = await supabase
    .from('Inventory')
    .select('*')
    .in('status', ['active', 'listed', 'worn'])
    .order('created_at', { ascending: false })
    .limit(3)

  if (inventoryError) {
    console.error('Error:', inventoryError)
    return
  }

  console.log('\n=== Raw inventory data ===')
  inventoryData.forEach((item, idx) => {
    console.log(`\nItem ${idx + 1}:`)
    console.log('  ID:', item.id)
    console.log('  SKU:', item.sku)
    console.log('  Brand:', JSON.stringify(item.brand))
    console.log('  Model:', JSON.stringify(item.model))
    console.log('  Colorway:', JSON.stringify(item.colorway))
    console.log('  Size UK:', item.size_uk)
    console.log('  Size:', item.size)
    console.log('  Purchase Price:', item.purchase_price)
    console.log('  Category:', item.category)

    // Build full_title the same way the hook does
    const full_title = [item.brand, item.model, item.colorway]
      .filter(Boolean)
      .join(' • ')
    console.log('  Full Title:', JSON.stringify(full_title))
  })

  // Calculate invested
  console.log('\n=== Enriched fields ===')
  inventoryData.forEach((item, idx) => {
    const invested = item.purchase_total || (
      item.purchase_price +
      (item.tax || 0) +
      (item.shipping || 0)
    )

    console.log(`\nItem ${idx + 1}:`)
    console.log('  Invested:', invested)
    console.log('  Market Value:', item.market_value)
    console.log('  Profit:', item.market_value ? item.market_value - invested : null)
  })
}

debugEnrichedItems()
