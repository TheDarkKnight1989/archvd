/**
 * Market Data Providers
 *
 * Exports all market data adapters and a factory function to get the active provider.
 */

import { mockAdapter } from './mockAdapter'
import { stockxAdapter } from './stockxAdapter'
import { aliasAdapter } from './aliasAdapter'

export { mockAdapter, stockxAdapter, aliasAdapter }
export type { MarketDataProvider, MarketPrice, ProductInfo } from './types'

/**
 * Get the active market data provider based on environment configuration
 *
 * For now, always returns mock adapter. In the future, this will read from
 * NEXT_PUBLIC_MARKET_PROVIDER environment variable.
 */
export function getMarketProvider() {
  const provider = process.env.NEXT_PUBLIC_MARKET_PROVIDER || 'mock'

  switch (provider) {
    case 'stockx':
      return stockxAdapter
    case 'alias':
      return aliasAdapter
    case 'mock':
    default:
      return mockAdapter
  }
}
