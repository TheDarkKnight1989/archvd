#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('\n🖼️  Checking StockX image URLs in database...\n')

// Get some StockX products with image URLs
const { data: products, error } = await supabase
  .from('stockx_products')
  .select('style_id, title, image_url, thumb_url')
  .not('image_url', 'is', null)
  .limit(5)

if (error) {
  console.error('❌ Error:', error)
  process.exit(1)
}

if (!products || products.length === 0) {
  console.log('❌ No products with image URLs found in database')
  console.log('\n💡 This means images were never fetched from StockX API')
  console.log('   You need to run the StockX catalog sync to fetch product data including images\n')
} else {
  console.log(`✅ Found ${products.length} products with image URLs:\n`)

  products.forEach((p, i) => {
    console.log(`${i + 1}. ${p.title} (${p.style_id})`)
    console.log(`   image_url: ${p.image_url || '(null)'}`)
    console.log(`   thumb_url: ${p.thumb_url || '(null)'}`)
    console.log('')
  })

  console.log('\n🧪 Test these URLs:')
  console.log('   Copy any image_url above and paste it in your browser')
  console.log('   If you get a 404, the URLs are invalid or StockX blocks direct access\n')
}
