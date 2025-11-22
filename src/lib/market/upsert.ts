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

/**
 * Upsert StockX market snapshot
 * PHASE 3.5: Fixed target table - writes to stockx_market_snapshots instead of stockx_market_prices
 * WHY: stockx_market_latest view is built from snapshots, not from market_prices
 */
export async function upsertMarketSnapshot(data: {
  stockxProductId: string
  stockxVariantId: string
  currencyCode: string
  lowestAsk?: number | null
  highestBid?: number | null
  salesLast72h?: number | null
  totalVolume?: number | null
  averageDeadstockPrice?: number | null
  volatility?: number | null
  pricePremium?: number | null
}): Promise<boolean> {
  const supabase = createClient()

  try {
    // Get UUID foreign keys for product and variant
    const { data: product, error: productError } = await supabase
      .from('stockx_products')
      .select('id')
      .eq('stockx_product_id', data.stockxProductId)
      .single()

    const { data: variant, error: variantError } = await supabase
      .from('stockx_variants')
      .select('id')
      .eq('stockx_variant_id', data.stockxVariantId)
      .single()

    if (!product || !variant) {
      console.error('[Market Snapshot] PHASE 3.7 DEBUG - Missing product or variant UUID:', {
        stockxProductId: data.stockxProductId,
        stockxVariantId: data.stockxVariantId,
        hasProduct: !!product,
        hasVariant: !!variant,
        productError: productError?.message || 'none',
        variantError: variantError?.message || 'none',
        currencyCode: data.currencyCode,
        lowestAsk: data.lowestAsk,
        highestBid: data.highestBid,
      })
      return false
    }

    // PHASE 3.7: Log payload before insert
    const payload = {
      stockx_product_id: data.stockxProductId,
      stockx_variant_id: data.stockxVariantId,
      product_id: product.id,
      variant_id: variant.id,
      currency_code: data.currencyCode,
      lowest_ask: data.lowestAsk ?? null,
      highest_bid: data.highestBid ?? null,
      sales_last_72_hours: data.salesLast72h ?? null,
      total_sales_volume: data.totalVolume ?? null,
      average_deadstock_price: data.averageDeadstockPrice ?? null,
      volatility: data.volatility ?? null,
      price_premium: data.pricePremium ?? null,
      snapshot_at: nowUtc(),
    }

    console.log('[Market Snapshot] PHASE 3.7 DEBUG - Attempting insert with payload:', payload)

    // Insert snapshot
    const { error } = await supabase.from('stockx_market_snapshots').insert(payload)

    if (error) {
      console.error('[Market Snapshot] PHASE 3.7 DEBUG - Insert failed:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        payload: {
          stockxProductId: data.stockxProductId,
          stockxVariantId: data.stockxVariantId,
          productUUID: product.id,
          variantUUID: variant.id,
          currencyCode: data.currencyCode,
        },
      })
      throw error
    }

    console.log('[Market Snapshot] Successfully inserted snapshot for', data.stockxProductId, data.stockxVariantId)
    return true // Successfully inserted
  } catch (error: any) {
    console.error('[Market Snapshot] PHASE 3.7 DEBUG - Outer catch:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack?.split('\n')[0],
    })
    return false
  }
}

/**
 * Upsert StockX product to stockx_products table
 * WHY: upsertMarketSnapshot requires product UUID to exist as foreign key
 * PHASE 3.6: Populate stockx_products table before writing snapshots
 */
export async function upsertStockxProduct(data: {
  stockxProductId: string
  brand?: string | null
  title?: string | null
  colorway?: string | null
  imageUrl?: string | null
  category?: string | null
  styleId?: string | null
}): Promise<void> {
  const supabase = createClient()

  // Check if product exists
  const { data: existing } = await supabase
    .from('stockx_products')
    .select('id')
    .eq('stockx_product_id', data.stockxProductId)
    .maybeSingle()

  if (existing) {
    // Update if we have better data
    await supabase
      .from('stockx_products')
      .update({
        brand: data.brand ?? undefined,
        title: data.title ?? undefined,
        colorway: data.colorway ?? undefined,
        image_url: data.imageUrl ?? undefined,
        category: data.category ?? undefined,
        style_id: data.styleId ?? undefined,
        updated_at: nowUtc(),
      })
      .eq('id', existing.id)

    console.log(`[StockX Product] Updated product ${data.stockxProductId}`)
  } else {
    // Insert new product
    await supabase.from('stockx_products').insert({
      stockx_product_id: data.stockxProductId,
      brand: data.brand ?? null,
      title: data.title ?? null,
      colorway: data.colorway ?? null,
      image_url: data.imageUrl ?? null,
      category: data.category ?? null,
      style_id: data.styleId ?? null,
    })

    console.log(`[StockX Product] Inserted product ${data.stockxProductId}`)
  }
}

/**
 * Upsert StockX variant to stockx_variants table
 * WHY: upsertMarketSnapshot requires variant UUID to exist as foreign key
 * PHASE 3.6: Populate stockx_variants table before writing snapshots
 */
export async function upsertStockxVariant(data: {
  stockxVariantId: string
  stockxProductId: string
  size?: string | null
  sizeDisplay?: string | null
  variantValue?: string | null
}): Promise<void> {
  const supabase = createClient()

  // Get product UUID for foreign key
  const { data: product } = await supabase
    .from('stockx_products')
    .select('id')
    .eq('stockx_product_id', data.stockxProductId)
    .single()

  if (!product) {
    console.error(`[StockX Variant] Product ${data.stockxProductId} not found - cannot insert variant`)
    throw new Error(`Product ${data.stockxProductId} must be inserted before variant`)
  }

  // Check if variant exists
  const { data: existing } = await supabase
    .from('stockx_variants')
    .select('id')
    .eq('stockx_variant_id', data.stockxVariantId)
    .maybeSingle()

  // PHASE 3.7: Ensure variant_value is never null (NOT NULL constraint)
  const variantValue = data.variantValue || data.size || data.sizeDisplay || 'Unknown'

  if (existing) {
    // Update if we have better data
    const { error: updateError } = await supabase
      .from('stockx_variants')
      .update({
        variant_value: variantValue,
        updated_at: nowUtc(),
      })
      .eq('id', existing.id)

    if (updateError) {
      console.error(`[StockX Variant] PHASE 3.7 - Failed to update variant ${data.stockxVariantId}:`, {
        error: updateError.message,
        code: updateError.code,
        details: updateError.details,
      })
      throw updateError
    }

    console.log(`[StockX Variant] Updated variant ${data.stockxVariantId}`)
  } else {
    // Insert new variant
    const { error: insertError } = await supabase.from('stockx_variants').insert({
      stockx_variant_id: data.stockxVariantId,
      product_id: product.id,
      stockx_product_id: data.stockxProductId,
      variant_value: variantValue,  // PHASE 3.7: Never null, satisfies NOT NULL constraint
    })

    if (insertError) {
      console.error(`[StockX Variant] PHASE 3.7 - Failed to insert variant ${data.stockxVariantId}:`, {
        error: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
        productId: data.stockxProductId,
        variantId: data.stockxVariantId,
        variantValue,
      })
      throw insertError
    }

    console.log(`[StockX Variant] Inserted variant ${data.stockxVariantId}`)
  }
}
