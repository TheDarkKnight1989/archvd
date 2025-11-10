/**
 * Mock Market Data Adapter
 *
 * Returns seeded data from the database. No external API calls.
 * This adapter is used for development and testing before live data integration.
 *
 * Future providers (stockxAdapter.ts, aliasAdapter.ts) will follow the same
 * interface but make actual network calls to external APIs.
 */

import { createClient } from '@/lib/supabase/server'
import type { MarketDataProvider, MarketPrice, ProductInfo } from './types'

class MockMarketAdapter implements MarketDataProvider {
  name = 'mock-stockx'

  /**
   * Fetch latest prices for a SKU from seeded database
   */
  async fetchPrices(sku: string): Promise<MarketPrice[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('product_market_prices')
      .select('*')
      .eq('sku', sku.toUpperCase())
      .order('as_of', { ascending: false })

    if (error) {
      console.error('[MockAdapter] Failed to fetch prices:', error)
      return []
    }

    return (data || []).map((row) => ({
      sku: row.sku,
      size: row.size,
      price: parseFloat(row.price),
      currency: row.currency,
      source: row.source,
      as_of: new Date(row.as_of),
      meta: row.meta || {},
    }))
  }

  /**
   * Fetch product catalog info from seeded database
   */
  async fetchProduct(sku: string): Promise<ProductInfo | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('product_catalog')
      .select('*')
      .eq('sku', sku.toUpperCase())
      .single()

    if (error || !data) {
      return null
    }

    return {
      sku: data.sku,
      brand: data.brand,
      model: data.model,
      colorway: data.colorway,
      image_url: data.image_url,
      retail_price: data.retail_price ? parseFloat(data.retail_price) : undefined,
      retail_currency: data.retail_currency || 'GBP',
      release_date: data.release_date,
      slug: data.slug,
    }
  }

  /**
   * Refresh prices for multiple SKUs (for mock, just re-fetches from DB)
   * In production, this would make external API calls
   */
  async refreshPrices(skus: string[]): Promise<MarketPrice[]> {
    const allPrices: MarketPrice[] = []

    for (const sku of skus) {
      const prices = await this.fetchPrices(sku)
      allPrices.push(...prices)
    }

    return allPrices
  }

  /**
   * Health check (always available for mock)
   */
  async isAvailable(): Promise<boolean> {
    return true
  }
}

// Export singleton instance
export const mockAdapter = new MockMarketAdapter()

// Re-export types for convenience
export type { MarketDataProvider, MarketPrice, ProductInfo } from './types'
