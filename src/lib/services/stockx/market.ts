/**
 * StockX Market API
 * Market pricing, asks/bids, and recent sales data
 */

import { getStockxClient } from './client'
import { isStockxMockMode } from '@/lib/config/stockx'

// ============================================================================
// Types
// ============================================================================

export interface StockxMarketPrice {
  sku: string
  size: string
  currency: string
  lowestAsk: number | null
  highestBid: number | null
  lastSale: number | null
  lastSaleDate: string | null
  salesLast72Hours: number
  volatility: number
  deadstockSold: number
  pricePremium: number
  averageDeadstockPrice: number
  as_of: string
}

export interface StockxSaleHistory {
  sku: string
  size: string
  currency: string
  salePrice: number
  soldAt: string
}

export interface StockxMarketData {
  sku: string
  variants: Array<{
    size: string
    lowestAsk: number | null
    highestBid: number | null
    lastSale: number | null
    lastSaleDate: string | null
  }>
  as_of: string
}

// ============================================================================
// Mock Data
// ============================================================================

function generateMockMarketPrice(sku: string, size: string): StockxMarketPrice {
  const basePrice = 150 + Math.random() * 200

  return {
    sku,
    size,
    currency: 'USD',
    lowestAsk: basePrice + 20,
    highestBid: basePrice - 10,
    lastSale: basePrice,
    lastSaleDate: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
    salesLast72Hours: Math.floor(Math.random() * 50),
    volatility: Math.random() * 0.2,
    deadstockSold: Math.floor(Math.random() * 1000),
    pricePremium: Math.random() * 0.5 - 0.1,
    averageDeadstockPrice: basePrice,
    as_of: new Date().toISOString(),
  }
}

function generateMockSalesHistory(sku: string, size: string, count: number): StockxSaleHistory[] {
  const basePrice = 150 + Math.random() * 200
  const sales: StockxSaleHistory[] = []

  for (let i = 0; i < count; i++) {
    const daysAgo = i * (30 / count)
    sales.push({
      sku,
      size,
      currency: 'USD',
      salePrice: basePrice + (Math.random() - 0.5) * 50,
      soldAt: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    })
  }

  return sales.reverse()
}

// ============================================================================
// Market API
// ============================================================================

/**
 * Get market pricing for a specific SKU and size
 */
export async function getMarketPrice(
  sku: string,
  size: string,
  currency: string = 'USD'
): Promise<StockxMarketPrice | null> {
  // Mock mode
  if (isStockxMockMode()) {
    console.log('[StockX Market] Mock get market price', { sku, size, currency })
    return generateMockMarketPrice(sku, size)
  }

  // Real API
  const client = getStockxClient()

  try {
    const response = await client.request<any>(
      `/v1/products/${encodeURIComponent(sku)}/market?size=${encodeURIComponent(size)}&currency=${currency}`
    )

    const data = response.data || response

    return {
      sku,
      size,
      currency,
      lowestAsk: data.lowestAsk || null,
      highestBid: data.highestBid || null,
      lastSale: data.lastSale || null,
      lastSaleDate: data.lastSaleDate || null,
      salesLast72Hours: data.salesLast72Hours || 0,
      volatility: data.volatility || 0,
      deadstockSold: data.deadstockSold || 0,
      pricePremium: data.pricePremium || 0,
      averageDeadstockPrice: data.averageDeadstockPrice || data.lastSale || 0,
      as_of: new Date().toISOString(),
    }
  } catch (error: any) {
    if (error.message?.includes('404')) {
      return null
    }
    console.error('[StockX Market] Get market price failed:', error)
    throw error
  }
}

/**
 * Get market data for all sizes of a SKU
 */
