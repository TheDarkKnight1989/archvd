/**
 * Update images for all inventory items from StockX
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

console.log('🖼️  UPDATING IMAGES FROM STOCKX\n')

// Get credentials
const { data: account } = await supabase
  .from('stockx_accounts')
  .select('access_token')
  .eq('user_id', userId)
  .single()

const accessToken = account.access_token

// Get inventory items without images
const { data: inventory } = await supabase
  .from('Inventory')
  .select('id, sku, brand, model, image_url')
  .eq('user_id', userId)
  .in('status', ['active', 'listed', 'worn'])
  .is('image_url', null)

console.log(`Found ${inventory?.length || 0} items without images\n`)

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
      console.error(`   ❌ Search failed: ${searchRes.status}`)
      continue
    }

    const searchData = await searchRes.json()

    if (!searchData.products || searchData.products.length === 0) {
      console.log(`   ⊘ Not found`)
      continue
    }

    const product = searchData.products[0]
    const imageUrl = product.media?.imageUrl

    if (imageUrl) {
      const { error } = await supabase
        .from('Inventory')
        .update({ image_url: imageUrl })
        .eq('id', item.id)

      if (error) {
        console.error(`   ❌ Update failed: ${error.message}`)
      } else {
        console.log(`   ✅ Image updated`)
        console.log(`      ${imageUrl.substring(0, 60)}...`)
        updated++
      }
    } else {
      console.log(`   ⊘ No image available`)
    }

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 500))

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`)
  }
}

console.log(`\n✅ Updated ${updated} images`)
