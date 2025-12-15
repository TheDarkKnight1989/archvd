/**
 * V4 → V3 Adapter
 *
 * TEMPORARY BRIDGE: This adapter allows the inventory page to use V4 data
 * while downstream components (tables, cells, mobile cards) still expect
 * V3 EnrichedLineItem types.
 *
 * @deprecated This adapter will be removed once all consumers migrate to V4 types.
 *             Timeline: Phase 2 of V4 migration
 *
 * CRITICAL: Do NOT modify this file to add new V3 features.
 *           All new features should use V4 types directly.
 *
 * Source of Truth:
 * - `inventory_v4_listings` is the ONLY source of listing state
 * - V3 `stockx.listingStatus` is derived from V4 listing, not from legacy tables
 */

import type { EnrichedLineItem } from '@/lib/portfolio/types'
import type {
  InventoryV4ItemFull,
  InventoryV4Listing,
  ListingStatus,
} from './types'

/**
 * Map V4 listing status to V3 legacy format
 *
 * V4 status (lowercase): 'active' | 'paused' | 'sold' | 'expired' | 'cancelled'
 * V3 status (uppercase): 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'CANCELLED' | 'SOLD'
 *
 * @deprecated Use V4 listing.status directly in new code
 */
function mapV4StatusToV3(
  v4Status: ListingStatus
): 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'CANCELLED' | 'SOLD' {
  switch (v4Status) {
    case 'active':
      return 'ACTIVE'
    case 'paused':
      return 'INACTIVE'
    case 'sold':
      return 'SOLD'
    case 'expired':
    case 'cancelled':
      return 'CANCELLED'
    default:
      return 'INACTIVE'
  }
}

/**
 * Extract the StockX listing from V4 listings array
 *
 * Finds the first StockX listing that is active or paused (actionable states).
 * Returns null if no such listing exists.
 */
export function getStockxListing(
  listings: InventoryV4Listing[]
): InventoryV4Listing | null {
  return (
    listings.find(
      (l) =>
        l.platform === 'stockx' &&
        (l.status === 'active' || l.status === 'paused')
    ) ?? null
  )
}

/**
 * Extract the Alias listing from V4 listings array
 */
export function getAliasListing(
  listings: InventoryV4Listing[]
): InventoryV4Listing | null {
  return (
    listings.find(
      (l) =>
        l.platform === 'alias' &&
        (l.status === 'active' || l.status === 'paused')
    ) ?? null
  )
}

/**
 * Adapt a V4 inventory item to V3 EnrichedLineItem format
 *
 * @deprecated This function bridges V4 data to V3 consumers.
 *             Migrate consumers to use InventoryV4ItemFull directly.
 *
 * Key mappings:
 * - V4 `style` → V3 brand/model/colorway/sku
 * - V4 `purchase_price` → V3 invested/avgCost
 * - V4 `listings` → V3 stockx.listingId/listingStatus
 * - V4 `marketData` → V3 market/instantSell/pl/performancePct
 */
