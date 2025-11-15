/**
 * REAL StockX Sync - Uses actual StockX API with OAuth tokens
 * Fetches product metadata, images, and live prices for inventory
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b'

console.log('🔄 REAL STOCKX SYNC - Fetching live data from StockX API\n')

// Get user's StockX OAuth token
const { data: stockxAccount } = await supabase
  .from('stockx_accounts')
  .select('access_token, expires_at')
  .eq('user_id', userId)
  .single()

if (!stockxAccount) {
  console.error('❌ No StockX account connected')
  console.log('Visit http://localhost:3000/api/stockx/oauth/start to connect')
  process.exit(1)
}

// Check token expiry
const expiresAt = new Date(stockxAccount.expires_at)
if (expiresAt < new Date()) {
  console.error('❌ StockX token expired at', expiresAt.toISOString())
  console.log('Reconnect at http://localhost:3000/api/stockx/oauth/start')
  process.exit(1)
}

console.log('✓ StockX OAuth token valid until', expiresAt.toISOString())

const accessToken = stockxAccount.access_token
const stockxApiBase = 'https://api.stockx.com'
const stockxApiKey = process.env.STOCKX_API_KEY

// Get active inventory
const { data: inventory } = await supabase
  .from('Inventory')
  .select('id, sku, size, size_uk, brand, model')
  .eq('user_id', userId)
  .eq('status', 'active')

console.log(`\n📦 Found ${inventory?.length || 0} active inventory items\n`)

if (!inventory || inventory.length === 0) {
  console.log('No inventory to sync')
  process.exit(0)
}

let productsCreated = 0
let pricesCreated = 0
let linksCreated = 0
let errors = 0

for (const item of inventory) {
  console.log(`\n🔍 Processing: ${item.sku}`)

  try {
    // 1. Search StockX for product by SKU
    const searchUrl = `${stockxApiBase}/v1/search?query=${encodeURIComponent(item.sku)}`
    console.log(`   → Searching StockX: ${item.sku}`)

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': stockxApiKey,
        'Accept': 'application/json',
      },
    })

    if (!searchResponse.ok) {
      console.error(`   ❌ Search failed: ${searchResponse.status} ${searchResponse.statusText}`)
      const errorText = await searchResponse.text()
      console.error(`   Error: ${errorText}`)
      errors++
      continue
    }

    const searchData = await searchResponse.json()
    const products = searchData.data?.products || searchData.products || []

    if (products.length === 0) {
      console.log(`   ⊘ Not found on StockX: ${item.sku}`)
      continue
    }

    // Take first matching product
    const product = products[0]
    console.log(`   ✓ Found: ${product.brand} ${product.name}`)
    console.log(`   → Image: ${product.image || product.media?.imageUrl || 'none'}`)

    // 2. Insert into market_products
    const { error: productError } = await supabase
      .from('market_products')
      .upsert({
        provider: 'stockx',
        provider_product_id: product.id || product.urlKey,
        sku: item.sku,
        brand: product.brand,
        model: product.name || product.title,
        colorway: product.colorway,
        image_url: product.image || product.media?.imageUrl || product.media?.smallImageUrl,
        meta: {
          retailPrice: product.retailPrice,
          releaseDate: product.releaseDate,
          category: product.category,
          urlKey: product.urlKey,
          source: 'stockx-api',
        },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'provider,provider_product_id',
      })

    if (productError) {
      console.error(`   ❌ Product insert failed:`, productError.message)
      errors++
      continue
    }

    productsCreated++

    // 3. Fetch market prices for this SKU
    let size = item.size_uk || item.size
    if (size && typeof size === 'string' && size.toUpperCase().startsWith('UK')) {
      size = size.substring(2).trim()
    }

    if (!size) {
      console.log(`   ⊘ No size - skipping prices`)
      continue
    }

    console.log(`   → Fetching prices for size ${size}`)

    // StockX market endpoint
    const marketUrl = `${stockxApiBase}/v1/products/${encodeURIComponent(product.id || product.urlKey)}/market?size=${encodeURIComponent(size)}&currency=GBP`

    const marketResponse = await fetch(marketUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': stockxApiKey,
        'Accept': 'application/json',
      },
    })

    if (!marketResponse.ok) {
      console.error(`   ❌ Market data failed: ${marketResponse.status}`)
      errors++
      continue
    }

    const marketData = await marketResponse.json()
    const market = marketData.data || marketData

    const lastSale = market.lastSale || null
    const lowestAsk = market.lowestAsk || null
    const highestBid = market.highestBid || null

    if (!lastSale && !lowestAsk && !highestBid) {
      console.log(`   ⊘ No prices available for size ${size}`)
      continue
    }

    console.log(`   ✓ Price: £${lastSale || lowestAsk || highestBid} (last: £${lastSale}, ask: £${lowestAsk}, bid: £${highestBid})`)

    // 4. Insert price
    const { error: priceError } = await supabase
      .from('market_prices')
      .insert({
        provider: 'stockx',
        sku: item.sku,
        size_uk: size,
        currency: 'GBP',
        last_sale: lastSale,
        ask: lowestAsk,
        bid: highestBid,
        as_of: new Date().toISOString(),
        meta: {
          salesLast72h: market.salesLast72Hours,
          volatility: market.volatility,
          source: 'stockx-api',
        },
      })

    if (priceError && !priceError.message?.includes('duplicate')) {
      console.error(`   ❌ Price insert failed:`, priceError.message)
      errors++
    } else {
      pricesCreated++
    }

    // 5. Create inventory link
    const { error: linkError } = await supabase
      .from('inventory_market_links')
      .upsert({
        inventory_id: item.id,
        provider: 'stockx',
        provider_product_sku: item.sku,
        provider_product_id: product.id || product.urlKey,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'inventory_id,provider',
      })

    if (linkError) {
      console.error(`   ❌ Link failed:`, linkError.message)
      errors++
    } else {
      linksCreated++
    }

  } catch (error) {
    console.error(`   ❌ Error processing ${item.sku}:`, error.message)
    errors++
  }

  // Rate limit: 1 req/sec
  await new Promise(resolve => setTimeout(resolve, 1000))
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`  ✅ SYNC COMPLETE`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`  Products synced: ${productsCreated}`)
console.log(`  Prices fetched: ${pricesCreated}`)
console.log(`  Links created: ${linksCreated}`)
console.log(`  Errors: ${errors}`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

console.log(`📌 Next: Refresh dashboard at http://localhost:3000/portfolio`)
