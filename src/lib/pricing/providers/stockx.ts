// StockX pricing provider (Official v2 API)
// Uses official StockX v2 API endpoints with proper authentication

import type { PriceData, ProductInfo } from '../types'
import { getStockxClient } from '@/lib/services/stockx/client'
import { isStockxEnabled } from '@/lib/config/stockx'

/**
 * Lookup product by SKU on StockX using official v2 API
 * Returns product info and pricing data
 */
export async function lookupBySKU(sku: string, currency: string = 'USD'): Promise<{
  product?: ProductInfo
  price?: PriceData
}> {
  try {
    // Check if StockX is enabled
    if (!isStockxEnabled()) {
      console.log('[StockX] Integration not enabled')
      return {}
    }

    const client = getStockxClient()

    // Step 1: Search for product by SKU using official v2 catalog API
    let searchUrl = `/v2/catalog/search?query=${encodeURIComponent(sku)}`
    if (currency) {
      searchUrl += `&currencyCode=${currency}`
    }
    const searchResponse = await client.request<any>(searchUrl)

    if (!searchResponse?.products || searchResponse.products.length === 0) {
      console.log(`[StockX] No products found for SKU: ${sku}`)
      return {}
    }

    // Find exact SKU match
    const exactMatch = searchResponse.products.find((p: any) =>
      p.styleId?.toLowerCase() === sku.toLowerCase()
    )

    const product = exactMatch || searchResponse.products[0]

    // Extract product info
    const productInfo: ProductInfo = {
      sku: product.styleId || sku,
      name: product.title || product.name,
      brand: product.brand,
      image_url: product.media?.imageUrl || product.media?.thumbUrl,
      retail_price: product.retailPrice,
    }

    // Step 2: Get market data for the product using official v2 catalog API
    try {
      const marketResponse = await client.request<any>(
        `/v2/catalog/products/${product.productId}/market-data?currencyCode=${currency}`
      )

      // Market-data endpoint returns an array of variants
      const variants = Array.isArray(marketResponse) ? marketResponse : []

      if (variants.length === 0) {
        console.log(`[StockX] No market data available for SKU: ${sku}`)
        return { product: productInfo }
      }

      // Calculate average market price across all sizes that have data
      // Filter out variants without pricing data
      const validVariants = variants.filter((v: any) => v.lowestAskAmount)

      if (validVariants.length === 0) {
        console.log(`[StockX] No market price available for SKU: ${sku}`)
        return { product: productInfo }
      }

      // Use average lowestAsk across all sizes
      const avgLowestAsk = validVariants
        .filter((v: any) => v.lowestAskAmount)
        .reduce((sum: number, v: any) => sum + v.lowestAskAmount, 0) / validVariants.filter((v: any) => v.lowestAskAmount).length

      const marketPrice = avgLowestAsk

      if (!marketPrice) {
        console.log(`[StockX] No market price available for SKU: ${sku}`)
        return { product: productInfo }
      }

      const priceData: PriceData = {
        provider: 'stockx',
        price: marketPrice,
        currency: currency,
        timestamp: new Date(),
        confidence: 'high',
        url: `https://stockx.com/${product.urlKey || product.productId}`,
      }

      return {
        product: productInfo,
        price: priceData,
      }
    } catch (marketError: any) {
      console.warn('[StockX] Market data fetch failed:', marketError.message)
      // Return product info even if market data fails
      return { product: productInfo }
    }
  } catch (error: any) {
    console.error('[StockX] Lookup error:', error.message)
    return {}
  }
}

/**
 * Batch lookup multiple SKUs (with rate limiting)
 * Uses official v2 API with proper rate limiting
 */
export async function batchLookup(
  skus: string[],
  currency: string = 'USD'
): Promise<Map<string, {
  product?: ProductInfo
  price?: PriceData
}>> {
  const results = new Map()

  // Rate limit: 100ms between requests to avoid overwhelming StockX
  for (const sku of skus) {
    const result = await lookupBySKU(sku, currency)
    results.set(sku, result)

    // Wait 100ms between requests
    if (skus.indexOf(sku) < skus.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return results
}
