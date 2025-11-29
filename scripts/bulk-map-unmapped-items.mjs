#!/usr/bin/env node

/**
 * Bulk-map all unmapped inventory items to Alias catalog IDs
 * Uses SKU matching to find best matches
 * Does NOT create listings - only creates inventory_alias_links entries
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
const aliasPat = process.env.ALIAS_PAT

if (!supabaseUrl || !supabaseServiceKey || !aliasPat) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function searchAliasBySKU(sku) {
  const response = await fetch(`https://api.alias.org/api/v1/catalog?query=${encodeURIComponent(sku)}`, {
    headers: {
      'Authorization': `Bearer ${aliasPat}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Alias API error: ${response.status}`)
  }

  return response.json()
}

async function bulkMapUnmappedItems() {
  console.log('\n=== BULK MAPPING UNMAPPED INVENTORY ITEMS ===\n')

  // Get all inventory items
  const { data: allItems, error: itemsError } = await supabase
    .from('Inventory')
    .select('id, sku, brand, model, size_uk')
    .in('status', ['active', 'listed', 'worn'])

  if (itemsError || !allItems) {
    console.error('Error fetching inventory:', itemsError)
    return
  }

  // Get existing mappings
  const { data: existingMappings, error: mappingsError } = await supabase
    .from('inventory_alias_links')
    .select('inventory_id')

  const mappedIds = new Set(existingMappings?.map(m => m.inventory_id) || [])

  // Filter to unmapped items
  const unmappedItems = allItems.filter(item => !mappedIds.has(item.id))

  console.log(`Total inventory items: ${allItems.length}`)
  console.log(`Already mapped: ${mappedIds.size}`)
  console.log(`Unmapped items to process: ${unmappedItems.length}\n`)

  if (unmappedItems.length === 0) {
    console.log('All items are already mapped!')
    return
  }

  let successCount = 0
  let errorCount = 0
  const newlyMappedCatalogs = []

  // Process each unmapped item
  for (const item of unmappedItems) {
    console.log(`\nProcessing: ${item.brand} ${item.model} (${item.sku})`)

    try {
      // Search Alias catalog by SKU
      console.log(`  Searching Alias for SKU: ${item.sku}...`)
      const searchResult = await searchAliasBySKU(item.sku)

      if (!searchResult.catalog_items || searchResult.catalog_items.length === 0) {
        console.log(`  ✗ No matches found in Alias catalog`)
        errorCount++
        continue
      }

      // Take the first (best) match
      const match = searchResult.catalog_items[0]
      const catalogId = match.catalog_id

      console.log(`  ✓ Found match: ${catalogId}`)
      console.log(`    Title: ${match.title}`)
      console.log(`    SKU: ${match.sku || 'N/A'}`)

      // Create inventory_alias_link (NO listing)
      const { error: linkError } = await supabase
        .from('inventory_alias_links')
        .insert({
          inventory_id: item.id,
          alias_catalog_id: catalogId,
          alias_sku: match.sku,
          alias_product_name: match.title,
          alias_brand: match.brand,
          match_confidence: 1.0, // First result from exact SKU search
          mapping_status: 'ok',
        })

      if (linkError) {
        console.log(`  ✗ Error creating link: ${linkError.message}`)
        errorCount++
        continue
      }

      console.log(`  ✓ Created inventory_alias_link (no listing)`)
      successCount++
      newlyMappedCatalogs.push(catalogId)

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300))

    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`)
      errorCount++
    }
  }

  console.log('\n=== BULK MAPPING COMPLETE ===')
  console.log(`Successfully mapped: ${successCount}`)
  console.log(`Errors: ${errorCount}`)
  console.log(`Total processed: ${unmappedItems.length}`)

  return { successCount, errorCount, newlyMappedCatalogs }
}

bulkMapUnmappedItems().catch(console.error)
