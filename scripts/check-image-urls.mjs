#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('\n🖼️  Checking StockX image URLs from API...\n')

// Get a few products with images
const { data: products } = await supabase
  .from('stockx_products')
  .select('title, style_id, image_url, thumb_url')
  .not('image_url', 'is', null)
  .limit(5)

if (products) {
  for (const product of products) {
    console.log(`\n📦 ${product.title}`)
    console.log(`   SKU: ${product.style_id}`)
    console.log(`   Image URL: ${product.image_url}`)
    console.log(`   Thumb URL: ${product.thumb_url}`)
  }
}

console.log('\n')
