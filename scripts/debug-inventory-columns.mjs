#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function checkColumns() {
  // Get first item and see all its fields
  const { data, error } = await supabase
    .from('Inventory')
    .select('*')
    .in('status', ['active', 'listed'])
    .limit(1)

  if (error) {
    console.error('Error:', error)
    return
  }

  if (data && data.length > 0) {
    console.log('=== Columns in Inventory table ===')
    console.log(Object.keys(data[0]).sort().join(', '))
    console.log('\n=== First item data ===')

    const item = data[0]
    console.log('ID:', item.id)
    console.log('SKU:', item.sku)
    console.log('Brand:', item.brand)
    console.log('Model:', item.model)
    console.log('Colorway:', item.colorway)
    console.log('Size UK:', item.size_uk)
    console.log('Purchase Price:', item.purchase_price)
    console.log('Purchase Currency:', item.purchase_currency)
    console.log('Status:', item.status)
    console.log('\nfull_title would be:', [item.brand, item.model, item.colorway].filter(Boolean).join(' • '))
  } else {
    console.log('No items found')
  }
}

checkColumns()
