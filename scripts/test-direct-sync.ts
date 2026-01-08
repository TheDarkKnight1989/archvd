import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

// Load env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const catalogId = 'solefly-x-air-jordan-3-miami-if4491-100'
const ALIAS_PAT = process.env.ALIAS_PAT!
const ALIAS_BASE_URL = 'https://api.alias.org/api/v1'

async function fetchAvailabilities(consigned?: boolean) {
  const params = new URLSearchParams()
  // NO region_id - fetch global data
  if (consigned !== undefined) {
    params.set('consigned', String(consigned))
  }
  
  const url = `${ALIAS_BASE_URL}/pricing_insights/availabilities/${catalogId}?${params}`
  console.log('Fetching:', url)
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${ALIAS_PAT}` }
  })
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }
  
  return response.json()
}

function convertCentsToMajor(centsString: string | null | undefined): number | null {
  if (!centsString || centsString === '0') return null
  const parsed = parseFloat(centsString)
  if (isNaN(parsed)) return null
  return parsed / 100
}

async function testDirectSync() {
  console.log('=== Fetching GLOBAL data (no region_id) ===')
  
  const [nonConsigned, consigned] = await Promise.all([
    fetchAvailabilities(false),
    fetchAvailabilities(true)
  ])
  
  console.log('\nNon-consigned variants:', nonConsigned.variants?.length || 0)
  console.log('Consigned variants:', consigned.variants?.length || 0)
  
  // Count with prices
  const nonConsWithPrices = nonConsigned.variants?.filter((v: any) => {
    const a = v.availability
    return a && a.lowest_listing_price_cents && a.lowest_listing_price_cents !== '0'
  }) || []
  
  const consWithPrices = consigned.variants?.filter((v: any) => {
    const a = v.availability
    return a && a.lowest_listing_price_cents && a.lowest_listing_price_cents !== '0'
  }) || []
  
  console.log('\nNon-consigned with prices:', nonConsWithPrices.length)
  console.log('Consigned with prices:', consWithPrices.length)
  
  // Show sample
  if (nonConsWithPrices.length > 0) {
    const sample = nonConsWithPrices[0]
    console.log('\nSample non-consigned:', {
      size: sample.size,
      lowest_ask: convertCentsToMajor(sample.availability.lowest_listing_price_cents),
      highest_bid: convertCentsToMajor(sample.availability.highest_offer_price_cents),
      last_sale: convertCentsToMajor(sample.availability.last_sold_listing_price_cents)
    })
  }
  
  // Now update market data directly
  console.log('\n=== Updating market data for all regions ===')
  
  const { data: variants } = await supabase
    .from('inventory_v4_alias_variants')
    .select('id, region_id, size_value, consigned')
    .eq('alias_catalog_id', catalogId)
  
  if (!variants) {
    console.log('No variants found')
    return
  }
  
  let updated = 0
  const regions = ['1', '2', '3']
  
  for (const regionId of regions) {
    const regionVariants = variants.filter(v => v.region_id === regionId)
    
    for (const v of regionVariants) {
      // Find matching API variant
      const apiVariants = v.consigned ? consigned.variants : nonConsigned.variants
      const match = apiVariants?.find((av: any) => 
        parseFloat(av.size) === v.size_value && 
        (av.consigned || false) === v.consigned
      )
      
      if (match?.availability) {
        const marketData = {
          alias_variant_id: v.id,
          lowest_ask: convertCentsToMajor(match.availability.lowest_listing_price_cents),
          highest_bid: convertCentsToMajor(match.availability.highest_offer_price_cents),
          last_sale_price: convertCentsToMajor(match.availability.last_sold_listing_price_cents),
          global_indicator_price: convertCentsToMajor(match.availability.global_indicator_price_cents),
          currency_code: 'USD',
          updated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
        
        const { error } = await supabase
          .from('inventory_v4_alias_market_data')
          .upsert(marketData, { onConflict: 'alias_variant_id' })
        
        if (!error && marketData.lowest_ask) {
          updated++
        }
      }
    }
  }
  
  console.log('Updated', updated, 'market data rows with prices')
  
  // Verify
  console.log('\n=== Verification ===')
  const { data: marketData } = await supabase
    .from('inventory_v4_alias_market_data')
    .select('alias_variant_id, lowest_ask, last_sale_price')
    .in('alias_variant_id', variants.map(v => v.id))
  
  const byRegion: Record<string, {total: number, withPrices: number}> = {}
  variants.forEach(v => {
    const m = marketData?.find(md => md.alias_variant_id === v.id)
    const hasPrice = m && (m.lowest_ask || m.last_sale_price)
    const key = `region_${v.region_id}`
    if (!byRegion[key]) byRegion[key] = { total: 0, withPrices: 0 }
    byRegion[key].total++
    if (hasPrice) byRegion[key].withPrices++
  })
  
  console.log('\nMarket data by region:')
  Object.entries(byRegion).forEach(([k, v]) => {
    console.log(`  ${k}: ${v.withPrices}/${v.total} with prices`)
  })
}

testDirectSync().catch(console.error)
