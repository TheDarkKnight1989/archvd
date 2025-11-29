#!/usr/bin/env node
/**
 * Populate alias_catalog_items from Alias API
 * Fetches catalog data for all items in inventory_alias_links
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ALIAS_PAT = process.env.ALIAS_PAT

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

if (!ALIAS_PAT) {
  console.error('❌ Missing ALIAS_PAT environment variable')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
})

console.log('🚀 Populating alias_catalog_items from Alias API\n')

// Get all unique catalog IDs from inventory_alias_links
const { data: links, error: linksError } = await supabase
  .from('inventory_alias_links')
  .select('alias_catalog_id')

if (linksError) {
  console.error('❌ Error fetching links:', linksError)
  process.exit(1)
}

const uniqueCatalogIds = [...new Set(links.map(l => l.alias_catalog_id))]
console.log(`📦 Found ${uniqueCatalogIds.length} unique catalog IDs to fetch\n`)

let successCount = 0
let errorCount = 0

for (const catalogId of uniqueCatalogIds) {
  try {
    console.log(`🔄 Fetching ${catalogId}...`)

    // Fetch from Alias API
    const response = await fetch(`https://api.alias.org/api/v1/catalog/${catalogId}`, {
      headers: {
        'Authorization': `Bearer ${ALIAS_PAT}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error(`   ❌ API error: ${response.status} ${response.statusText}`)
      errorCount++
      continue
    }

    const data = await response.json()
    const item = data.catalog_item

    if (!item) {
      console.error(`   ❌ No catalog_item in response`)
      errorCount++
      continue
    }

    // Generate slug (simplified version)
    const slugBase = item.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
    const sku = item.sku?.toLowerCase().replace(/\s+/g, '-') || ''
    const slug = sku ? `${slugBase}-${sku}` : slugBase

    // Upsert to database
    const { error: upsertError } = await supabase
      .from('alias_catalog_items')
      .upsert({
        catalog_id: item.catalog_id,
        product_name: item.name,
        brand: item.brand || null,
        sku: item.sku || null,
        slug,
        image_url: item.main_picture_url || null,
        thumbnail_url: item.main_picture_url || null,
        category: item.product_category_v2 || null,
        colorway: item.colorway || null,
        retail_price_cents: item.retail_price_cents || null,
        release_date: item.release_date || null,
        last_fetched_at: new Date().toISOString(),
      }, {
        onConflict: 'catalog_id'
      })

    if (upsertError) {
      console.error(`   ❌ Database error:`, upsertError.message)
      errorCount++
    } else {
      console.log(`   ✅ Cached ${item.name}`)
      if (item.main_picture_url) {
        console.log(`      📸 Image: ${item.main_picture_url.substring(0, 50)}...`)
      }
      successCount++
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))

  } catch (err) {
    console.error(`   ❌ Error:`, err.message)
    errorCount++
  }
}

console.log(`\n📊 Results: ${successCount} success, ${errorCount} errors`)

if (successCount > 0) {
  console.log('\n✅ Catalog populated! Refresh the inventory page to see images.')
}
