#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkSizes() {
  const { data, error } = await supabase
    .from('inventory_alias_links')
    .select(`
      inventory_id,
      alias_catalog_id,
      Inventory!inner(sku, size_uk, brand, model)
    `)
    .eq('alias_catalog_id', 'air-jordan-1-retro-high-og-dz5485-612')

  if (error || !data) {
    console.error('Error:', error)
    return
  }

  console.log('\n=== DZ5485-612 INVENTORY ITEMS ===\n')
  for (const item of data) {
    const inv = item.Inventory
    const sizeUk = parseFloat(inv.size_uk)
    const usSize = sizeUk + 1
    console.log(`SKU: ${inv.sku}`)
    console.log(`Brand/Model: ${inv.brand} ${inv.model}`)
    console.log(`size_uk: ${inv.size_uk} (type: ${typeof inv.size_uk})`)
    console.log(`Calculated US size: ${usSize}`)
    console.log(`Catalog ID: ${item.alias_catalog_id}`)
    console.log()
  }
}

checkSizes().catch(console.error)
