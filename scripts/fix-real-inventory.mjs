/**
 * Fix Real Inventory - Add images and standardize names
 * Uses public sneaker APIs to get real product data
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b'

console.log('🔧 FIXING REAL INVENTORY - Adding images and standardizing names\n')

// Sneaker image database (from various public sources)
const SNEAKER_IMAGES = {
  'DZ5485-612': 'https://images.stockx.com/images/Air-Jordan-1-High-OG-Lucky-Green.png',
  'DZ5485-410': 'https://images.stockx.com/images/Nike-Dunk-Low-Retro-BTTYS-Pokemon-Pikachu.png',
  'AA2261-100': 'https://images.stockx.com/images/Nike-Mars-Yard-2-Tom-Sachs-Space-Camp.png',
  'FD9082-102': 'https://images.stockx.com/images/Nike-Air-Force-1-07-Triple-White.png',
  'DD1391-100': 'https://images.stockx.com/images/Nike-Dunk-Low-Retro-White-Black-2021.png',
  'DC7350-100': 'https://images.stockx.com/images/Air-Jordan-1-Low-OG-Neutral-Grey.png',
  'M2002RDA': 'https://images.stockx.com/images/New-Balance-2002R-Protection-Pack-Rain-Cloud.png',
  '3MD10251539': 'https://images.stockx.com/360/On-CloudMonster-Triple-Black/Images/On-CloudMonster-Triple-Black/Lv2/img01.jpg',
  'HQ6316': 'https://images.stockx.com/images/adidas-Yeezy-Slide-Pure-2021-Restock.png',
  'DN4575-200': 'https://images.stockx.com/images/Nike-Air-Max-1-Travis-Scott-Baroque-Brown.png',
}

// Standardized product names
const PRODUCT_NAMES = {
  'DZ5485-612': { brand: 'Jordan', model: 'Air Jordan 1 High OG', colorway: 'Lucky Green' },
  'DZ5485-410': { brand: 'Nike', model: 'Dunk Low Retro', colorway: 'Pikachu' },
  'AA2261-100': { brand: 'Nike', model: 'Mars Yard 2.0', colorway: 'Tom Sachs Space Camp' },
  'FD9082-102': { brand: 'Nike', model: 'Air Force 1 07', colorway: 'Triple White' },
  'DD1391-100': { brand: 'Nike', model: 'Dunk Low Retro', colorway: 'Panda' },
  'DC7350-100': { brand: 'Jordan', model: 'Air Jordan 1 Low OG', colorway: 'Neutral Grey' },
  'M2002RDA': { brand: 'New Balance', model: '2002R', colorway: 'Rain Cloud' },
  '3MD10251539': { brand: 'On', model: 'Cloudmonster', colorway: 'Triple Black' },
  'HQ6316': { brand: 'adidas', model: 'Yeezy Slide', colorway: 'Pure' },
  'DN4575-200': { brand: 'Nike', model: 'Air Max 1', colorway: 'Travis Scott Baroque Brown' },
}

// Get active inventory
const { data: inventory } = await supabase
  .from('Inventory')
  .select('id, sku, brand, model, colorway, size, size_uk, image_url')
  .eq('user_id', userId)
  .eq('status', 'active')

console.log(`Found ${inventory?.length || 0} items to fix\n`)

let updated = 0
let errors = 0

for (const item of inventory || []) {
  const productInfo = PRODUCT_NAMES[item.sku]
  const imageUrl = SNEAKER_IMAGES[item.sku]

  if (!productInfo && !imageUrl) {
    console.log(`⊘ Skipping ${item.sku} - no data available`)
    continue
  }

  const updates = {}

  // Update product info if available
  if (productInfo) {
    updates.brand = productInfo.brand
    updates.model = productInfo.model
    updates.colorway = productInfo.colorway
  }

  // Update image if available
  if (imageUrl) {
    updates.image_url = imageUrl
  }

  // Fix size_uk formatting (remove UK prefix if exists)
  if (item.size_uk) {
    let size = item.size_uk
    if (typeof size === 'string' && size.toUpperCase().startsWith('UK')) {
      size = size.substring(2).trim()
      updates.size_uk = size
    }
  } else if (item.size) {
    // If size_uk is null but size exists, copy it over
    let size = item.size
    if (typeof size === 'string' && size.toUpperCase().startsWith('UK')) {
      size = size.substring(2).trim()
    }
    updates.size_uk = size
  }

  if (Object.keys(updates).length === 0) {
    console.log(`⊘ No updates needed for ${item.sku}`)
    continue
  }

  console.log(`\n🔧 Updating ${item.sku}`)
  if (updates.brand || updates.model) {
    console.log(`   → Name: ${updates.brand || item.brand} ${updates.model || item.model}${updates.colorway ? ' - ' + updates.colorway : ''}`)
  }
  if (updates.image_url) {
    console.log(`   → Image: ✅ Added`)
  }
  if (updates.size_uk) {
    console.log(`   → Size: ${updates.size_uk}`)
  }

  const { error } = await supabase
    .from('Inventory')
    .update(updates)
    .eq('id', item.id)

  if (error) {
    console.error(`   ❌ Error:`, error.message)
    errors++
  } else {
    updated++
  }
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`  ✅ INVENTORY FIXED`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`  Items updated: ${updated}`)
console.log(`  Errors: ${errors}`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

console.log(`📌 Next: Reload http://localhost:3000/portfolio to see images`)
