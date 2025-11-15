/**
 * REAL StockX Sync - Uses correct v2 API endpoints
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env.local for API keys
dotenv.config({ path: join(__dirname, '..', '.env.local') })
dotenv.config({ path: join(__dirname, '..', '.env') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b'
const apiKey = process.env.STOCKX_API_KEY

console.log('🔄 REAL STOCKX SYNC - Using v2 API\n')

// Get OAuth token
const { data: account } = await supabase
  .from('stockx_accounts')
  .select('access_token, expires_at')
  .eq('user_id', userId)
  .single()

if (!account) {
  console.error('❌ No StockX account connected')
  process.exit(1)
}

if (!apiKey) {
  console.error('❌ STOCKX_API_KEY not found in environment')
  process.exit(1)
}

const accessToken = account.access_token

// Get active inventory
const { data: inventory } = await supabase
  .from('Inventory')
  .select('id, sku, size, size_uk, brand, model, purchase_price')
  .eq('user_id', userId)
  .in('status', ['active', 'listed', 'worn'])

console.log(`📦 Found ${inventory?.length || 0} active items\n`)

let productsUpdated = 0
let pricesUpdated = 0
let imagesUpdated = 0
let errors = 0

for (const item of inventory || []) {
  console.log(`\n🔍 ${item.sku}`)

  try {
    // 1. Search for product
    const searchUrl = `https://api.stockx.com/v2/catalog/search?query=${encodeURIComponent(item.sku)}`

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': apiKey,
        'Accept': 'application/json',
      },
    })

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text()
      console.error(`   ❌ Search failed: ${searchResponse.status}`, errorText.substring(0, 100))
      errors++
      continue
    }

    const searchData = await searchResponse.json()

    if (!searchData.products || searchData.products.length === 0) {
      console.log(`   ⊘ Not found on StockX`)
      continue
    }

    const product = searchData.products[0]
    console.log(`   ✓ Found: ${product.title}`)

    // DEBUG: Check if search results include variants
    if (product.variants) {
      console.log(`   → Search returned ${product.variants.length} variants`)
    } else {
      console.log(`   → No variants in search results`)
    }

    // 2. Update inventory with image
    if (product.media?.imageUrl) {
      const { error: imgError } = await supabase
        .from('Inventory')
        .update({ image_url: product.media.imageUrl })
        .eq('id', item.id)

      if (!imgError) {
        console.log(`   ✓ Image updated`)
        imagesUpdated++
      }
    }

    // 3. Get product details with variants/sizes
    const productUrl = `https://api.stockx.com/v2/catalog/products/${product.productId}`

    const productResponse = await fetch(productUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': apiKey,
        'Accept': 'application/json',
      },
    })

    if (!productResponse.ok) {
      console.warn(`   ⚠️  Product details failed: ${productResponse.status}`)
      continue
    }

    const productData = await productResponse.json()

    // DEBUG: Show response structure
    console.log(`   → Response keys:`, Object.keys(productData).join(', '))
    if (productData.product) {
      console.log(`   → Product keys:`, Object.keys(productData.product).join(', '))
    }

    // Find variant for this size
    const size = item.size_uk || item.size
    const sizeVariants = productData.product?.variants || productData.variants || []

    // DEBUG: Show all available sizes
    const availableSizes = sizeVariants.map(v => v.size).slice(0, 10).join(', ')
    console.log(`   → Looking for size: ${size} | Available: [${availableSizes}] (${sizeVariants.length} total)`)

    const variant = sizeVariants.find(v =>
      v.size === size ||
      v.size === `UK ${size}` ||
      v.size === `US ${size}` ||
      v.size == size || // Loose equality
      v.size?.toString() === size?.toString()
    )

    if (!variant) {
      console.log(`   ⊘ No variant found for size ${size}`)
      continue
    }

    console.log(`   ✓ Found variant for size ${size}`)

    // 4. Get market data for this variant
    const marketUrl = `https://api.stockx.com/v2/catalog/products/${product.productId}/market?variant=${variant.variantId}`

    const marketResponse = await fetch(marketUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': apiKey,
        'Accept': 'application/json',
      },
    })

    if (!marketResponse.ok) {
      console.warn(`   ⚠️  Market data failed: ${marketResponse.status}`)
      continue
    }

    const marketData = await marketResponse.json()
    const market = marketData.market

    if (!market) {
      console.log(`   ⊘ No market data available`)
      continue
    }

    const lastSale = market.lastSale?.amount
    const lowestAsk = market.lowestAsk?.amount
    const highestBid = market.highestBid?.amount

    console.log(`   ✓ Price: £${lastSale || lowestAsk || highestBid}`)
    console.log(`      Last sale: £${lastSale || 'N/A'}`)
    console.log(`      Lowest ask: £${lowestAsk || 'N/A'}`)
    console.log(`      Highest bid: £${highestBid || 'N/A'}`)

    // 5. Insert/update market price
    const { error: priceError } = await supabase
      .from('market_prices')
      .upsert({
        provider: 'stockx',
        sku: item.sku,
        size_uk: size,
        currency: 'GBP',
        last_sale: lastSale,
        ask: lowestAsk,
        bid: highestBid,
        as_of: new Date().toISOString(),
        meta: {
          variant_id: variant.variantId,
          sales_last_72h: market.salesLast72Hours,
          source: 'stockx-api-v2',
        },
      }, {
        onConflict: 'provider,sku,size_uk',
      })

    if (priceError && !priceError.message?.includes('duplicate')) {
      console.error(`   ❌ Price update failed:`, priceError.message)
      errors++
    } else {
      pricesUpdated++
    }

    // 6. Create inventory market link
    const { error: linkError } = await supabase
      .from('inventory_market_links')
      .upsert({
        inventory_id: item.id,
        provider: 'stockx',
        provider_product_id: product.productId,
        provider_product_sku: item.sku,
        match_confidence: 1.0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'inventory_id,provider',
      })

    if (linkError) {
      console.error(`   ❌ Link failed:`, linkError.message)
      errors++
    } else {
      productsUpdated++
    }

    // Rate limit: 2 req/sec
    await new Promise(resolve => setTimeout(resolve, 500))

  } catch (error) {
    console.error(`   ❌ Error:`, error.message)
    errors++
  }
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`  ✅ SYNC COMPLETE`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`  Products synced: ${productsUpdated}`)
console.log(`  Prices updated: ${pricesUpdated}`)
console.log(`  Images updated: ${imagesUpdated}`)
console.log(`  Errors: ${errors}`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

console.log(`📌 Reload http://localhost:3000/portfolio/inventory`)
