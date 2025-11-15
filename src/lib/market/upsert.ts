/**
 * Idempotent market price upserts
 */

import { createClient } from '@/lib/supabase/service'
import { nowUtc } from '@/lib/time'

interface MarketPriceData {
  provider: string
  sku: string
  size: string | null
  currency: string
  lowest_ask?: number
  highest_bid?: number
  last_sale?: number
  as_of: string
  meta?: any
}

/**
 * Upsert market price only if newer than existing data
 * WHY: Prevents overwriting fresh data with stale data from slow workers
 */
export async function upsertMarketPriceIfStale(data: MarketPriceData): Promise<boolean> {
  const supabase = createClient()

  // Check if we already have newer data
  let query = supabase
    .from('stockx_market_prices')
    .select('as_of')
    .eq('sku', data.sku)
    .eq('source', data.provider)
    .order('as_of', { ascending: false })
    .limit(1)

  if (data.size) {
    query = query.eq('size', data.size)
  }

  const { data: existing } = await query.single()

  // Skip if existing data is newer
  if (existing && new Date(existing.as_of) >= new Date(data.as_of)) {
    return false // Skipped - existing data is fresher
  }

  // Insert new price record
  const { error } = await supabase.from('stockx_market_prices').insert({
    sku: data.sku,
    size: data.size || null,
    currency: data.currency,
    lowest_ask: data.lowest_ask || null,
    highest_bid: data.highest_bid || null,
    last_sale: data.last_sale || null,
    as_of: data.as_of,
    source: data.provider,
    meta: data.meta || {},
  })

  if (error) {
    console.error('Failed to upsert market price:', error)
    throw error
  }

  return true // Inserted
}

/**
 * Upsert product catalog info (brand, model, image)
 * WHY: Cache product metadata to avoid re-fetching on every render
 */
export async function upsertProductCatalog(data: {
  sku: string
  brand: string
  model: string
  colorway?: string | null
  image_url?: string | null
  provider: string
}): Promise<void> {
  const supabase = createClient()

  // Check if product exists
  const { data: existing } = await supabase
    .from('product_catalog')
    .select('sku')
    .eq('sku', data.sku)
    .single()

  if (existing) {
    // Update if we have better data
    await supabase
      .from('product_catalog')
      .update({
        brand: data.brand,
        model: data.model, // Fixed: use 'model' not 'name'
        colorway: data.colorway,
        image_url: data.image_url,
        updated_at: nowUtc(),
      })
      .eq('sku', data.sku)
  } else {
    // Insert new product
    await supabase.from('product_catalog').insert({
      sku: data.sku,
      brand: data.brand,
      model: data.model, // Fixed: use 'model' not 'name'
      colorway: data.colorway,
      image_url: data.image_url,
      retail_currency: 'USD',
    })
  }
}
