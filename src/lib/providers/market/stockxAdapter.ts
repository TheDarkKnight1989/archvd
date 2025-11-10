/**
 * StockX Market Data Adapter (Placeholder)
 *
 * Future implementation will fetch live pricing data from StockX API.
 * DO NOT IMPLEMENT NETWORK CALLS YET - this is a stub for future work.
 *
 * When implementing:
 * 1. Add STOCKX_API_KEY to environment variables
 * 2. Implement fetchPrices() to call StockX product search API
 * 3. Parse response and transform to MarketPrice[] format
 * 4. Handle rate limiting and errors gracefully
 * 5. Update isAvailable() to ping StockX health endpoint
 */

import type { MarketDataProvider, MarketPrice, ProductInfo } from './types'

class StockXAdapter implements MarketDataProvider {
  name = 'stockx'

  async fetchPrices(sku: string): Promise<MarketPrice[]> {
    throw new Error('StockX adapter not yet implemented')
  }

  async fetchProduct(sku: string): Promise<ProductInfo | null> {
    throw new Error('StockX adapter not yet implemented')
  }

  async refreshPrices(skus: string[]): Promise<MarketPrice[]> {
    throw new Error('StockX adapter not yet implemented')
  }

  async isAvailable(): Promise<boolean> {
    return false
  }
}

export const stockxAdapter = new StockXAdapter()
