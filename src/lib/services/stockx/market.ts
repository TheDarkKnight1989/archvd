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
