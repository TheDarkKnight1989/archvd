import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALIAS_PAT = process.env.ALIAS_PAT
const ALIAS_BASE_URL = 'https://api.alias.org/api/v1'

async function fetchAlias(endpoint, params = {}) {
  const url = new URL(`${ALIAS_BASE_URL}${endpoint}`)
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value)
  })

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${ALIAS_PAT}`,
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Alias API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

async function main() {
  // Men's product: Jordan 4 Military Black
  const catalogId = 'air-jordan-4-retro-military-black-dh6927-111'

  // Fetch FRESH from API
  console.log('=== FRESH API RESPONSE ===')
  const apiResponse = await fetchAlias(`/catalog/${catalogId}`)
  const apiProduct = apiResponse.catalog_item
  const freshAllowedSizes = apiProduct.allowed_sizes?.map(s => parseFloat(s.value)).sort((a, b) => a - b) || []
  console.log('API allowed_sizes:', freshAllowedSizes.join(', '))
  console.log('Unit:', apiProduct.allowed_sizes?.[0]?.unit || 'unknown')

  // Fetch availabilities (what sizes API returns prices for)
  const availabilities = await fetchAlias(`/pricing_insights/availabilities/${catalogId}`, {
    region_id: '3',
    consigned: 'false'
  })
  const apiVariantSizes = [...new Set(availabilities.variants.map(v => parseFloat(v.size)))].sort((a, b) => a - b)
  console.log('\nAPI availabilities sizes:', apiVariantSizes.join(', '))
  console.log('Count:', apiVariantSizes.length)

  // What sizes are in availabilities but NOT in allowed_sizes?
  const notInAllowed = apiVariantSizes.filter(s => !freshAllowedSizes.includes(s))
  console.log('\n⚠️  In availabilities but NOT in allowed_sizes:', notInAllowed.join(', '))

  // DB product
  const { data: product } = await supabase
    .from('inventory_v4_alias_products')
    .select('alias_catalog_id, sku, name, allowed_sizes')
    .eq('alias_catalog_id', catalogId)
    .single()

  console.log('\n=== DB PRODUCT allowed_sizes ===')
  console.log('SKU:', product?.sku)
  console.log('Name:', product?.name)

  if (product?.allowed_sizes) {
    const sizes = product.allowed_sizes.map(s => s.value).sort((a, b) => a - b)
    console.log('Allowed sizes:', sizes.join(', '))
    console.log('Unit:', product.allowed_sizes[0]?.unit || 'unknown')
    console.log('Count:', sizes.length)
  }

  const { data: variants } = await supabase
    .from('inventory_v4_alias_variants')
    .select('size_value, size_display, size_unit, region_id, consigned')
    .eq('alias_catalog_id', catalogId)
    .order('size_value')

  console.log('\n=== ACTUAL DB VARIANTS ===')
  console.log('Total variants:', variants?.length)

  const byRegion = {}
  for (const v of variants || []) {
    const key = v.region_id
    if (!byRegion[key]) byRegion[key] = { consigned: [], nonConsigned: [] }
    if (v.consigned) {
      byRegion[key].consigned.push(v.size_value)
    } else {
      byRegion[key].nonConsigned.push(v.size_value)
    }
  }

  for (const [region, data] of Object.entries(byRegion)) {
    const nonConsigned = [...new Set(data.nonConsigned)].sort((a, b) => a - b)
    const consigned = [...new Set(data.consigned)].sort((a, b) => a - b)
    console.log(`\nRegion ${region}:`)
    console.log(`  Non-consigned (${nonConsigned.length}): ${nonConsigned.join(', ')}`)
    console.log(`  Consigned (${consigned.length}): ${consigned.join(', ')}`)
  }
}

main()
