/**
 * Add real product images from StockX CDN (public URLs, no API needed)
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b'

// Real StockX CDN image URLs (public, no auth needed)
const REAL_IMAGES = {
  'DZ5485-612': 'https://images.stockx.com/images/Air-Jordan-1-Retro-High-OG-Lucky-Green-Product.jpg',
  'AA2261-100': 'https://images.stockx.com/images/Nike-Craft-Mars-Yard-2-Tom-Sachs-Space-Camp-Product.jpg',
  'FD9082-102': 'https://images.stockx.com/images/Nike-Air-Force-1-Low-White-07-Product.jpg',
  'DD1391-100': 'https://images.stockx.com/images/Nike-Dunk-Low-Retro-White-Black-2021-Product.jpg',
  'DZ5485-410': 'https://images.stockx.com/images/Nike-Dunk-Low-Retro-BTTYS-Pokemon-Pikachu-Product.jpg',
  'DC7350-100': 'https://images.stockx.com/images/Air-Jordan-1-Low-OG-Neutral-Grey-Product.jpg',
  'M2002RDA': 'https://images.stockx.com/images/New-Balance-2002R-Protection-Pack-Rain-Cloud-Product.jpg',
  '3MD10251539': 'https://images.stockx.com/images/On-Cloudmonster-Triple-Black-Product.jpg',
  'HQ6316': 'https://images.stockx.com/images/adidas-Yeezy-Slide-Pure-2021-Restock-Product.jpg',
  'DN4575-200': 'https://images.stockx.com/images/Nike-Air-Max-1-Travis-Scott-Cactus-Jack-Baroque-Brown-Product.jpg',
}

console.log('🖼️  ADDING REAL PRODUCT IMAGES\n')

const { data: items } = await supabase
  .from('Inventory')
  .select('id, sku, brand, model')
  .eq('user_id', userId)
  .in('status', ['active', 'listed', 'worn'])

let updated = 0

for (const item of items || []) {
  const imageUrl = REAL_IMAGES[item.sku]

  if (!imageUrl) {
    console.log(`⊘ No image for ${item.sku}`)
    continue
  }

  const { error } = await supabase
    .from('Inventory')
    .update({ image_url: imageUrl })
    .eq('id', item.id)

  if (error) {
    console.error(`❌ ${item.sku}:`, error.message)
  } else {
    console.log(`✅ ${item.sku}: ${item.brand} ${item.model}`)
    updated++
  }
}

console.log(`\n✅ Updated ${updated} images`)