export function adaptV4ItemToEnrichedLineItem(
  v4Item: InventoryV4ItemFull
): EnrichedLineItem {
  const { style, marketData, listings } = v4Item

  // Extract StockX listing (if any)
  const stockxListing = getStockxListing(listings)

  // Extract Alias listing (if any)
  const aliasListing = getAliasListing(listings)

  // Compute invested (V3 combines purchase_price + tax + shipping)
  // V4 stores only purchase_price; tax/shipping are separate or not tracked
  const invested = v4Item.purchase_price ?? 0

  // Market price from V4 pricing module
  const marketPrice = marketData?.bestNetProceeds ?? null
  // Correct path: ArchvdPriceWithFees.inputs contains ask prices in user currency
  const lowestAsk = marketData?.inputs?.stockxAsk ?? marketData?.inputs?.aliasAsk ?? null

  // P/L calculations
  const total = marketPrice ?? 0
  const pl = invested > 0 && marketPrice !== null ? marketPrice - invested : null
  const performancePct =
    invested > 0 && pl !== null ? (pl / invested) * 100 : null

  // Build the EnrichedLineItem
  const enriched: EnrichedLineItem = {
    id: v4Item.id,
    brand: style?.brand ?? '',
    model: style?.name ?? '',
    colorway: style?.colorway ?? null,
    sku: v4Item.style_id, // style_id IS the SKU in V4
    size_uk: v4Item.size, // V4 stores as string, V3 expects string|number

    // Image from style catalog
    image: {
      url: style?.primary_image_url ?? '',
      alt: `${style?.brand ?? ''} ${style?.name ?? ''}`.trim(),
    },
    imageSource: style?.primary_image_url ? 'catalog' : null,

    // Legacy image fields for backwards compatibility
    alias_image_url: null, // V4 doesn't track separately
    image_url: style?.primary_image_url ?? null,

    // Purchase info
    purchaseDate: v4Item.purchase_date,
    created_at: v4Item.created_at,
    qty: 1, // V4 tracks individual items, no quantity
    invested,
    avgCost: invested,

    // Market data from pricing module
    market: {
      price: marketPrice,
      lowestAsk,
      currency: (marketData?.currency as 'GBP' | 'EUR' | 'USD') ?? 'GBP',
      provider: marketData?.bestPlatformToSell ?? null,
      updatedAt: null, // V4 doesn't track this per-item
      spark30d: [], // Historical data not in V4 item
    },

    // Instant sell data
    // Correct path: ArchvdPriceWithFees.bids contains bid prices in user currency
    instantSell: {
      gross: marketData?.bids?.stockxBid ?? marketData?.bids?.aliasBid ?? null,
      net: marketData?.bestBidNetProceeds ?? null,
      currency: (marketData?.currency as 'GBP' | 'EUR' | 'USD') ?? 'GBP',
      provider: marketData?.bestBidPlatform ?? null,
      updatedAt: null,
      feePct: 0.125, // Default StockX seller fee
    },

    // Computed P/L
    total,
    pl,
    performancePct,

    // Links
    links: {
      productUrl: style?.stockx_url_key
        ? `https://stockx.com/${style.stockx_url_key}`
        : null,
    },

    // Status mapping: V4 physical status → V3 display status
    // Note: V3 'listed' status is WRONG - listing state comes from listings table
    status: mapV4PhysicalStatusToV3(v4Item.status),
    category: 'sneaker', // V4 doesn't have category on items yet

    // StockX data - DERIVED FROM V4 LISTINGS (source of truth)
    // Correct path: ArchvdPriceWithFees.inputs.stockxAsk and .bids.stockxBid
    stockx: {
      mapped: !!style?.stockx_product_id,
      productId: style?.stockx_product_id ?? null,
      variantId: null, // V4 doesn't store variant ID on items
      listingId: stockxListing?.external_listing_id ?? null,
      listingStatus: stockxListing
        ? mapV4StatusToV3(stockxListing.status)
        : null,
      askPrice: stockxListing?.listed_price ?? null,
      expiresAt: null, // Not tracked in V4
      lowestAsk: marketData?.inputs?.stockxAsk ?? null,
      highestBid: marketData?.bids?.stockxBid ?? null,
      mappingStatus: style?.stockx_product_id ? 'ok' : 'unmapped',
      lastSyncSuccessAt: null, // Not tracked per-item in V4
      lastSyncError: null,
    },

    // Alias data - DERIVED FROM V4 LISTINGS (source of truth)
    // NOTE: Alias values are stored in USD (ORIGINAL), not converted to user currency
    // The table component expects USD and sets displayCurrency='USD' explicitly
    alias: {
      mapped: !!style?.alias_catalog_id,
      catalogId: style?.alias_catalog_id ?? null,
      listingId: aliasListing?.external_listing_id ?? null,
      listingStatus: aliasListing
        ? mapV4AliasStatusToV3(aliasListing.status)
        : null,
      askPrice: aliasListing?.listed_price ?? null,
      lowestAsk: marketData?.inputs?.aliasAskOriginal ?? null,
      highestBid: marketData?.bids?.aliasBidOriginal ?? null,
      lastSoldPrice: marketData?.aliasExtended?.lastSalePrice ?? null,
      globalIndicatorPrice: null,
      mappingStatus: style?.alias_catalog_id ? 'ok' : 'unmapped',
      lastSyncSuccessAt: null,
      lastSyncError: null,
    },

    // V4 transition fields - populated for backwards compatibility
    // These are typed in EnrichedLineItem as deprecated fields
    stockx_product_id: style?.stockx_product_id ?? null,
    alias_catalog_id: style?.alias_catalog_id ?? null,
    // V4 listings for RowActions (source of truth)
    _v4StockxListing: stockxListing,
    _v4AliasListing: aliasListing,
  }

  return enriched
}

/**
 * Map V4 physical item status to V3 display status
 *
 * V4 status: 'in_stock' | 'consigned' | 'sold' | 'removed'
 * V3 status: 'active' | 'listed' | 'worn' | 'sold' | 'archived'
 *
 * Note: V3 'listed' is DEPRECATED - listing state comes from listings table
 */
function mapV4PhysicalStatusToV3(
  v4Status: string
): 'active' | 'listed' | 'worn' | 'sold' | 'archived' {
  switch (v4Status) {
    case 'in_stock':
      return 'active'
    case 'consigned':
      return 'active' // Consigned items are still "active" in V3 terms
    case 'sold':
      return 'sold'
    case 'removed':
      return 'archived'
    default:
      return 'active'
  }
}

/**
 * Map V4 Alias listing status to V3 format
 */
function mapV4AliasStatusToV3(
  v4Status: ListingStatus
):
  | 'LISTING_STATUS_ACTIVE'
  | 'LISTING_STATUS_INACTIVE'
  | 'LISTING_STATUS_PENDING'
  | 'LISTING_STATUS_SOLD'
  | null {
  switch (v4Status) {
    case 'active':
      return 'LISTING_STATUS_ACTIVE'
    case 'paused':
      return 'LISTING_STATUS_INACTIVE'
    case 'sold':
      return 'LISTING_STATUS_SOLD'
    default:
      return null
  }
}

/**
 * Batch adapt multiple V4 items to V3 format
 *
 * @deprecated Use V4 items directly in new code
 */
export function adaptV4ItemsToEnrichedLineItems(
  v4Items: InventoryV4ItemFull[]
): EnrichedLineItem[] {
  return v4Items.map(adaptV4ItemToEnrichedLineItem)
}
