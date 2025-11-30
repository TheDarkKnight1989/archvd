/**
 * StockX Market Data Adapter
 *
 * Fetches live pricing data from StockX API using existing services.
 * Uses catalog and market services for product search and pricing.
 */

import type { MarketDataProvider, MarketPrice, ProductInfo } from './types'
import { getCatalogService } from '@/lib/services/stockx/catalog'
import { StockxMarketService } from '@/lib/services/stockx/market'
import { isStockxEnabled, isStockxMockMode } from '@/lib/config/stockx'

class StockXAdapter implements MarketDataProvider {
  name = 'stockx'

  /**
   * Fetch latest prices for a given SKU across all sizes
   */
  async fetchPrices(sku: string): Promise<MarketPrice[]> {
    try {
      const catalogService = getCatalogService()
      const marketService = new StockxMarketService()

      // Search for product by SKU
      const products = await catalogService.searchProducts(sku, { limit: 1 })

      if (!products || products.length === 0) {
        console.warn('[StockX Adapter] Product not found for SKU:', sku)
        return []
      }

      const product = products[0]

      // Fetch market data for all variants (sizes)
      const marketData = await marketService.fetchProductMarketData(
        product.productId,
        'GBP' // Default to GBP, could be parameterized
      )

      if (!marketData || marketData.length === 0) {
        return []
      }

      // Transform to MarketPrice[] format
      const prices: MarketPrice[] = marketData.map((data) => ({
        sku: product.styleId,
        size: data.variantValue,
        price: data.lowestAsk || data.highestBid || 0,
        currency: data.currencyCode,
        source: 'stockx',
        as_of: new Date(),
        meta: {
          lowestAsk: data.lowestAsk,
          highestBid: data.highestBid,
          salesLast72h: data.salesLast72h,
          volume30d: data.volume30d,
        },
      }))

      return prices
    } catch (error) {
      console.error('[StockX Adapter] Error fetching prices:', error)
      throw error
    }
  }

  /**
   * Fetch product catalog info by SKU
   */
  async fetchProduct(sku: string): Promise<ProductInfo | null> {
    try {
      const catalogService = getCatalogService()

      // Search for product by SKU
      const products = await catalogService.searchProducts(sku, { limit: 1 })

      if (!products || products.length === 0) {
        return null
      }

      const product = products[0]

      // Transform to ProductInfo format
      const productInfo: ProductInfo = {
        sku: product.styleId,
        brand: product.brand,
        model: product.productName,
        colorway: product.colorway,
        image_url: product.image || undefined,
        retail_price: product.retailPrice,
        retail_currency: 'USD', // StockX typically uses USD for retail prices
        release_date: product.releaseDate,
      }

      return productInfo
    } catch (error) {
      console.error('[StockX Adapter] Error fetching product:', error)
      return null
    }
  }

  /**
   * Refresh prices for multiple SKUs
   * Note: Implements rate limiting to avoid API throttling
   */
  async refreshPrices(skus: string[]): Promise<MarketPrice[]> {
    const allPrices: MarketPrice[] = []

    // Process SKUs with rate limiting (100ms delay between requests)
    for (const sku of skus) {
      try {
        const prices = await this.fetchPrices(sku)
        allPrices.push(...prices)

        // Rate limiting delay
        if (skus.indexOf(sku) < skus.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      } catch (error) {
        console.error(`[StockX Adapter] Failed to fetch prices for SKU ${sku}:`, error)
        // Continue with next SKU
      }
    }

    return allPrices
  }

  /**
   * Health check for StockX API availability
   */
  async isAvailable(): Promise<boolean> {
    // Check if StockX is enabled and not in mock mode
    if (!isStockxEnabled() || isStockxMockMode()) {
      return false
    }

    try {
      // Simple availability check - try to get catalog service
      const catalogService = getCatalogService()
      return !!catalogService
    } catch (error) {
      console.error('[StockX Adapter] Availability check failed:', error)
      return false
    }
  }
}

export const stockxAdapter = new StockXAdapter()
