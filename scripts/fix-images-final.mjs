/**
 * Fix images by constructing StockX CDN URLs from urlKey
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

console.log('🖼️  FIXING IMAGES - StockX CDN URLs\n')

// Get credentials
const { data: account } = await supabase
  .from('stockx_accounts')
  .select('access_token')
  .eq('user_id', userId)
  .single()

const accessToken = account.access_token

// Get inventory
const { data: inventory } = await supabase
  .from('Inventory')
  .select('id, sku, brand, model, image_url')
  .eq('user_id', userId)
  .in('status', ['active', 'listed', 'worn'])

console.log(`Found ${inventory?.length || 0} items\n`)

let updated = 0

for (const item of inventory || []) {
  console.log(`🔍 ${item.sku}`)

  try {
    // Search for product
    const searchUrl = `https://api.stockx.com/v2/catalog/search?query=${encodeURIComponent(item.sku)}`

    const searchRes = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': apiKey,
        'Accept': 'application/json',
      },
    })

    if (!searchRes.ok) {
      console.log(`   ❌ Search failed: ${searchRes.status}`)
      continue
    }

    const searchData = await searchRes.json()

    if (!searchData.products || searchData.products.length === 0) {
      console.log(`   ⊘ Not found`)
      continue
    }

    const product = searchData.products[0]

    // Construct StockX image URL from urlKey
    // Pattern: https://images.stockx.com/images/{UrlKey-with-capitals}.jpg
    const urlKey = product.urlKey

    // Convert URL key to proper capitalization for image URL
    // e.g., "nike-dunk-low-retro-white-black-2021" -> "Nike-Dunk-Low-Retro-White-Black-2021"
    const imageUrlKey = urlKey
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('-')

    const imageUrl = `https://images.stockx.com/images/${imageUrlKey}.jpg`

    console.log(`   ✓ Product: ${product.title}`)
    console.log(`   → Image URL: ${imageUrl}`)

    // Update inventory
    const { error } = await supabase
      .from('Inventory')
      .update({ image_url: imageUrl })
      .eq('id', item.id)

    if (error) {
      console.log(`   ❌ Update failed: ${error.message}`)
    } else {
      console.log(`   ✅ Updated`)
      updated++
    }

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 500))

  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`)
  }
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`  ✅ IMAGES FIXED`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`  Updated: ${updated}`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

console.log(`📌 Reload http://localhost:3000/portfolio/inventory`)