export async function getMarketData(
  sku: string,
  currency: string = 'USD'
): Promise<StockxMarketData | null> {
  // Mock mode
  if (isStockxMockMode()) {
    console.log('[StockX Market] Mock get market data', { sku, currency })

    const sizes = ['8', '9', '10', '11', '12']
    const variants = sizes.map(size => {
      const basePrice = 150 + Math.random() * 200
      return {
        size,
        lowestAsk: basePrice + 20,
        highestBid: basePrice - 10,
        lastSale: basePrice,
        lastSaleDate: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
      }
    })

    return {
      sku,
      variants,
      as_of: new Date().toISOString(),
    }
  }

  // Real API
  const client = getStockxClient()

  try {
    const response = await client.request<any>(
      `/v1/products/${encodeURIComponent(sku)}/market?currency=${currency}`
    )

    const data = response.data || response

    return {
      sku,
      variants: (data.variants || []).map((v: any) => ({
        size: v.size,
        lowestAsk: v.lowestAsk || null,
        highestBid: v.highestBid || null,
        lastSale: v.lastSale || null,
        lastSaleDate: v.lastSaleDate || null,
      })),
      as_of: new Date().toISOString(),
    }
  } catch (error: any) {
    if (error.message?.includes('404')) {
      return null
    }
    console.error('[StockX Market] Get market data failed:', error)
    throw error
  }
}

/**
 * Get recent sales history for a SKU and size
 */
export async function getSalesHistory(
  sku: string,
  size: string,
  options: {
    limit?: number
    days?: number
    currency?: string
  } = {}
): Promise<StockxSaleHistory[]> {
  const { limit = 30, days = 30, currency = 'USD' } = options

  // Mock mode
  if (isStockxMockMode()) {
    console.log('[StockX Market] Mock get sales history', { sku, size, limit, days })
    return generateMockSalesHistory(sku, size, limit)
  }

  // Real API
  const client = getStockxClient()

  try {
    const response = await client.request<any>(
      `/v1/products/${encodeURIComponent(sku)}/sales?size=${encodeURIComponent(size)}&limit=${limit}&days=${days}&currency=${currency}`
    )

    const sales = response.data || response.sales || []

    return sales.map((sale: any) => ({
      sku,
      size,
      currency,
      salePrice: sale.amount || sale.price,
      soldAt: sale.createdAt || sale.timestamp || sale.soldAt,
    }))
  } catch (error) {
    console.error('[StockX Market] Get sales history failed:', error)
    return []
  }
}

/**
 * Batch get market prices for multiple SKU+size combinations
 */
export async function batchGetMarketPrices(
  items: Array<{ sku: string; size: string }>,
  currency: string = 'USD'
): Promise<StockxMarketPrice[]> {
  const promises = items.map(({ sku, size }) =>
    getMarketPrice(sku, size, currency).catch(err => {
      console.warn(`[StockX Market] Failed to get price for ${sku} size ${size}:`, err)
      return null
    })
  )

  const results = await Promise.all(promises)
  return results.filter((r): r is StockxMarketPrice => r !== null)
}

// ============================================================================
// V2 Market Data Sync Service
// ============================================================================

import { createClient } from '@/lib/supabase/server'
import type { StockxMarketSnapshot } from '@/lib/stockx/types'

interface StockxV2MarketDataResponse {
  productId: string
  currencyCode: string
  variants: Array<{
    variantId: string
    size: string
    lastSale?: number
    lowestAsk?: number
    highestBid?: number
    salesLast72Hours?: number
    totalVolume?: number
    averagePrice?: number
    volatility?: number
    pricePremium?: number
  }>
}

export class StockxMarketV2Service {
  /**
   * Get V2 market data for a product (all variants at once)
   */
  static async getProductMarketData(
    productId: string,
    currency: string = 'USD'
  ): Promise<StockxV2MarketDataResponse | null> {
    if (isStockxMockMode()) {
      console.log('[StockX V2 Market] Mock mode - skipping')
      return null
    }

    console.log('[StockX V2 Market] Fetching:', { productId, currency })

    try {
      const client = getStockxClient()
      const response = await client.request<StockxV2MarketDataResponse>(
        `/v2/catalog/products/${productId}/market-data?currency=${currency}`
      )

      console.log('[StockX V2 Market] Got data:', {
        productId,
        variants: response.variants?.length || 0,
      })

      return response
    } catch (error) {
      console.error('[StockX V2 Market] Error:', error)
      return null
    }
  }

