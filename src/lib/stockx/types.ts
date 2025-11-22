/**
 * StockX V2 API TypeScript Types
 *
 * Comprehensive type definitions for all StockX v2 API entities.
 * Covers: Catalog, Listings, Orders, Market Data, and Batch Operations.
 *
 * Structure:
 * - Raw types: Match exact StockX API JSON responses
 * - Domain types: Normalized, app-friendly representations
 * - Mappers: Convert raw → domain (in separate files)
 */

// ============================================================================
// RAW API TYPES (exact StockX response structure)
// ============================================================================

/**
 * Raw search response from /v2/catalog/search
 * Based on actual API observations
 */
export interface StockxRawSearchResponse {
  products: StockxRawProduct[]
  // Pagination fields may vary, these are optional
  totalResults?: number
  page?: number
  pageSize?: number
}

/**
 * Raw product from StockX API
 * Fields match actual API response (not documentation)
 */
export interface StockxRawProduct {
  productId: string  // UUID
  styleId: string    // SKU/style code (e.g., "DC7350-100")
  brand: string
  productType: string
  urlKey: string
  title: string
  productAttributes?: {
    colorway?: string
    releaseDate?: string
    retailPrice?: number
    retailCurrency?: string
    gender?: string
    category?: string
  }
  media?: {
    imageUrl?: string
    thumbUrl?: string
    smallImageUrl?: string
  }
}

/**
 * Raw variant from /v2/catalog/products/{id}/variants
 */
export interface StockxRawVariant {
  variantId: string
  productId: string
  variantValue: string  // Size display value
  size?: string         // Alternative size field
  gtins?: string[]
  hidden?: boolean
  market?: {
    lowestAskCents?: number
    highestBidCents?: number
    salesLast72Hours?: number
  }
}

/**
 * Raw market data item from /v2/catalog/products/{id}/market-data
 * Returns an array of these, one per variant
 */
export interface StockxRawMarketDataItem {
  variantId: string
  productId?: string
  lowestAskAmount?: number
  highestBidAmount?: number
  salesLast72Hours?: number
  totalSalesVolume?: number
  averageDeadstockPrice?: number
  volatility?: number
  pricePremium?: number
}

/**
 * Raw listing from /v2/selling/listings
 */
export interface StockxRawListing {
  listingId: string
  productId: string
  variantId: string
  amountCents: number  // Price in cents
  currencyCode: string
  status: string
  expiresAt?: string
  createdAt: string
  updatedAt: string
}

/**
 * Raw listing creation response
 */
export interface StockxRawListingCreated {
  listingId: string
  productId: string
  variantId: string
  amountCents: number
  currencyCode: string
  status: string
  createdAt: string
  expiresAt?: string
}

// ============================================================================
// DOMAIN TYPES (normalized app types)
// ============================================================================

/**
 * StockX Product (from /v2/catalog/products/{id})
 */
export interface StockxProduct {
  productId: string
  styleId: string // SKU
  title: string
  brand: string
  description?: string
  colorway?: string
  retailPrice?: number
  releaseDate?: string
  imageUrl?: string
  thumbUrl?: string
  category?: string
  gender?: string
  condition?: 'new' | 'used'
  traits?: Record<string, any>
}

/**
 * StockX Product Variant (size/color variations)
 */
export interface StockxVariant {
  variantId: string
  productId: string
  variantValue: string // e.g., "10.5", "M", "OS"
  gtins?: string[] // UPC/EAN barcodes
  hidden?: boolean
  sizeChart?: {
    category: string
    baseCategory: string
    baseType: string
    displayOptions: string[]
  }
}

/**
 * Market Data for a variant
 */
export interface StockxMarketData {
  productId: string
  variantId: string
  currencyCode: string

  // Sales statistics
  salesLast72Hours?: number
  totalSalesVolume?: number

  // Current market
  lowestAsk?: number
  highestBid?: number

  // Historical ranges
  averageDeadstockPrice?: number
  volatility?: number
  pricePremium?: number
}

/**
 * GTIN lookup result
 */
export interface StockxGTINLookup {
  gtin: string
  product: StockxProduct
  variant: StockxVariant
  marketData?: StockxMarketData
}

