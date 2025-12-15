/**
 * StockX Listing Modal Adapter
 *
 * Transforms V4 inventory items into the shape expected by ListOnStockXModal.
 * This is the single point of truth for modal data - stops any `item: any` usage.
 */

import type { Currency } from '@/lib/pricing-v4/types'
import type {
  InventoryV4ItemFull,
  InventoryV4Listing,
  ListingPlatform,
} from './types'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Existing StockX listing for reprice mode
 */
export interface ExistingStockXListing {
  /** Internal listing UUID (inventory_v4_listings.id) */
  id: string
  /** StockX's listing ID for API calls */
  external_listing_id: string
  /** Current listed price */
  listed_price: number
  /** Currency of the listing */
  listed_currency: Currency
  /** Listing status */
  status: 'active' | 'paused'
}

/**
 * StockX listing modal item - the ONLY shape the modal should accept.
 *
 * This replaces `item: any` in the modal props.
 */
export interface StockXListingModalItem {
  // === Identity ===
  /** Inventory item UUID (inventory_v4_items.id) */
  id: string
  /** User UUID for ownership */
  user_id: string
  /** SKU (style_id from style catalog) */
  sku: string

  // === Display ===
  brand: string
  name: string
  colorway: string | null
  /** Canonical image URL (from style catalog) */
  imageUrl: string | null
  /** Display size (e.g., "10", "10.5") */
  size: string
  /** Size unit for display (e.g., "UK", "US") */
  sizeUnit: string

  // === Cost basis for P/L ===
  /** Purchase price in major units (e.g., 120.50) */
  purchasePrice: number | null
  /** Currency of purchase price */
  purchaseCurrency: Currency

  // === Market data ===
  /** Lowest ask from StockX market data (in stockxCurrency) */
  lowestAsk: number | null
  /** Highest bid from StockX market data (in stockxCurrency) */
  highestBid: number | null
  /** Last sale price */
  lastSale: number | null
  /** Sales in last 72 hours */
  salesLast72h: number | null

  // === Currency handling ===
  /**
   * StockX market data currency (for API calls).
   * This is the currency StockX uses for this item's market.
   * Usually GBP for UK users, but could be EUR/USD.
   */
  stockxCurrency: Currency
  /**
   * Display currency (user's preferred currency).
   * Used for formatting prices in the UI.
   */
  displayCurrency: Currency

  // === StockX mapping ===
  /** Whether item has valid StockX mapping */
  hasStockxMapping: boolean
  /** StockX product ID (for API calls) */
  stockxProductId: string | null
  /** StockX variant ID (for API calls) */
  stockxVariantId: string | null

  // === Existing listing (determines create vs reprice mode) ===
  /**
   * If defined, modal is in REPRICE mode.
   * If undefined, modal is in CREATE mode.
   */
  existingListing?: ExistingStockXListing
}

// =============================================================================
// ADAPTER FUNCTION
// =============================================================================

/**
 * Transform a V4 enriched item into StockXListingModalItem.
 *
 * @param v4Item - Full inventory item from useInventoryV4
 * @param userCurrency - User's preferred display currency
 * @returns Modal-ready item, or null if item can't be listed (no style catalog)
 */
export function toStockXListingModalItem(
  v4Item: InventoryV4ItemFull,
  userCurrency: Currency = 'GBP'
): StockXListingModalItem | null {
  // Require style catalog for display
  if (!v4Item.style) {
    console.warn(
      '[toStockXListingModalItem] Item missing style catalog:',
      v4Item.id
    )
    return null
  }

  const style = v4Item.style

  // Find existing active/paused StockX listing
  const existingStockxListing = v4Item.listings.find(
    (l) =>
      l.platform === 'stockx' && (l.status === 'active' || l.status === 'paused')
  )

  // Extract market data from marketData (calculated by pricing-v4)
  // marketData is ArchvdPriceWithFees which has inputs.stockxAsk, bids.stockxBid
  const marketData = v4Item.marketData

  // Determine StockX currency - marketData.currency is user's currency
  // For API calls, we typically use GBP for UK users
  const stockxCurrency: Currency = marketData?.currency ?? 'GBP'

  // Check if we have StockX data available
  const hasStockxData = marketData?.inputs?.stockxAsk !== null

  // Build the modal item
  const modalItem: StockXListingModalItem = {
    // Identity
    id: v4Item.id,
    user_id: v4Item.user_id,
    sku: v4Item.style_id,

    // Display
    brand: style.brand ?? 'Unknown',
    name: style.name ?? style.nickname ?? v4Item.style_id,
    colorway: style.colorway,
    imageUrl: style.primary_image_url,
    size: v4Item.size,
    sizeUnit: v4Item.size_unit,

    // Cost basis
    purchasePrice: v4Item.purchase_price,
    purchaseCurrency: v4Item.purchase_currency,

    // Market data (from ArchvdPriceWithFees.inputs and .bids)
    lowestAsk: marketData?.inputs?.stockxAsk ?? null,
    highestBid: marketData?.bids?.stockxBid ?? null,
    lastSale: null, // Not currently in marketData, could add if needed
    salesLast72h: null, // Not currently in marketData, could add if needed

    // Currency
    stockxCurrency,
    displayCurrency: userCurrency,

    // StockX mapping
    hasStockxMapping: !!(style.stockx_product_id && hasStockxData),
    stockxProductId: style.stockx_product_id,
    stockxVariantId: marketData?.variantIds?.stockxVariantId ?? null,

    // Existing listing (for reprice mode)
    existingListing: existingStockxListing
      ? {
          id: existingStockxListing.id,
          external_listing_id: existingStockxListing.external_listing_id ?? '',
          listed_price: existingStockxListing.listed_price,
          listed_currency: existingStockxListing.listed_currency,
          status: existingStockxListing.status as 'active' | 'paused',
        }
      : undefined,
  }

  return modalItem
}

/**
 * Check if an item can be listed on StockX.
 *
 * @param item - Modal item to check
 * @returns Object with canList boolean and reason if not
 */
export function canListOnStockX(item: StockXListingModalItem): {
  canList: boolean
  reason?: string
} {
  if (!item.hasStockxMapping) {
    return {
      canList: false,
      reason: 'Item is not mapped to StockX. Please map it first.',
    }
  }

  if (!item.stockxProductId) {
    return {
      canList: false,
      reason: 'Missing StockX product ID.',
    }
  }

  // If already listed, we switch to reprice mode (still allowed)
  return { canList: true }
}

/**
 * Check if modal should be in reprice mode.
 */
export function isRepriceMode(item: StockXListingModalItem): boolean {
  return !!item.existingListing
}

/**
 * Get display text for the primary CTA button.
 */
export function getListingCTAText(
  item: StockXListingModalItem,
  loading: boolean
): string {
  if (loading) {
    return isRepriceMode(item) ? 'Updating...' : 'Creating...'
  }
  return isRepriceMode(item) ? 'Update Price' : 'List on StockX'
}
