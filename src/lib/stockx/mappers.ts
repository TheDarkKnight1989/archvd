/**
 * StockX API Mappers
 *
 * Converts raw StockX API responses to normalized domain types.
 * This is the ONLY place where raw API field names should be referenced.
 */

import type {
  StockxRawProduct,
  StockxRawVariant,
  StockxRawMarketDataItem,
  StockxRawListing,
  StockxRawListingCreated,
  StockxRawSearchResponse,
  StockxProduct,
  StockxVariant,
  StockxMarketData,
  StockxListing,
  StockxListingCreated,
  StockxSearchResult,
} from './types'

// ============================================================================
// CATALOG MAPPERS
// ============================================================================

/**
 * Map raw search response to domain type
 */
export function mapSearchResponse(raw: StockxRawSearchResponse): StockxSearchResult {
  return {
    products: raw.products.map(mapRawProductToDomain),
    totalResults: raw.totalResults || raw.products.length,
    pageSize: raw.pageSize || raw.products.length,
    page: raw.page || 1,
  }
}

/**
 * Map raw product to domain product
 *
 * Field mappings:
 * - styleId → styleId (SKU/style code)
 * - productId → productId (UUID)
 * - productAttributes.* → top-level fields
 */
export function mapRawProductToDomain(raw: StockxRawProduct): StockxProduct {
  return {
    productId: raw.productId,
    styleId: raw.styleId, // This is the SKU
    title: raw.title,
    brand: raw.brand,
    description: raw.productAttributes?.colorway,
    colorway: raw.productAttributes?.colorway,
    retailPrice: raw.productAttributes?.retailPrice,
    releaseDate: raw.productAttributes?.releaseDate,
    imageUrl: raw.media?.imageUrl || raw.media?.smallImageUrl,
    thumbUrl: raw.media?.thumbUrl || raw.media?.smallImageUrl,
    category: raw.productAttributes?.category,
    gender: raw.productAttributes?.gender,
  }
}

/**
 * Map raw variant to domain variant
 *
 * Field mappings:
 * - variantId → variantId
 * - variantValue → variantValue (size display, e.g., "10.5")
 * - size → variantValue (fallback)
 */
export function mapRawVariantToDomain(raw: StockxRawVariant): StockxVariant {
  return {
    variantId: raw.variantId,
    productId: raw.productId,
    variantValue: raw.variantValue || raw.size || '',
    gtins: raw.gtins,
    hidden: raw.hidden,
  }
}

/**
 * Map raw market data item to domain market data
 *
 * Field mappings:
 * - lowestAskAmount → lowestAsk
 * - highestBidAmount → highestBid
 */
export function mapRawMarketDataToDomain(
  raw: StockxRawMarketDataItem,
  currencyCode: string
): StockxMarketData {
  return {
    productId: raw.productId || '',
    variantId: raw.variantId,
    currencyCode,
    salesLast72Hours: raw.salesLast72Hours,
    totalSalesVolume: raw.totalSalesVolume,
    lowestAsk: raw.lowestAskAmount,
    highestBid: raw.highestBidAmount,
    averageDeadstockPrice: raw.averageDeadstockPrice,
    volatility: raw.volatility,
    pricePremium: raw.pricePremium,
  }
}

// ============================================================================
// LISTING MAPPERS
// ============================================================================

/**
 * Map raw listing to domain listing
 *
 * Field mappings:
 * - amountCents → amount (convert cents to currency units)
 */
export function mapRawListingToDomain(raw: StockxRawListing): StockxListing {
  return {
    listingId: raw.listingId,
    productId: raw.productId,
    variantId: raw.variantId,
    amount: raw.amountCents, // Keep in cents for now, convert in UI
    currencyCode: raw.currencyCode,
    status: raw.status as any, // Type assertion for status
    expiresAt: raw.expiresAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

/**
 * Map raw listing creation response to domain type
 */
export function mapRawListingCreatedToDomain(raw: StockxRawListingCreated): StockxListingCreated {
  return {
    listingId: raw.listingId,
    productId: raw.productId,
    variantId: raw.variantId,
    amount: raw.amountCents,
    currencyCode: raw.currencyCode,
    status: raw.status,
    createdAt: raw.createdAt,
    expiresAt: raw.expiresAt,
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find product by SKU in search results
 *
 * This is a commonly needed operation when searching by style code
 */
export function findProductByStyleId(
  searchResponse: StockxRawSearchResponse,
  styleId: string
): StockxRawProduct | null {
  const product = searchResponse.products.find((p) => p.styleId === styleId)
  return product || null
}

/**
 * Resolve exact variant - NO FALLBACKS allowed
 *
 * This enforces strict (product, variant) matching.
 * If no exact match is found, returns null.
 *
 * @param variants - Array of variants to search
 * @param targetVariantId - Explicit variant ID from mapping (preferred)
 * @param targetSizeLabel - Size label to match (optional fallback)
 * @returns The exact variant or null
 */
export function resolveExactVariant(
  variants: StockxVariant[],
  targetVariantId?: string | null,
  targetSizeLabel?: string | null
): StockxVariant | null {
  // 1) Prefer explicit variantId from mapping
  if (targetVariantId) {
    const byId = variants.find((v) => v.variantId === targetVariantId)
    if (byId) return byId
  }

  // 2) Optional: match by size label if we are *sure* it's identical
  if (targetSizeLabel) {
    const bySize = variants.find((v) => v.variantValue === targetSizeLabel)
    if (bySize) return bySize
  }

  // 3) OTHERWISE: NO MATCH
  return null
}

/**
 * Find variant by size value in variants array
 * @deprecated Use resolveExactVariant instead for strict matching
 */
export function findVariantBySize(
  variants: StockxRawVariant[],
  size: string
): StockxRawVariant | null {
  const variant = variants.find(
    (v) =>
      v.variantValue === size ||
      v.size === size ||
      v.variantValue === `US ${size}` ||
      v.variantValue === `M ${size}` ||
      v.size === `US ${size}` ||
      v.size === `M ${size}`
  )
  return variant || null
}

/**
 * Find market data by variant ID
 */
export function findMarketDataByVariantId(
  marketDataArray: StockxRawMarketDataItem[],
  variantId: string
): StockxRawMarketDataItem | null {
  const data = marketDataArray.find((m) => m.variantId === variantId)
  return data || null
}