/**
 * Search result
 */
export interface StockxSearchResult {
  products: StockxProduct[]
  totalResults: number
  pageSize: number
  page: number
}

// ============================================================================
// LISTING TYPES
// ============================================================================

/**
 * StockX Listing (seller's ask)
 */
export interface StockxListing {
  listingId: string
  productId: string
  variantId: string
  amount: number // Price in cents
  currencyCode: string
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'CANCELLED' | 'SOLD'
  expiresAt?: string
  createdAt: string
  updatedAt: string

  // Product context (may be included in response)
  product?: {
    styleId: string
    title: string
    imageUrl?: string
  }
  variant?: {
    variantValue: string
  }
}

/**
 * Create/Update listing request
 */
export interface StockxListingOperation {
  productId: string
  variantId: string
  amount: number // Price in cents
  currencyCode: string
  expiresAt?: string
}

/**
 * Listing creation response
 */
export interface StockxListingCreated {
  listingId: string
  productId: string
  variantId: string
  amount: number
  currencyCode: string
  status: string
  createdAt: string
  expiresAt?: string
}

// ============================================================================
// BATCH OPERATIONS TYPES
// ============================================================================

/**
 * Batch item for bulk create/update/delete
 */
export interface StockxBatchItem {
  productId: string
  variantId: string
  amount?: number // Price in cents (for create/update)
  currencyCode?: string
  listingId?: string // For update/delete
  expiresAt?: string
}

/**
 * Batch job creation request
 */
export interface StockxBatchRequest {
  items: StockxBatchItem[]
}

/**
 * Batch job status response
 */
export interface StockxBatchJob {
  batchId: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'PARTIAL'
  totalItems: number
  processedItems: number
  successfulItems: number
  failedItems: number
  createdAt: string
  updatedAt: string
  completedAt?: string

  // Item-level results
  results?: Array<{
    productId: string
    variantId: string
    listingId?: string
    status: 'SUCCESS' | 'FAILED'
    error?: string
  }>
}

// ============================================================================
// ORDER TYPES
// ============================================================================

/**
 * StockX Order (completed sale)
 */
export interface StockxOrder {
  orderId: string
  listingId: string
  productId: string
  variantId: string

  // Sale details
  amount: number // Sale price in cents
  currencyCode: string
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

  // Dates
  createdAt: string
  updatedAt: string
  soldAt?: string
  shippedAt?: string
  deliveredAt?: string

  // Buyer info (limited)
  buyerCountry?: string

  // Seller payout
  payout?: StockxPayoutInfo

  // Shipping
  shipping?: StockxShippingInfo

  // Product context
  product?: {
    styleId: string
    title: string
    imageUrl?: string
  }
  variant?: {
    variantValue: string
  }
}

/**
 * Payout information
 */
export interface StockxPayoutInfo {
  amount: number // Payout amount in cents
  currencyCode: string
  payoutDate?: string
  payoutMethod?: string
  processingFee?: number
  transactionFee?: number
  shippingCost?: number
}

/**
 * Shipping information
 */
export interface StockxShippingInfo {
  trackingNumber?: string
  carrier?: string
  labelUrl?: string
  requiredShipDate?: string
  addressVerified?: boolean
}

// ============================================================================
// API RESPONSE WRAPPERS
// ============================================================================

/**
 * Paginated response wrapper
 */
export interface StockxPaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    totalPages: number
    totalResults: number
  }
}

/**
 * Error response
 */
export interface StockxErrorResponse {
  error: string
  message: string
  statusCode: number
  details?: any
}

// ============================================================================
// DATABASE ENTITY TYPES (for our Supabase tables)
// ============================================================================

/**
 * Our database representation of StockX products
 */
export interface StockxProductEntity {
  id: string // Our UUID
  stockx_product_id: string // StockX ID
  style_id: string // SKU
  title: string
  brand: string
  description?: string
  colorway?: string
  retail_price?: number
  release_date?: string
  image_url?: string
  thumb_url?: string
  category?: string
  gender?: string
  condition?: string
  traits?: Record<string, any>
  created_at: string
  updated_at: string
  last_synced_at: string
}

