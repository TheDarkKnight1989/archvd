#!/usr/bin/env node
/**
 * Full Portfolio Market Data Sync
 *
 * This script:
 * 1. Fetches all active inventory items with StockX mappings
 * 2. Calls StockX V2 API to get current market data (in GBP)
 * 3. Updates Inventory table with latest market prices (custom_market_value)
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const USER_ID = 'fbcde760-820b-4eaf-949f-534a8130d44b'
const CURRENCY_CODE = 'GBP'
const DELAY_MS = 650 // Rate limit: ~92 calls/hour with buffer

// Direct API call to StockX
async function callStockxApi(endpoint) {
  const token = process.env.STOCKX_ACCESS_TOKEN
  const apiKey = process.env.STOCKX_API_KEY

  const response = await fetch(`https://api.stockx.com${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-api-key': apiKey,
      'Accept': 'application/json',
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`StockX API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  return response.json()
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

console.log('🚀 Starting Full Portfolio Market Data Sync\n')
console.log(`Currency: ${CURRENCY_CODE}`)
console.log(`User: ${USER_ID}\n`)

try {
  // Step 1: Fetch all active inventory items
  console.log('1️⃣  Fetching inventory items...')

  const { data: items, error: fetchError } = await supabase
    .from('Inventory')
    .select('id, sku, size_uk')
    .eq('user_id', USER_ID)
    .in('status', ['active', 'listed', 'worn'])
    .not('sku', 'is', null)

  if (fetchError) {
    throw new Error(`Failed to fetch items: ${fetchError.message}`)
  }

  if (!items || items.length === 0) {
    console.log('   ⚠️  No items found')
    process.exit(0)
  }

  console.log(`   ✅ Found ${items.length} items\n`)

  // Step 2: Fetch StockX mappings for these items
  console.log('2️⃣  Fetching StockX mappings...')

  const { data: mappings, error: mappingsError } = await supabase
    .from('inventory_market_links')
    .select('item_id, stockx_product_id, stockx_variant_id')
    .in('item_id', items.map(i => i.id))

  if (mappingsError) {
    throw new Error(`Failed to fetch mappings: ${mappingsError.message}`)
  }

  if (!mappings || mappings.length === 0) {
    console.log('   ⚠️  No StockX mappings found for these items')
    process.exit(0)
  }

  console.log(`   ✅ Found ${mappings.length} mappings\n`)

  // Step 3: Create mapping lookup
  const mappingsByItemId = new Map(
    mappings.map(m => [m.item_id, m])
  )

  // Step 4: Group items by product to minimize API calls
  const itemsByProduct = new Map()
  for (const item of items) {
    const mapping = mappingsByItemId.get(item.id)
    if (!mapping) continue

    const productId = mapping.stockx_product_id
    if (!itemsByProduct.has(productId)) {
      itemsByProduct.set(productId, [])
    }
    itemsByProduct.get(productId).push({
      itemId: item.id,
      sku: item.sku,
      sizeUk: item.size_uk,
      variantId: mapping.stockx_variant_id,
    })
  }

  console.log(`3️⃣  Processing ${itemsByProduct.size} unique products...\n`)

  let totalProcessed = 0
  let totalSucceeded = 0
  let totalFailed = 0
  const startTime = Date.now()

  // Step 3: Fetch market data for each product and update database
  for (const [productId, items] of itemsByProduct.entries()) {
    console.log(`\n📦 Product: ${productId}`)
    console.log(`   Items: ${items.map(i => `${i.sku} (UK ${i.sizeUk})`).join(', ')}`)

    try {
      // Fetch all variants for this product
      const allVariants = await callStockxApi(
        `/v2/catalog/products/${productId}/market-data?currencyCode=${CURRENCY_CODE}`
      )

      console.log(`   ✅ Fetched market data for ${allVariants.length} variants`)

      // Process each item
      for (const item of items) {
        totalProcessed++

        // Find matching variant
        const variantData = allVariants.find(v => v.variantId === item.variantId)

        if (!variantData) {
          console.log(`   ⚠️  No market data for variant ${item.variantId} (UK ${item.sizeUk})`)
          totalFailed++
          continue
        }

        // Extract market data (using correct V2 API field names)
        const lowestAsk = variantData.lowestAskAmount ? parseFloat(variantData.lowestAskAmount) : null
        const highestBid = variantData.highestBidAmount ? parseFloat(variantData.highestBidAmount) : null

        // Look up UUID foreign keys for product and variant
        const { data: product } = await supabase
          .from('stockx_products')
          .select('id')
          .eq('stockx_product_id', productId)
          .single()

        const { data: variant } = await supabase
          .from('stockx_variants')
          .select('id')
          .eq('stockx_variant_id', item.variantId)
          .single()

        if (!product || !variant) {
          console.log(`   ⚠️  Missing product or variant UUID for UK ${item.sizeUk}`)
          totalFailed++
          continue
        }

        // Insert market data snapshot into stockx_market_snapshots table
        const { error: insertError } = await supabase
          .from('stockx_market_snapshots')
          .insert({
            stockx_product_id: productId,
            stockx_variant_id: item.variantId,
            product_id: product.id,
            variant_id: variant.id,
            currency_code: CURRENCY_CODE,
            lowest_ask: lowestAsk,
            highest_bid: highestBid,
            sales_last_72_hours: variantData.salesLast72Hours || null,
            total_sales_volume: variantData.totalSalesVolume || null,
            average_deadstock_price: variantData.averageDeadstockPrice ? parseFloat(variantData.averageDeadstockPrice) : null,
            volatility: variantData.volatility || null,
            price_premium: variantData.pricePremium || null,
            snapshot_at: new Date().toISOString(),
          })

        if (insertError) {
          console.log(`   ❌ Failed to insert snapshot for UK ${item.sizeUk}:`, insertError.message)
          totalFailed++
          continue
        }

        console.log(`   ✅ UK ${item.sizeUk}: £${lowestAsk || 'N/A'} (Ask: £${lowestAsk || 'N/A'}, Bid: £${highestBid || 'N/A'})`)
        totalSucceeded++
      }

      // Rate limiting
      await sleep(DELAY_MS)

    } catch (error) {
      console.error(`   ❌ Error fetching product ${productId}:`, error.message)
      totalFailed += items.length

      // If we hit rate limit, wait longer
      if (error.message.includes('429')) {
        console.log('   ⏳ Rate limited - waiting 60 seconds...')
        await sleep(60000)
      }
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ SYNC COMPLETE!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Total Items Processed: ${totalProcessed}`)
  console.log(`Succeeded: ${totalSucceeded}`)
  console.log(`Failed: ${totalFailed}`)
  console.log(`Duration: ${duration}s`)
  console.log(`API Calls Made: ${itemsByProduct.size}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

} catch (error) {
  console.error('\n❌ Fatal Error:', error.message)
  if (error.stack) {
    console.error('\nStack trace:')
    console.error(error.stack)
  }
  process.exit(1)
}
