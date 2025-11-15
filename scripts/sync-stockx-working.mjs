/**
 * Working StockX Sync - Uses only endpoints that work
 *
 * Updates:
 * - Product images (real StockX CDN URLs)
 * - Product info (brand, model, colorway)
 * - Validates sizes exist on StockX
 *
 * Note: Market pricing requires additional API permissions from StockX
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

console.log('🔄 STOCKX SYNC - Product Info & Images\n')

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
    console.log(`   ✓ Found: ${product.title}`)

    // 2. Get full product details
    const productUrl = `https://api.stockx.com/v2/catalog/products/${product.productId}`

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

    // 3. Get variants (sizes)
    const variantsUrl = `https://api.stockx.com/v2/catalog/products/${product.productId}/variants`

    const variantsRes = await fetch(variantsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': apiKey,
        'Accept': 'application/json',
      },
    })

    let sizeExists = false
    if (variantsRes.ok) {
      const variants = await variantsRes.json()
      const size = item.size_uk || item.size
      const foundVariant = variants.find(v =>
        v.variantValue == size ||
        v.sizeChart?.defaultConversion?.size == size
      )

      if (foundVariant) {
        sizeExists = true
        console.log(`   ✓ Size ${size} exists on StockX`)
      } else {
        console.log(`   ⚠️  Size ${size} not available on StockX`)
        console.log(`      Available: ${variants.map(v => v.variantValue).slice(0, 10).join(', ')}`)
      }
    }

    // 4. Update inventory
    const updates = {
      brand: product.brand,
      model: productData.title || product.title,
      colorway: productData.productAttributes?.colorway || null,
      image_url: productData.media?.imageUrl || product.media?.imageUrl || null,
    }

    const { error: updateError } = await supabase
      .from('Inventory')
      .update(updates)
      .eq('id', item.id)

    if (updateError) {
      console.error(`   ❌ Update failed:`, updateError.message)
      errors++
    } else {
      console.log(`   ✓ Updated product info`)
      if (updates.image_url) {
        console.log(`   ✓ Image: ${updates.image_url.substring(0, 60)}...`)
      }
      updated++
    }

    // 5. Create market link (for future use when pricing is enabled)
    await supabase
      .from('inventory_market_links')
      .upsert({
        inventory_id: item.id,
        provider: 'stockx',
        provider_product_id: product.productId,
        provider_product_sku: item.sku,
        match_confidence: sizeExists ? 1.0 : 0.8,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'inventory_id,provider',
      })

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
console.log(`  Products updated: ${updated}`)
console.log(`  Errors: ${errors}`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

console.log(`📌 Reload http://localhost:3000/portfolio/inventory`)
console.log()
console.log(`⚠️  NOTE: Market pricing requires additional StockX API permissions.`)
console.log(`   Contact StockX support to enable the "market data" scope for your app.`)