/**
 * Our database representation of StockX variants
 */
export interface StockxVariantEntity {
  id: string // Our UUID
  stockx_variant_id: string // StockX ID
  stockx_product_id: string // StockX product ID
  product_id: string // Our product UUID (FK)
  variant_value: string
  gtins?: string[]
  hidden?: boolean
  size_chart?: Record<string, any>
  created_at: string
  updated_at: string
  last_synced_at: string
}

/**
 * Market data snapshot
 */
export interface StockxMarketSnapshot {
  id: string // Our UUID
  stockx_product_id: string
  stockx_variant_id: string
  product_id: string // Our product UUID (FK)
  variant_id: string // Our variant UUID (FK)
  currency_code: string

  sales_last_72_hours?: number
  total_sales_volume?: number
  lowest_ask?: number
  highest_bid?: number
  average_deadstock_price?: number
  volatility?: number
  price_premium?: number

  snapshot_at: string
  created_at: string
}

/**
 * Our database representation of listings
 */
export interface StockxListingEntity {
  id: string // Our UUID
  user_id: string // Our user UUID
  stockx_listing_id?: string // StockX ID (null until created)
  stockx_product_id: string
  stockx_variant_id: string
  product_id: string // Our product UUID (FK)
  variant_id: string // Our variant UUID (FK)

  amount: number // Price in cents
  currency_code: string
  status: string
  expires_at?: string

  deleted_at?: string // Soft delete support

  created_at: string
  updated_at: string
  last_synced_at?: string
}

/**
 * Our database representation of orders
 */
export interface StockxOrderEntity {
  id: string // Our UUID
  user_id: string // Our user UUID
  stockx_order_id?: string // StockX ID (nullable until confirmed)
  stockx_listing_id: string
  stockx_product_id: string
  stockx_variant_id: string
  listing_id: string // Our listing UUID (FK)
  product_id: string // Our product UUID (FK)
  variant_id: string // Our variant UUID (FK)

  amount: number // Sale price in cents
  currency_code: string
  status: string

  sold_at?: string
  shipped_at?: string
  delivered_at?: string

  payout_amount?: number
  payout_date?: string
  processing_fee?: number
  transaction_fee?: number
  shipping_cost?: number

  tracking_number?: string
  carrier?: string

  deleted_at?: string // Soft delete support

  created_at: string
  updated_at: string
  last_synced_at: string
}

/**
 * Batch job tracking
 */
export interface StockxBatchJobEntity {
  id: string // Our UUID
  user_id: string // Our user UUID
  stockx_batch_id?: string // StockX batch ID
  operation: 'CREATE' | 'UPDATE' | 'DELETE'
  status: string
  total_items: number
  processed_items: number
  successful_items: number
  failed_items: number
  results?: Record<string, any> // Deprecated: use stockx_batch_job_items table instead
  created_at: string
  updated_at: string
  completed_at?: string
}

/**
 * Batch job item tracking (individual results)
 */
export interface StockxBatchJobItemEntity {
  id: string // Our UUID
  batch_job_id: string // Parent batch job UUID (FK)
  user_id: string // Our user UUID

  // Item identifiers
  stockx_product_id: string
  stockx_variant_id: string
  stockx_listing_id?: string // For update/delete operations

  // Request data
  amount?: number // Requested price in cents
  currency_code?: string

  // Result
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  error_message?: string

  // Response data
  response_listing_id?: string // Returned listing ID on success

  created_at: string
  updated_at: string
}

// ============================================================================
// MAPPING TYPES (linking our inventory/watchlist to StockX)
// ============================================================================

/**
 * Link watchlist items to StockX market data
 */
export interface WatchlistMarketLink {
  id: string
  watchlist_item_id: string
  stockx_product_id: string
  stockx_variant_id: string
  created_at: string
}

/**
 * Link inventory items to StockX listings/market
 */
export interface InventoryMarketLink {
  id: string
  item_id: string
  stockx_product_id: string
  stockx_variant_id: string
  stockx_listing_id?: string
  created_at: string
  updated_at: string
}
