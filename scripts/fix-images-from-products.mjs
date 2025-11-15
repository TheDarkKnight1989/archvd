/**
 * Fix images from StockX product details API
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

console.log('🖼️  FIXING IMAGES FROM PRODUCT DETAILS\n')

// Get credentials
const { data: account } = await supabase
  .from('stockx_accounts')
  .select('access_token')
  .eq('user_id', userId)
  .single()

const accessToken = account.access_token

// Get inventory with StockX links
const { data: links } = await supabase
  .from('inventory_market_links')
  .select('inventory_id, provider_product_id, provider_product_sku')
  .eq('provider', 'stockx')

// Get inventory items
const { data: inventory } = await supabase
  .from('Inventory')
  .select('id, sku, image_url')
  .eq('user_id', userId)
  .in('status', ['active', 'listed', 'worn'])

console.log(`Found ${inventory?.length || 0} inventory items`)
console.log(`Found ${links?.length || 0} StockX links\n`)

let updated = 0
let errors = 0

for (const item of inventory || []) {
  if (item.image_url) {
    console.log(`✓ ${item.sku} - already has image`)
    continue
  }

  const link = links?.find(l => l.inventory_id === item.id)
  if (!link) {
    console.log(`⊘ ${item.sku} - no StockX link`)
    continue
  }

  console.log(`🔍 ${item.sku}`)

  try {
    // Get product details
    const productUrl = `https://api.stockx.com/v2/catalog/products/${link.provider_product_id}`

    const productRes = await fetch(productUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': apiKey,
        'Accept': 'application/json',
      },
    })

    if (!productRes.ok) {
      if (productRes.status === 429) {
        console.log(`   ⚠️  Rate limited, stopping`)
        break
      }
      console.error(`   ❌ Failed: ${productRes.status}`)
      errors++
      continue
    }

    const productData = await productRes.json()
    const imageUrl = productData.media?.imageUrl

    if (imageUrl) {
      const { error } = await supabase
        .from('Inventory')
        .update({ image_url: imageUrl })
        .eq('id', item.id)

      if (error) {
        console.error(`   ❌ Update failed: ${error.message}`)
        errors++
      } else {
        console.log(`   ✅ ${imageUrl.substring(0, 70)}...`)
        updated++
      }
    } else {
      console.log(`   ⊘ No image in response`)
    }

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 600))

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`)
    errors++
  }
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`✅ Updated: ${updated}`)
console.log(`❌ Errors: ${errors}`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
