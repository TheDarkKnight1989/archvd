#!/usr/bin/env node
/**
 * Debug script to check StockX data for specific inventory items
 * Compares what useInventoryV3 would see vs what market page sees
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role to bypass RLS
)

const ITEM_IDS = [
  '3c386636-f732-401e-9d78-201f36a217f2', // Mars Yard
  'd6886554-dff3-43dd-b3d3-93318e2bcc09', // Cacao Wow
]

async function debugStockXData() {
  for (const itemId of ITEM_IDS) {
    console.log('\n' + '='.repeat(80))
    console.log(`Checking itemId: ${itemId}`)
    console.log('='.repeat(80))

    // 1. Get inventory item
    const { data: item } = await supabase
      .from('Inventory')
      .select('id, sku, brand, model, size_uk')
      .eq('id', itemId)
      .single()

    console.log('\n1. Inventory item:', item)

    // 2. Get mapping
    const { data: mapping } = await supabase
      .from('inventory_market_links')
      .select('item_id, stockx_product_id, stockx_variant_id, stockx_listing_id')
      .eq('item_id', itemId)
      .maybeSingle()

    console.log('\n2. StockX mapping:', mapping)

    if (!mapping?.stockx_product_id || !mapping?.stockx_variant_id) {
      console.log('❌ No mapping found')
      continue
    }

    // 3. Check stockx_market_latest
    const { data: marketPrices, error: marketError } = await supabase
      .from('stockx_market_latest')
      .select('*')
      .eq('stockx_product_id', mapping.stockx_product_id)
      .eq('stockx_variant_id', mapping.stockx_variant_id)

    console.log('\n3. stockx_market_latest data:', {
      count: marketPrices?.length || 0,
      prices: marketPrices,
      error: marketError,
    })

    // 4. Check stockx_products
    const { data: productData, error: productError } = await supabase
      .from('stockx_products')
      .select('*')
      .eq('stockx_product_id', mapping.stockx_product_id)
      .maybeSingle()

    console.log('\n4. stockx_products data:', {
      found: !!productData,
      product: productData,
      error: productError,
    })

    // 5. Check if there are ANY rows in stockx_market_latest for this product (ignoring variant)
    const { data: anyPrices, error: anyError } = await supabase
      .from('stockx_market_latest')
      .select('stockx_product_id, stockx_variant_id, currency_code, lowest_ask, highest_bid')
      .eq('stockx_product_id', mapping.stockx_product_id)
      .limit(5)

    console.log('\n5. Any prices for this product (ignoring variant):', {
      count: anyPrices?.length || 0,
      prices: anyPrices,
      error: anyError,
    })
  }
}

debugStockXData().catch(console.error)
