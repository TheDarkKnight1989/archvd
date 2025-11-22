#!/usr/bin/env node

const urlKey = 'nikecraft-mars-yard-shoe-2pt0-tom-sachs-space-camp'
const productId = '5bbcafa8-80d2-4eda-b3ac-ad192a3ffdbf'

// Test various image URL patterns
const patterns = [
  // Pattern 1: urlKey with Product suffix
  `https://images.stockx.com/images/${urlKey}-Product.jpg`,

  // Pattern 2: productId
  `https://images.stockx.com/images/${productId}.jpg`,
  `https://images.stockx.com/images/${productId}-Product.jpg`,

  // Pattern 3: 360 view
  `https://images.stockx.com/360/${urlKey}/Images/${urlKey}/Lv2/img01.jpg`,
]

console.log('Testing image URL patterns:\n')

for (const url of patterns) {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    console.log(`${response.ok ? '✅' : '❌'} [${response.status}] ${url}`)
    if (response.ok) {
      console.log(`   → Content-Type: ${response.headers.get('content-type')}`)
      console.log(`   → Content-Length: ${response.headers.get('content-length')} bytes`)
    }
  } catch (error) {
    console.log(`❌ [ERR] ${url}`)
    console.log(`   → ${error.message}`)
  }
}