  /**
   * Sync market data for all tracked products in inventory and watchlist
   */
  static async syncAllMarketData(): Promise<{
    productsProcessed: number
    snapshotsCreated: number
    errors: number
  }> {
    console.log('[StockX V2 Market] Starting full sync')
    const startTime = Date.now()

    const supabase = await createClient()

    // Get all unique StockX product IDs from inventory and watchlist
    const { data: inventoryLinks } = await supabase
      .from('inventory_market_links')
      .select('stockx_product_id')
      .not('stockx_product_id', 'is', null)

    const { data: watchlistLinks } = await supabase
      .from('watchlist_market_links')
      .select('stockx_product_id')
      .not('stockx_product_id', 'is', null)

    // Combine and deduplicate
    const allProductIds = new Set<string>()
    inventoryLinks?.forEach((link) => allProductIds.add(link.stockx_product_id))
    watchlistLinks?.forEach((link) => allProductIds.add(link.stockx_product_id))

    if (allProductIds.size === 0) {
      console.log('[StockX V2 Market] No products to sync')
      return { productsProcessed: 0, snapshotsCreated: 0, errors: 0 }
    }

    console.log('[StockX V2 Market] Products to sync:', allProductIds.size)

    let productsProcessed = 0
    let snapshotsCreated = 0
    let errors = 0

    // Support multiple currencies
    const currencies = ['USD', 'GBP', 'EUR']

    for (const productId of allProductIds) {
      for (const currency of currencies) {
        try {
          // Fetch market data for all variants of this product at once
          const marketData = await this.getProductMarketData(productId, currency)

          if (!marketData || !marketData.variants || marketData.variants.length === 0) {
            continue
          }

          // Get our internal product UUID
          const { data: stockxProduct } = await supabase
            .from('stockx_products')
            .select('id')
            .eq('stockx_product_id', productId)
            .single()

          if (!stockxProduct) {
            console.warn('[StockX V2 Market] Product not in DB:', productId)
            continue
          }

          // Insert snapshots for each variant
          for (const variantData of marketData.variants) {
            // Get our internal variant UUID
            const { data: stockxVariant } = await supabase
              .from('stockx_variants')
              .select('id')
              .eq('stockx_variant_id', variantData.variantId)
              .single()

            if (!stockxVariant) {
              continue
            }

            // Insert snapshot
            const snapshot: Omit<StockxMarketSnapshot, 'id' | 'created_at'> = {
              stockx_product_id: productId,
              stockx_variant_id: variantData.variantId,
              product_id: stockxProduct.id,
              variant_id: stockxVariant.id,
              currency_code: currency,
              last_sale_price: variantData.lastSale,
              sales_last_72_hours: variantData.salesLast72Hours,
              total_sales_volume: variantData.totalVolume,
              lowest_ask: variantData.lowestAsk,
              highest_bid: variantData.highestBid,
              average_deadstock_price: variantData.averagePrice,
              volatility: variantData.volatility,
              price_premium: variantData.pricePremium,
              snapshot_at: new Date().toISOString(),
            }

            const { error } = await supabase.from('stockx_market_snapshots').insert(snapshot)

            if (!error) {
              snapshotsCreated++
            } else {
              console.error('[StockX V2 Market] Insert error:', error)
              errors++
            }
          }

          productsProcessed++

          // Rate limit: 100ms between product requests
          await new Promise((resolve) => setTimeout(resolve, 100))
        } catch (error) {
          console.error('[StockX V2 Market] Product error:', productId, error)
          errors++
        }
      }
    }

    // Refresh materialized view
    try {
      console.log('[StockX V2 Market] Refreshing materialized view...')
      await supabase.rpc('refresh_stockx_market_latest')
      console.log('[StockX V2 Market] View refreshed')
    } catch (error) {
      console.error('[StockX V2 Market] View refresh error:', error)
    }

    const duration = Date.now() - startTime
    console.log('[StockX V2 Market] Sync complete:', {
      productsProcessed,
      snapshotsCreated,
      errors,
      durationMs: duration,
    })

    return { productsProcessed, snapshotsCreated, errors }
  }
}
