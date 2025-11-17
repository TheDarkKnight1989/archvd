import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

// Get StockX auth tokens
async function getStockXTokens() {
  const { data } = await supabase
    .from('stockx_accounts')
    .select('access_token, refresh_token')
    .maybeSingle()

  return data
}

// Search StockX by SKU
async function searchStockX(sku, tokens) {
  const response = await fetch(
    `https://api.stockx.com/v2/catalog/search?query=${encodeURIComponent(sku)}`,
    {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`StockX API error: ${response.status}`)
  }

  const data = await response.json()
  return data.results || []
}

// Get product variants
async function getProductVariants(productId, tokens) {
  const response = await fetch(
    `https://api.stockx.com/v2/catalog/products/${productId}`,
    {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`StockX API error: ${response.status}`)
  }

  const data = await response.json()
  return data
}

// Convert UK size to US size (rough approximation)
function ukToUs(ukSize) {
  const size = parseFloat(ukSize)
  return (size + 1).toString()
}

// Map a single item
async function mapItem(item, tokens, dryRun = false) {
  console.log(`\n🔍 Searching for: ${item.brand} ${item.model} (${item.sku})`)

  // Search by SKU
  const results = await searchStockX(item.sku, tokens)

  if (results.length === 0) {
    console.log(`   ❌ No StockX products found for ${item.sku}`)
    return { success: false, reason: 'not_found' }
  }

  // Take first result (usually exact match)
  const product = results[0].node
  console.log(`   ✅ Found: ${product.title} (${product.styleId})`)
  console.log(`      StockX Product ID: ${product.id}`)

  // Get product variants to find the right size
  const productDetails = await getProductVariants(product.id, tokens)

  if (!productDetails.variants || productDetails.variants.length === 0) {
    console.log(`   ❌ No variants found`)
    return { success: false, reason: 'no_variants' }
  }

  // Find variant matching size
  const usSize = ukToUs(item.size_uk)
  const variant = productDetails.variants.find(v => {
    // Try exact match first
    if (v.size === usSize) return true
    // Try with "M" prefix (men's)
    if (v.size === `M ${usSize}`) return true
    // Try with "US" prefix
    if (v.size === `US ${usSize}`) return true
    return false
  })

  if (!variant) {
    console.log(`   ⚠️  No variant found for size UK${item.size_uk} (US${usSize})`)
    console.log(`      Available sizes: ${productDetails.variants.map(v => v.size).join(', ')}`)
    return { success: false, reason: 'size_not_found' }
  }

  console.log(`   ✅ Found variant: ${variant.size} (ID: ${variant.id})`)

  if (dryRun) {
    console.log(`   [DRY RUN] Would create mapping`)
    return { success: true, dryRun: true }
  }

  // Save product to database
  const { data: productData, error: productError } = await supabase
    .from('stockx_products')
    .upsert({
      stockx_product_id: product.id,
      style_id: product.styleId,
      title: product.title,
      brand: product.brand,
      colorway: product.colorway,
      retail_price: product.retailPrice,
      release_date: product.releaseDate,
      image_url: product.media?.imageUrl,
      thumb_url: product.media?.thumbUrl,
      product_category: product.productCategory,
      gender: product.gender,
    }, {
      onConflict: 'stockx_product_id',
    })
    .select('id')
    .single()

  if (productError) {
    console.log(`   ❌ Failed to save product: ${productError.message}`)
    return { success: false, reason: 'db_error', error: productError }
  }

  // Save variant to database
  const { data: variantData, error: variantError } = await supabase
    .from('stockx_variants')
    .upsert({
      stockx_variant_id: variant.id,
      stockx_product_id: product.id,
      variant_value: variant.size,
      gtins: variant.gtins || [],
    }, {
      onConflict: 'stockx_variant_id',
    })
    .select('id')
    .single()

  if (variantError) {
    console.log(`   ❌ Failed to save variant: ${variantError.message}`)
    return { success: false, reason: 'db_error', error: variantError }
  }

  // Create mapping
  const { error: mappingError } = await supabase
    .from('inventory_market_links')
    .insert({
      item_id: item.id,
      provider: 'stockx',
      stockx_product_id: product.id,
      stockx_variant_id: variant.id,
    })

  if (mappingError) {
    console.log(`   ❌ Failed to create mapping: ${mappingError.message}`)
    return { success: false, reason: 'db_error', error: mappingError }
  }

  console.log(`   ✅ Mapping created successfully!`)
  return { success: true }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  console.log('='.repeat(60))
  console.log('Auto-map Portfolio Items to StockX')
  if (dryRun) {
    console.log('[DRY RUN MODE - No changes will be made]')
  }
  console.log('='.repeat(60))

  // Get StockX tokens
  console.log('\n🔑 Fetching StockX credentials...')
  const tokens = await getStockXTokens()

  if (!tokens) {
    console.error('❌ No StockX credentials found. Please connect your StockX account first.')
    process.exit(1)
  }

  console.log('✅ StockX credentials loaded')

  // Get all active inventory items
  const { data: allItems } = await supabase
    .from('Inventory')
    .select('id, sku, brand, model, colorway, size_uk')
    .eq('status', 'active')

  if (!allItems || allItems.length === 0) {
    console.log('\n❌ No active items found')
    process.exit(0)
  }

  // Get existing mappings
  const { data: existingMappings } = await supabase
    .from('inventory_market_links')
    .select('item_id')
    .eq('provider', 'stockx')

  const mappedItemIds = new Set(existingMappings?.map(m => m.item_id) || [])

  // Filter unmapped items
  const unmappedItems = allItems.filter(item => !mappedItemIds.has(item.id))

  console.log(`\n📊 Summary:`)
  console.log(`   Total items: ${allItems.length}`)
  console.log(`   Already mapped: ${mappedItemIds.size}`)
  console.log(`   Need mapping: ${unmappedItems.length}`)

  if (unmappedItems.length === 0) {
    console.log('\n✅ All items are already mapped!')
    process.exit(0)
  }

  // Map each item
  const results = {
    success: 0,
    failed: 0,
    notFound: 0,
    sizeNotFound: 0,
  }

  for (const item of unmappedItems) {
    try {
      const result = await mapItem(item, tokens, dryRun)

      if (result.success) {
        results.success++
      } else {
        results.failed++
        if (result.reason === 'not_found') results.notFound++
        if (result.reason === 'size_not_found') results.sizeNotFound++
      }

      // Rate limit: wait 500ms between requests
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`)
      results.failed++
    }
  }

  // Final summary
  console.log('\n' + '='.repeat(60))
  console.log('FINAL SUMMARY')
  console.log('='.repeat(60))
  console.log(`✅ Successfully mapped: ${results.success}`)
  console.log(`❌ Failed: ${results.failed}`)
  console.log(`   - Not found on StockX: ${results.notFound}`)
  console.log(`   - Size not found: ${results.sizeNotFound}`)
  console.log(`   - Other errors: ${results.failed - results.notFound - results.sizeNotFound}`)

  if (dryRun) {
    console.log('\n💡 Run without --dry-run to actually create mappings')
  }
}

main().catch(console.error)
