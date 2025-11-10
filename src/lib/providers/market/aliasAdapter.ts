/**
 * Alias Market Data Adapter (Placeholder)
 *
 * Future implementation will fetch live pricing data from Alias (Laced/Klekt).
 * DO NOT IMPLEMENT NETWORK CALLS YET - this is a stub for future work.
 *
 * When implementing:
 * 1. Add ALIAS_API_KEY to environment variables
 * 2. Implement fetchPrices() to call Alias product API
 * 3. Parse response and transform to MarketPrice[] format
 * 4. Handle rate limiting and errors gracefully
 * 5. Update isAvailable() to ping Alias health endpoint
 */

import type { MarketDataProvider, MarketPrice, ProductInfo } from './types'

class AliasAdapter implements MarketDataProvider {
  name = 'alias'

  async fetchPrices(sku: string): Promise<MarketPrice[]> {
    throw new Error('Alias adapter not yet implemented')
  }

  async fetchProduct(sku: string): Promise<ProductInfo | null> {
    throw new Error('Alias adapter not yet implemented')
  }

  async refreshPrices(skus: string[]): Promise<MarketPrice[]> {
    throw new Error('Alias adapter not yet implemented')
  }

  async isAvailable(): Promise<boolean> {
    return false
  }
}

export const aliasAdapter = new AliasAdapter()
