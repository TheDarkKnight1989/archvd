/**
 * Unified Product Data Types
 *
 * Single source of truth for product display across all tables
 * (Inventory, Sales, P&L, Watchlists, Activity)
 */

export type Provider = 'stockx' | 'alias' | 'ebay' | 'seed'

export type SizeSystem = 'UK' | 'US' | 'EU' | 'JP'

export type ProductSizes = {
  uk?: string | null
  us?: string | null
  eu?: string | null
  jp?: string | null
}

export type ProductInfo = {
  brand: string
  model: string
  sku: string
  imageUrl?: string | null
  providerUrl?: string | null
  size?: ProductSizes
  colorway?: string | null
  category?: string | null
}

export type PurchaseAmounts = {
  buy?: number | null
  tax?: number | null
  ship?: number | null
  total?: number | null
}

export type MarketData = {
  price?: number | null
  provider?: Provider | null
  asOf?: string | null
  delta7d?: number | null // percentage change over 7 days
  series7d?: (number | null)[] // 7-day price series for sparkline
}

export type SalesData = {
  sold?: number | null
  commission?: number | null
  netPayout?: number | null
  soldDate?: string | null
  platform?: string | null
  margin?: number | null
  marginPercent?: number | null
}

/**
 * EnrichedLineItem - Unified data contract for all product tables
 *
 * Usage:
 * - Inventory: id, product, purchaseDate, amounts, market, status
 * - Sales: id, product, amounts, sales
 * - P&L: id, product, amounts, sales
 * - Watchlists: id, product, market
 */
export type EnrichedLineItem = {
  id: string
  product: ProductInfo
  purchaseDate?: string | null
  amounts?: PurchaseAmounts
  market?: MarketData
  sales?: SalesData
  status?: string | null

  // Additional fields for compatibility
  notes?: string | null
  location?: string | null
  tags?: string[] | null
}

/**
 * Provenance display info for market prices
 */
export type ProvenanceInfo = {
  provider: Provider
  displayName: string // "StockX", "Alias", etc.
  timestamp: string // ISO timestamp
  relativeTime: string // "2 hours ago"
  icon?: string // Optional icon identifier
}
