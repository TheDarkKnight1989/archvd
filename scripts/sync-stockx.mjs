#!/usr/bin/env node
/**
 * Complete StockX sync with REAL market data
 * Uses correct endpoint: /v2/catalog/products/{productId}/variants/{variantId}/market-data
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })
dotenv.config({ path: join(__dirname, '..', '.env') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b'
const apiKey = process.env.STOCKX_API_KEY

console.log('🔄 STOCKX SYNC - Real Market Data\n')

// Get credentials
const { data: account } = await supabase
  .from('stockx_accounts')
  .select('access_token')
  .eq('user_id', userId)
  .single()

if (!account || !apiKey) {
  console.error('❌ Missing credentials')
  process.exit(1)
}

const accessToken = account.access_token

// Get active inventory
const { data: inventory } = await supabase
  .from('Inventory')
  .select('id, sku, size, size_uk, brand, model')
  .eq('user_id', userId)
  .in('status', ['active', 'listed', 'worn'])

console.log(`📦 Found ${inventory?.length || 0} items\n`)

let updated = 0
let errors = 0

for (const item of inventory || []) {
  console.log(`\n🔍 ${item.sku}`)

  try {
    // 1. Search for product
    const searchUrl = `https://api.stockx.com/v2/catalog/search?query=${encodeURIComponent(item.sku)}`

    const searchRes = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': apiKey,
        'Accept': 'application/json',
      },
    })

    if (!searchRes.ok) {
      console.error(`   ❌ Search failed: ${searchRes.status}`)
      errors++
      continue
    }

    const searchData = await searchRes.json()

    if (!searchData.products || searchData.products.length === 0) {
      console.log(`   ⊘ Not found on StockX`)
      continue
    }

    const product = searchData.products[0]
    const productId = product.productId
    console.log(`   ✓ Found: ${product.title}`)

    // 2. Get product details
    const productUrl = `https://api.stockx.com/v2/catalog/products/${productId}`

    const productRes = await fetch(productUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': apiKey,
        'Accept': 'application/json',
      },
    })

    if (!productRes.ok) {
      console.warn(`   ⚠️  Product details failed: ${productRes.status}`)
      continue
    }

    const productData = await productRes.json()

    // 3. Get variants
    const variantsUrl = `https://api.stockx.com/v2/catalog/products/${productId}/variants`

    const variantsRes = await fetch(variantsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': apiKey,
        'Accept': 'application/json',
      },
    })

    if (!variantsRes.ok) {
      console.warn(`   ⚠️  Variants failed: ${variantsRes.status}`)
      continue
    }

    const variants = await variantsRes.json()

    // Find matching size variant
    const size = item.size_uk || item.size
    const variant = variants.find(v =>
      v.variantValue == size ||
      v.sizeChart?.defaultConversion?.size == size
    )

    if (!variant) {
      console.log(`   ⊘ Size ${size} not available on StockX`)
      console.log(`      Available: ${variants.map(v => v.variantValue).slice(0, 10).join(', ')}`)
      continue
    }

    const variantId = variant.variantId
    console.log(`   ✓ Found variant for size ${size}`)

    // 4. Get MARKET DATA using correct endpoint
    const marketUrl = `https://api.stockx.com/v2/catalog/products/${productId}/variants/${variantId}/market-data`

    const marketRes = await fetch(marketUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': apiKey,
        'Accept': 'application/json',
      },
    })

    if (!marketRes.ok) {
      console.error(`   ❌ Market data failed: ${marketRes.status}`)
      const errorText = await marketRes.text()
      console.error(`      ${errorText}`)
      errors++
      continue
    }

    const marketData = await marketRes.json()
    console.log(`   ✅ Got market data!`)
    console.log(`      Ask: $${marketData.lowestAskAmount} | Bid: $${marketData.highestBidAmount}`)

    // 5. Update inventory with product info and image
    const imageUrl = productData.media?.imageUrl || product.media?.imageUrl
    const updates = {
      brand: product.brand,
      model: productData.title || product.title,
      colorway: productData.productAttributes?.colorway || null,
      image_url: imageUrl || null,
    }

    const { error: updateError } = await supabase
      .from('Inventory')
      .update(updates)
      .eq('id', item.id)

    if (updateError) {
      console.error(`   ❌ Inventory update failed:`, updateError.message)
    } else {
      console.log(`   ✓ Updated product info`)
    }

    // 6. Store market data in stockx_market_prices table
    const { error: priceError} = await supabase
      .from('stockx_market_prices')
      .insert({
        sku: item.sku,
        size: size,
        currency: 'USD',
        lowest_ask: parseFloat(marketData.lowestAskAmount),
        highest_bid: parseFloat(marketData.highestBidAmount),
        last_sale: parseFloat(marketData.lowestAskAmount), // Use ask as proxy for last sale
        as_of: new Date().toISOString(),
        source: 'stockx',
        meta: {
          productId,
          variantId,
          source: 'stockx-api-v2',
        },
      })

    if (priceError) {
      console.error(`   ❌ Price storage failed:`, priceError.message)
      errors++
    } else {
      console.log(`   ✓ Stored market prices`)
    }

    // 7. Create inventory market link
    await supabase
      .from('inventory_market_links')
      .upsert({
        inventory_id: item.id,
        provider: 'stockx',
        provider_product_id: productId,
        provider_variant_id: variantId,
        provider_product_sku: item.sku,
        match_confidence: 1.0,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'inventory_id,provider',
      })

    updated++

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 500))

  } catch (error) {
    console.error(`   ❌ Error:`, error.message)
    errors++
  }
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`  ✅ SYNC COMPLETE`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`  Products synced: ${updated}`)
console.log(`  Errors: ${errors}`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

console.log(`📌 Reload http://localhost:3000/portfolio/inventory`)
console.log(`   Dashboard should now show real StockX market values!`)
