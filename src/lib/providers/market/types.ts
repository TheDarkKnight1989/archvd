/**
 * Market Data Provider Types
 *
 * Base types for market data providers (mock, StockX, Alias, etc.)
 */

export interface MarketPrice {
  sku: string
  size: string
  price: number
  currency: string
  source: string
  as_of: Date
  meta?: Record<string, any>
}

export interface ProductInfo {
  sku: string
  brand: string
  model: string
  colorway?: string
  image_url?: string
  retail_price?: number
  retail_currency?: string
  release_date?: string
  slug?: string
}

export interface MarketDataProvider {
  name: string

  /**
   * Fetch latest prices for a given SKU
   */
  fetchPrices(sku: string): Promise<MarketPrice[]>

  /**
   * Fetch product catalog info
   */
  fetchProduct(sku: string): Promise<ProductInfo | null>

  /**
   * Refresh prices for multiple SKUs
   */
  refreshPrices(skus: string[]): Promise<MarketPrice[]>

  /**
   * Health check for provider availability
   */
  isAvailable(): Promise<boolean>
}
