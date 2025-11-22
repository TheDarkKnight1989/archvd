/**
 * StockX Market Data Service
 * DIRECTIVE COMPLIANT: API-only operations, no database, strict validation
 *
 * Handles:
 * - V2 Market Data: GET /v2/catalog/products/{productId}/market-data
 *
 * Phase 2 Architecture: V2 API ONLY - All V1 endpoints removed
 */

import { getStockxClient } from './client'
import { isStockxMockMode } from '@/lib/config/stockx'
import { withStockxRetry } from './retry'

// ============================================================================
// DIRECTIVE SECTION 3: DATA SHAPE REQUIREMENTS
// ============================================================================

export interface StockxMarketData {
  lowestAsk: number | null
  highestBid: number | null
  salesLast72h: number | null
  volume30d: number | null
  currencyCode: string
}

// Extended market data per variant
export interface StockxVariantMarketData extends StockxMarketData {
  variantId: string
  variantValue?: string
}

// ============================================================================
// V2 API RESPONSE TYPES
// ============================================================================

interface StockxV2MarketDataVariant {
  variantId: string
  size?: string
  variantValue?: string
  lowestAskAmount?: number
  highestBidAmount?: number
  salesLast72Hours?: number
  totalVolume?: number
  averagePrice?: number
  volatility?: number
  pricePremium?: number
}

type StockxV2MarketDataResponse = StockxV2MarketDataVariant[]

// ============================================================================
// MOCK DATA GENERATORS
// ============================================================================

function generateMockMarketData(currencyCode: string): StockxMarketData {
  const basePrice = 150 + Math.random() * 200

  return {
    lowestAsk: basePrice + 20,
    highestBid: basePrice - 10,
    salesLast72h: Math.floor(Math.random() * 50),
    volume30d: Math.floor(Math.random() * 500),
    currencyCode,
  }
}

// ============================================================================
// DEV MODE LOGGING
// ============================================================================

const isDev = process.env.NODE_ENV === 'development'

function logDevRequest(endpoint: string, params?: any) {
  if (isDev) {
    console.log('[StockX Market] REQUEST:', { endpoint, params })
  }
}

function logDevResponse(endpoint: string, responseSchema: any) {
  if (isDev) {
    console.log('[StockX Market] RESPONSE SCHEMA:', {
      endpoint,
      keys: Object.keys(responseSchema),
      sample: responseSchema,
    })
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function validateV2MarketData(raw: any, source: string): void {
  if (!raw.variantId) {
    throw new Error(
      `[StockX Market] Missing required field 'variantId' from ${source}\n` +
      `Raw response: ${JSON.stringify(raw, null, 2)}`
    )
  }
}

// ============================================================================
// MARKET DATA SERVICE - V2 API ONLY
// ============================================================================

export class StockxMarketService {
  /**
   * Get V2 market data for a product (all variants)
   * API: GET /v2/catalog/products/{productId}/market-data
   * PRIMARY METHOD - Use this for all market data fetching
   */
  static async getProductMarketData(
    productId: string,
    currencyCode: string = 'GBP',
    userId?: string
  ): Promise<StockxVariantMarketData[]> {
    if (!productId) {
      throw new Error('[StockX Market] productId is required')
    }

    if (isStockxMockMode()) {
      console.log('[StockX Market] Mock mode - returning mock data')
      return [
        {
          variantId: 'mock-variant-1',
          variantValue: '10',
          ...generateMockMarketData(currencyCode),
        },
      ]
    }

    const url = `/v2/catalog/products/${productId}/market-data?currencyCode=${currencyCode}`
    logDevRequest(url, { productId, currencyCode, userId })

    try {
      const client = getStockxClient(userId)
      const response = await withStockxRetry(
        () => client.request<StockxV2MarketDataResponse>(url),
        { label: `Get market data: ${productId} (${currencyCode})` }
      )

      logDevResponse(url, response)

      // Response is an array of variants
      const variants = Array.isArray(response) ? response : []

      if (variants.length === 0) {
        console.warn('[StockX Market] No market data returned for product:', productId)
        return []
      }

      const normalized = variants.map((variant) => {
        validateV2MarketData(variant, 'getProductMarketData')
        return this.normalizeV2MarketData(variant, currencyCode)
      })

      console.log('[StockX Market] Fetched market data:', {
        productId,
        variants: normalized.length,
        currencyCode,
      })

      return normalized
    } catch (error: any) {
      if (error.message?.includes('404')) {
        throw new Error(`[StockX Market] Product not found: ${productId}`)
      }
      console.error('[StockX Market] Get product market data error:', error)
      throw error
    }
  }

  /**
   * Get market data for a specific variant
   * Convenience wrapper around getProductMarketData
   */
  static async getVariantMarketData(
    productId: string,
    variantId: string,
    currencyCode: string = 'USD',
    userId?: string
  ): Promise<StockxMarketData> {
    if (!variantId) {
      throw new Error('[StockX Market] variantId is required')
    }

    const allVariants = await this.getProductMarketData(productId, currencyCode, userId)

    const variant = allVariants.find((v) => v.variantId === variantId)

    if (!variant) {
      throw new Error(
        `[StockX Market] Variant ${variantId} not found in market data for product ${productId}`
      )
    }

    return {
      lowestAsk: variant.lowestAsk,
      highestBid: variant.highestBid,
      salesLast72h: variant.salesLast72h,
      volume30d: variant.volume30d,
      currencyCode: variant.currencyCode,
    }
  }

  /**
   * Normalize V2 market data variant to directive-compliant shape
   */
  private static normalizeV2MarketData(
    raw: StockxV2MarketDataVariant,
    currencyCode: string
  ): StockxVariantMarketData {
    return {
      variantId: raw.variantId,
      variantValue: raw.variantValue || raw.size,
      lowestAsk: raw.lowestAskAmount ?? null,
      highestBid: raw.highestBidAmount ?? null,
      salesLast72h: raw.salesLast72Hours ?? null,
      volume30d: raw.totalVolume ?? null,
      currencyCode,
    }
  }

  /**
   * Batch get market data for multiple products
   * Uses V2 API for optimal performance
   */
  static async batchGetMarketData(
    productIds: string[],
    currencyCode: string = 'USD',
    userId?: string
  ): Promise<Map<string, StockxVariantMarketData[]>> {
    if (!productIds || productIds.length === 0) {
      throw new Error('[StockX Market] productIds array is required and cannot be empty')
    }

    console.log('[StockX Market] Batch fetching market data:', {
      count: productIds.length,
      currencyCode,
    })

    const results = new Map<string, StockxVariantMarketData[]>()

    // Fetch in parallel with error handling per product
    const promises = productIds.map(async (productId) => {
      try {
        const data = await this.getProductMarketData(productId, currencyCode, userId)
        results.set(productId, data)
      } catch (error: any) {
        console.warn(`[StockX Market] Failed to fetch market data for ${productId}:`, error.message)
        results.set(productId, [])
      }
    })

    await Promise.all(promises)

    console.log('[StockX Market] Batch fetch complete:', {
      requested: productIds.length,
      successful: Array.from(results.values()).filter((v) => v.length > 0).length,
    })

    return results
  }
}
