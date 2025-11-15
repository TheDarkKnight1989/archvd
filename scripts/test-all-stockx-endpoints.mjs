/**
 * Test ALL StockX Catalog API endpoints from developer docs
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

console.log('🧪 TESTING ALL STOCKX CATALOG API ENDPOINTS\n')

// Get credentials
const { data: account } = await supabase
  .from('stockx_accounts')
  .select('access_token')
  .eq('user_id', userId)
  .single()

if (!account) {
  console.error('❌ No StockX account')
  process.exit(1)
}

const accessToken = account.access_token
const apiKey = process.env.STOCKX_API_KEY

console.log('✓ Credentials loaded\n')

// Test helper
async function testEndpoint(name, url, description) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`📡 ${name}`)
  console.log(`   ${description}`)
  console.log(`   URL: ${url}`)

  try {
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    }
    if (apiKey) headers['x-api-key'] = apiKey

    const response = await fetch(url, { headers })

    console.log(`   Status: ${response.status} ${response.statusText}`)

    if (response.ok) {
      const data = await response.json()
      console.log(`   ✅ SUCCESS!`)

      // Show useful parts of response
      if (data.products) {
        console.log(`   → Found ${data.products.length} products`)
        if (data.products[0]) {
          console.log(`   → First product: ${data.products[0].title || data.products[0].productId}`)
        }
      } else if (data.variants) {
        console.log(`   → Found ${data.variants.length} variants`)
        if (data.variants[0]) {
          console.log(`   → First variant: ${data.variants[0].size || data.variants[0].variantId}`)
        }
      } else if (data.market) {
        console.log(`   → Market data available`)
        console.log(`   → Last sale: ${data.market.lastSale?.amount || 'N/A'}`)
        console.log(`   → Lowest ask: ${data.market.lowestAsk?.amount || 'N/A'}`)
      } else if (data.variant) {
        console.log(`   → Variant: ${data.variant.size}`)
      } else {
        console.log(`   → Response keys: ${Object.keys(data).join(', ')}`)
      }

      // Show first 500 chars of response
      console.log(`   → Response preview:`)
      console.log(JSON.stringify(data, null, 2).substring(0, 500) + '...')

      return true
    } else {
      const text = await response.text()
      console.log(`   ❌ FAILED`)
      console.log(`   → Error: ${text.substring(0, 150)}`)
      return false
    }
  } catch (error) {
    console.log(`   ❌ EXCEPTION: ${error.message}`)
    return false
  }
}

// Get a real product ID and variant ID from search first
console.log('🔍 Getting test data from search...')
const searchUrl = 'https://api.stockx.com/v2/catalog/search?query=DD1391-100'
const searchRes = await fetch(searchUrl, {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'x-api-key': apiKey,
    'Accept': 'application/json',
  },
})

let testProductId = null
let testVariantId = null
let testGtin = null

if (searchRes.ok) {
  const searchData = await searchRes.json()
  if (searchData.products && searchData.products.length > 0) {
    testProductId = searchData.products[0].productId
    console.log('✓ Test product ID:', testProductId)

    // Try to get product details to find a variant ID
    const productUrl = `https://api.stockx.com/v2/catalog/products/${testProductId}`
    const productRes = await fetch(productUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': apiKey,
        'Accept': 'application/json',
      },
    })

    if (productRes.ok) {
      const productData = await productRes.json()
      // Check for GTIN in product attributes
      if (productData.productAttributes?.gtin) {
        testGtin = productData.productAttributes.gtin
        console.log('✓ Test GTIN:', testGtin)
      }
    }
  }
}

// Now test all endpoints
const results = {
  working: [],
  forbidden: [],
  notFound: [],
  otherError: []
}

// 1. Search (we know this works)
if (await testEndpoint(
  'Search',
  'https://api.stockx.com/v2/catalog/search?query=DD1391-100',
  'Search for products by SKU, name, etc.'
)) {
  results.working.push('Search')
} else {
  results.forbidden.push('Search')
}

// 2. GetProduct (test if we have productId)
if (testProductId) {
  if (await testEndpoint(
    'GetProduct',
    `https://api.stockx.com/v2/catalog/products/${testProductId}`,
    'Get product details by ID'
  )) {
    results.working.push('GetProduct')
  } else {
    results.forbidden.push('GetProduct')
  }
}

// 3. GetVariants (list all variants for a product)
if (testProductId) {
  if (await testEndpoint(
    'GetVariants',
    `https://api.stockx.com/v2/catalog/products/${testProductId}/variants`,
    'Get all size variants for a product'
  )) {
    results.working.push('GetVariants')
  } else {
    results.forbidden.push('GetVariants')
  }
}

// 4. Try to find a variant ID from variants response
if (testProductId) {
  const variantsUrl = `https://api.stockx.com/v2/catalog/products/${testProductId}/variants`
  const variantsRes = await fetch(variantsUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': apiKey,
      'Accept': 'application/json',
    },
  })

  if (variantsRes.ok) {
    const variantsData = await variantsRes.json()
    if (variantsData.variants && variantsData.variants.length > 0) {
      testVariantId = variantsData.variants[0].variantId
      console.log('✓ Test variant ID:', testVariantId)
    }
  }
}

// 5. GetVariant (single variant by ID)
if (testVariantId) {
  if (await testEndpoint(
    'GetVariant',
    `https://api.stockx.com/v2/catalog/variants/${testVariantId}`,
    'Get single variant details by ID'
  )) {
    results.working.push('GetVariant')
  } else {
    results.forbidden.push('GetVariant')
  }
}

// 6. GetVariantMarketData
if (testVariantId) {
  if (await testEndpoint(
    'GetVariantMarketData',
    `https://api.stockx.com/v2/catalog/variants/${testVariantId}/market`,
    'Get market pricing data for a variant'
  )) {
    results.working.push('GetVariantMarketData')
  } else {
    results.forbidden.push('GetVariantMarketData')
  }
}

// 7. GetVariantsByGtin
if (testGtin) {
  if (await testEndpoint(
    'GetVariantsByGtin',
    `https://api.stockx.com/v2/catalog/variants/gtin/${testGtin}`,
    'Search variants by GTIN/UPC/EAN barcode'
  )) {
    results.working.push('GetVariantsByGtin')
  } else {
    results.forbidden.push('GetVariantsByGtin')
  }
} else {
  console.log('\n⊘ Skipping GetVariantsByGtin - no GTIN available')
  results.notFound.push('GetVariantsByGtin (no test GTIN)')
}

// 8. IngestionItems (bulk ingestion status)
if (await testEndpoint(
  'IngestionItems',
  'https://api.stockx.com/v2/catalog/ingestion/items',
  'Get ingestion items status'
)) {
  results.working.push('IngestionItems')
} else {
  results.forbidden.push('IngestionItems')
}

// 9. Ingestion (specific ingestion by ID)
// This needs a valid ingestion ID, which we don't have, so it will likely 404
const testIngestionId = 'test-id'
const ingestionStatus = await testEndpoint(
  'Ingestion',
  `https://api.stockx.com/v2/catalog/ingestion/${testIngestionId}`,
  'Get specific ingestion status by ID'
)
if (ingestionStatus) {
  results.working.push('Ingestion')
} else {
  results.notFound.push('Ingestion (no valid ID)')
}

// Summary
console.log('\n\n')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  📊 FINAL RESULTS')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log()
console.log('✅ WORKING ENDPOINTS:')
results.working.forEach(e => console.log(`   - ${e}`))
console.log()
console.log('❌ FORBIDDEN (403):')
results.forbidden.forEach(e => console.log(`   - ${e}`))
console.log()
console.log('⊘ NOT FOUND / SKIPPED:')
results.notFound.forEach(e => console.log(`   - ${e}`))
console.log()
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

console.log('\n💡 RECOMMENDATION:')
if (results.working.includes('GetVariantMarketData')) {
  console.log('   ✅ Market data endpoint works! You can fetch live prices.')
} else {
  console.log('   ❌ Market data endpoint blocked. Contact StockX to enable pricing API access.')
}
