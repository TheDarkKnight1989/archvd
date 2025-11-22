#!/usr/bin/env node
/**
 * Backfill stockx_products and stockx_variants tables for existing mappings
 * PHASE 3.6: One-time fix for items with mappings but missing catalog records
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function backfillCatalog() {
  console.log('🔄 Starting StockX catalog backfill...\n')

  // Get all items with StockX mappings
  const { data: links } = await supabase
    .from('inventory_market_links')
    .select('item_id, stockx_product_id, stockx_variant_id')
    .not('stockx_product_id', 'is', null)
    .not('stockx_variant_id', 'is', null)

  console.log(`Found ${links.length} items with StockX mappings\n`)

  let productsCreated = 0
  let variantsCreated = 0
  let errors = 0

  for (const link of links) {
    try {
      // Check if product exists
      const { data: existingProduct } = await supabase
        .from('stockx_products')
        .select('id')
        .eq('stockx_product_id', link.stockx_product_id)
        .maybeSingle()

      if (!existingProduct) {
        // Product missing - create placeholder record
        const { error } = await supabase.from('stockx_products').insert({
          stockx_product_id: link.stockx_product_id,
          brand: 'Unknown',
          title: 'Unknown',
          colorway: null,
          image_url: null,
          category: null,
          style_id: null,
        })

        if (!error) {
          productsCreated++
          console.log(`✅ Created product: ${link.stockx_product_id}`)
        } else if (!error.message?.includes('duplicate')) {
          throw error
        }
      }

      // Check if variant exists
      const { data: existingVariant } = await supabase
        .from('stockx_variants')
        .select('id')
        .eq('stockx_variant_id', link.stockx_variant_id)
        .maybeSingle()

      if (!existingVariant) {
        // Variant missing - get product UUID first
        const { data: product } = await supabase
          .from('stockx_products')
          .select('id')
          .eq('stockx_product_id', link.stockx_product_id)
          .single()

        if (product) {
          // Create placeholder variant record
          const { error } = await supabase.from('stockx_variants').insert({
            stockx_variant_id: link.stockx_variant_id,
            product_id: product.id,
            stockx_product_id: link.stockx_product_id,
            size: null,
            size_display: null,
            variant_value: null,
          })

          if (!error) {
            variantsCreated++
            console.log(`✅ Created variant: ${link.stockx_variant_id}`)
          } else if (!error.message?.includes('duplicate')) {
            throw error
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error processing ${link.item_id}:`, error.message)
      errors++
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log('📊 Backfill Summary:')
  console.log(`   Products created: ${productsCreated}`)
  console.log(`   Variants created: ${variantsCreated}`)
  console.log(`   Errors: ${errors}`)
  console.log('='.repeat(70))
  console.log('\n✅ Backfill complete!')
  console.log('\n💡 Next step: Run this command in browser console to sync all items:')
  console.log(`   curl -X POST http://localhost:3000/api/stockx/sync/prices`)
}

backfillCatalog().catch(console.error)
