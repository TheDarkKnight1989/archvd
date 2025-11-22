#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const USER_ID = 'fbcde760-820b-4eaf-949f-534a8130d44b'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Check what status values exist in inventory
const { data, error } = await supabase
  .from('Inventory')
  .select('id, sku, status, brand, model')
  .eq('user_id', USER_ID)
  .order('created_at', { ascending: false })

if (error) {
  console.error('Error:', error)
  process.exit(1)
}

console.log('\n📊 Inventory Status Breakdown:\n')

// Group by status
const statusCounts = {}
data.forEach(item => {
  const status = item.status || 'null'
  if (!statusCounts[status]) {
    statusCounts[status] = []
  }
  statusCounts[status].push(item)
})

// Show counts
Object.entries(statusCounts).forEach(([status, items]) => {
  console.log(`${status}: ${items.length} items`)
})

console.log(`\nTotal: ${data.length} items`)

// Show active/listed/worn breakdown
console.log('\n📦 Active Portfolio (active, listed, worn):')
const activeItems = data.filter(item => ['active', 'listed', 'worn'].includes(item.status))
console.log(`  Count: ${activeItems.length}`)
activeItems.forEach(item => {
  console.log(`  - ${item.sku} (${item.brand} ${item.model}) [${item.status}]`)
})

// Show non-active items
console.log('\n🗄️ Non-Active Items (sold, archived, etc):')
const nonActiveItems = data.filter(item => !['active', 'listed', 'worn'].includes(item.status))
console.log(`  Count: ${nonActiveItems.length}`)
nonActiveItems.forEach(item => {
  console.log(`  - ${item.sku} (${item.brand} ${item.model}) [${item.status}]`)
})
