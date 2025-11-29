#!/usr/bin/env node

/**
 * Check how many inventory items have Alias mappings
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkCoverage() {
  console.log('\n=== INVENTORY vs ALIAS MAPPING COVERAGE ===\n')

  // Count total inventory items
  const { count: totalItems, error: countError } = await supabase
    .from('Inventory')
    .select('*', { count: 'exact', head: true })
    .in('status', ['active', 'listed', 'worn'])

  if (countError) {
    console.error('Error counting inventory:', countError)
    return
  }

  console.log(`Total inventory items: ${totalItems}`)

  // Count items with Alias mappings
  const { count: mappedItems, error: mappedError } = await supabase
    .from('inventory_alias_links')
    .select('*', { count: 'exact', head: true })

  if (mappedError) {
    console.error('Error counting mappings:', mappedError)
    return
  }

  console.log(`Items with Alias mappings: ${mappedItems}`)
  console.log(`Coverage: ${((mappedItems / totalItems) * 100).toFixed(1)}%`)
  console.log()

  // Get items WITHOUT Alias mappings
  const { data: allItems, error: allError } = await supabase
    .from('Inventory')
    .select('id, sku, brand, model, size_uk')
    .in('status', ['active', 'listed', 'worn'])

  if (allError || !allItems) {
    console.error('Error fetching inventory:', allError)
    return
  }

  const { data: mappings, error: mappingsError } = await supabase
    .from('inventory_alias_links')
    .select('inventory_id')

  const mappedIds = new Set(mappings?.map(m => m.inventory_id) || [])

  const unmappedItems = allItems.filter(item => !mappedIds.has(item.id))

  console.log(`\n=== UNMAPPED ITEMS (${unmappedItems.length}) ===\n`)

  for (const item of unmappedItems.slice(0, 10)) {
    console.log(`  ${item.brand} ${item.model} (${item.sku}) - Size UK ${item.size_uk}`)
  }

  if (unmappedItems.length > 10) {
    console.log(`  ... and ${unmappedItems.length - 10} more`)
  }

  console.log('\n=== RECOMMENDATION ===')
  if (unmappedItems.length > 0) {
    console.log('To show more items in the Alias tab, you need to:')
    console.log('1. Map these items to Alias catalog IDs')
    console.log('2. Sync Alias market data for the mapped catalogs')
    console.log('\nUse the test-alias-flow.mjs or map-shopify-to-alias.mjs scripts to create mappings.')
  } else {
    console.log('All inventory items are mapped to Alias!')
  }
}

checkCoverage().catch(console.error)
