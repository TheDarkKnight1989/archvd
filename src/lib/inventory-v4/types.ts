/**
 * ARCHVD Inventory V4 Types
 *
 * Fresh V4 implementation - complete type definitions for the inventory system.
 * This is the single source of truth for all V4 inventory types.
 */

import type { ArchvdPriceWithFees, Currency, SizeUnit } from '../pricing-v4/types'

// =============================================================================
// STYLE CATALOG TYPES
// =============================================================================

/**
 * Style catalog entry - the universal product registry
 * Single source of truth for SKUs
 */
export interface StyleCatalogV4 {
  style_id: string // Primary key - SKU like 'DD1391-100'
  brand: string | null
  name: string | null
  nickname: string | null
  colorway: string | null
  gender: string | null
  product_category: string | null
  release_date: string | null
  /** Retail price in CENTS (minor units). Divide by 100 for display. */
  retail_price_cents: number | null
  primary_image_url: string | null
  stockx_product_id: string | null
  stockx_url_key: string | null
  alias_catalog_id: string | null
  created_at: string
  updated_at: string
}

// =============================================================================
// INVENTORY ITEM TYPES
// =============================================================================

/**
 * Item condition
 * - new: Brand new, never worn
 * - used: Previously worn
 * - deadstock: New, original packaging, often vintage/rare
 *
 * IMPORTANT: For market price comparison, normalize to 'new' | 'used':
 *   conditionForMarket = condition === 'deadstock' ? 'new' : condition
 * Market APIs only understand new vs used; deadstock is a UI/collector distinction.
 */
export type ItemCondition = 'new' | 'used' | 'deadstock'

/**
 * Item status - PHYSICAL STATE ONLY
 *
 * Listing state is derived from inventory_v4_listings table, not stored here.
 * Use: item.listings.some(l => l.status === 'active') to check if listed.
 *
 * - in_stock: Item is in inventory (may or may not be listed)
 * - consigned: Physical item is at a consignment location
 * - sold: Item has been sold
 * - removed: Removed from inventory (soft delete)
 */
export type ItemStatus =
  | 'in_stock'
  | 'consigned'
  | 'sold'
  | 'removed'

// =============================================================================
// LISTING TYPES
// =============================================================================

/**
 * Known listing platforms with brand colors
 * - stockx: #08A05C (green)
 * - alias: #3B82F6 (blue)
 * - ebay: #E53238 (red)
 * - vinted: #09B1BA (teal)
 * - depop: #FF2300 (red-orange)
 * - tiktok: #000000 (black)
 * - instagram: #E1306C (pink)
 * - shopify: #96BF48 (lime green)
 * - custom: #6B7280 (gray)
 */
export type ListingPlatform =
  | 'stockx'
  | 'alias'
  | 'ebay'
  | 'vinted'
  | 'depop'
  | 'tiktok'
  | 'instagram'
  | 'shopify'
  | 'custom'

export type ListingStatus =
  | 'active'
  | 'sold'
  | 'expired'
  | 'cancelled'
  | 'paused'

/**
 * Platform listing - tracks where an item is listed
 */
export interface InventoryV4Listing {
  id: string
  item_id: string
  user_id: string
  platform: ListingPlatform
  platform_name: string | null // For custom platforms
  listed_price: number
  listed_currency: Currency
  listing_url: string | null
  external_listing_id: string | null
  status: ListingStatus
  sold_price: number | null
  sold_at: string | null
  listed_at: string
  created_at: string
  updated_at: string
}

// =============================================================================
// PURCHASE SOURCE TYPES
// =============================================================================

/**
 * Pre-populated purchase sources
 */
export const PRESET_PURCHASE_SOURCES = [
  'Nike',
  'END',
  'JD Sports',
  'FootLocker',
  'Size?',
  'SNS (Sneakersnstuff)',
  'StockX',
  'GOAT',
  'eBay',
  'Vinted',
  'Depop',
  'Facebook Marketplace',
  'Instagram',
  'Consignment Store',
  'Retail (Other)',
  'Gift',
  'Other',
] as const

export type PresetPurchaseSource = (typeof PRESET_PURCHASE_SOURCES)[number]

/**
 * User-defined custom purchase source
 */
export interface UserPurchaseSource {
  id: string
  user_id: string
  name: string
  website_url: string | null
  notes: string | null
  created_at: string
}

/**
 * User's inventory item
 */
export interface InventoryV4Item {
  id: string
  user_id: string
  style_id: string
  size: string // Size as text (e.g., "10", "10.5")
  size_unit: SizeUnit // Size system (US/UK/EU) - defaults to US
  /** Purchase price in MAJOR units (e.g., 120.50). NOT cents. Paired with purchase_currency. */
  purchase_price: number | null
  purchase_currency: Currency
  purchase_date: string | null
  condition: ItemCondition
  status: ItemStatus
  consignment_location: string | null
  /** Where the item was purchased (preset or custom source name) */
  purchase_source: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/**
 * Inventory item with joined style catalog data
 */
export interface InventoryV4ItemWithStyle extends InventoryV4Item {
  style: StyleCatalogV4
}

/**
 * Full inventory item with style, market data, and listings
 */
export interface InventoryV4ItemFull extends InventoryV4ItemWithStyle {
  marketData: ArchvdPriceWithFees | null
  syncStatus: SyncStatusV4 | null
  /** Active listings for this item across all platforms */
  listings: InventoryV4Listing[]
}

// =============================================================================
// SYNC QUEUE TYPES
// =============================================================================

export type SyncProvider = 'stockx' | 'alias'

/** Sync job status - matches DB enum */
export type SyncJobStatus = 'pending' | 'processing' | 'completed' | 'failed'

/** Provider sync status - job status + not_mapped for unmapped providers */
export type ProviderSyncStatus = SyncJobStatus | 'not_mapped'

/**
 * Sync queue job - matches design doc schema
 */
export interface SyncJobV4 {
  id: string
  style_id: string
  provider: SyncProvider
  status: SyncJobStatus
  attempts: number
  max_attempts: number
  last_attempt_at: string | null
  next_retry_at: string | null
  last_error: string | null
  created_at: string
  completed_at: string | null
}

/**
 * Combined sync status for a style
 */
export interface SyncStatusV4 {
  styleId: string
  stockx: {
    status: ProviderSyncStatus
    lastAttempt: string | null
    error: string | null
  }
  alias: {
    status: ProviderSyncStatus
    lastAttempt: string | null
    error: string | null
  }
  /** Overall status for the row */
  overall: 'syncing' | 'ready' | 'partial' | 'failed' | 'not_mapped'
}

// =============================================================================
// MARKET DATA ROW STATES
// =============================================================================

/**
 * State for a single inventory row's market data.
 *
 * This is the FINAL UI truth, derived from SyncStatusV4 + provider statuses:
 * - SyncStatusV4.overall tracks JOB state (pending/processing/completed/failed)
 * - MarketDataState is what the UI actually renders
 *
 * Derivation rules:
 * - 'loading' → initial fetch, no sync status yet
 * - 'syncing' → SyncStatusV4.overall === 'syncing'
 * - 'ready' → both providers completed with data
 * - 'partial' → one provider has data, other doesn't
 * - 'failed' → SyncStatusV4.overall === 'failed'
 * - 'no_data' → sync completed but no market data available (not_mapped or provider returned empty)
 */
export type MarketDataState =
  | 'loading' // Initial skeleton
  | 'syncing' // Sync in progress
  | 'ready' // Full data available
  | 'partial' // Some data available
  | 'failed' // Sync failed
  | 'no_data' // No market data available

// =============================================================================
// SEARCH TYPES
// =============================================================================

export type InputType = 'sku' | 'search_query' | 'stockx_url' | 'alias_url'

/**
 * Unified search result
 */
export interface SearchResultV4 {
  /** The canonical SKU */
  styleId: string

  /** Product name */
  name: string

  /** Brand name */
  brand: string

  /** Product image URL */
  imageUrl: string | null

  /** Colorway */
  colorway: string | null

  /** Whether this SKU exists in our database */
  inDatabase: boolean

  /** Source of this result */
  source: 'local' | 'stockx' | 'alias'

  /** External IDs for creating new style entries */
  externalIds: {
    stockxProductId?: string
    stockxUrlKey?: string
    aliasCatalogId?: string
  }
}

/**
 * Unified search response
 */
export interface SearchResponseV4 {
  results: SearchResultV4[]
  query: string
  inputType: InputType
  timing: {
    total: number
    local?: number
    stockx?: number
    alias?: number
  }
}

// =============================================================================
// ADD ITEM MODAL TYPES
// =============================================================================

export type AddItemModalStep =
  | 'idle'
  | 'searching'
  | 'results'
  | 'no_results'
  | 'selected'
  | 'confirm_create'
  | 'ready_to_add'
  | 'adding'
  | 'added'
  | 'error'

export interface AddItemModalStateV4 {
  step: AddItemModalStep
  searchQuery: string
  searchResults: SearchResultV4[]
  isSearching: boolean
  selectedResult: SearchResultV4 | null
  selectedSize: string | null
  selectedSizeUnit: SizeUnit // Defaults to 'US' in initial state
  purchasePrice: number | null
  purchaseCurrency: Currency
  purchaseDate: string | null
  condition: ItemCondition
  isSubmitting: boolean
  error: Error | null
}

// =============================================================================
// API TYPES
// =============================================================================

/**
 * Add item request body
 */
export interface AddItemRequestV4 {
  styleId: string
  size: string
  sizeUnit?: SizeUnit // Defaults to 'US' in handler
  purchasePrice?: number | null
  purchaseCurrency?: Currency
  purchaseDate?: string | null
  condition?: ItemCondition
  notes?: string | null
}

/**
 * Create style and add item request (for new SKUs)
 */
export interface CreateStyleAndAddRequestV4 {
  styleId: string
  stockxProductId?: string | null
  stockxUrlKey?: string | null
  aliasCatalogId?: string | null
  name?: string | null
  brand?: string | null
  colorway?: string | null
  imageUrl?: string | null
  size: string
  sizeUnit?: SizeUnit // Defaults to 'US' in handler
  purchasePrice?: number | null
  purchaseCurrency?: Currency
  purchaseDate?: string | null
  condition?: ItemCondition
  notes?: string | null
}

/**
 * Retry sync request
 */
export interface RetrySyncRequestV4 {
  styleId: string
  provider?: SyncProvider
}

// =============================================================================
// HOOK RETURN TYPES
// =============================================================================

export interface UseInventoryV4Return {
  items: InventoryV4ItemFull[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
  addItem: (request: AddItemRequestV4) => Promise<InventoryV4Item>
  createStyleAndAdd: (
    request: CreateStyleAndAddRequestV4
  ) => Promise<InventoryV4Item>
  removeItem: (itemId: string) => Promise<void>
  updateItem: (
    itemId: string,
    updates: Partial<InventoryV4Item>
  ) => Promise<void>
}

export interface UseUnifiedSearchV4Return {
  search: (query: string) => Promise<SearchResponseV4>
  results: SearchResultV4[]
  isSearching: boolean
  error: Error | null
  clear: () => void
}

// =============================================================================
// DATABASE ROW TYPES (for type safety with Supabase)
// =============================================================================

/**
 * Raw DB row types use `string` for enums because Supabase returns strings.
 * Mapper functions should validate and cast to typed enums.
 */

export interface InventoryV4ItemRow {
  id: string
  user_id: string
  style_id: string
  size: string
  size_unit: string // DB returns string, cast to SizeUnit
  purchase_price: number | null
  purchase_currency: string // DB returns string, cast to Currency
  purchase_date: string | null
  condition: string // DB returns string, cast to ItemCondition
  status: string // DB returns string, cast to ItemStatus
  consignment_location: string | null
  purchase_source: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface StyleCatalogV4Row {
  style_id: string
  brand: string | null
  name: string | null
  nickname: string | null
  colorway: string | null
  gender: string | null
  product_category: string | null
  release_date: string | null
  retail_price_cents: number | null
  primary_image_url: string | null
  stockx_product_id: string | null
  stockx_url_key: string | null
  alias_catalog_id: string | null
  created_at: string
  updated_at: string
}

/** Matches design doc sync_queue schema */
export interface SyncQueueV4Row {
  id: string
  style_id: string
  provider: string // DB returns string, cast to SyncProvider
  status: string // DB returns string, cast to SyncJobStatus
  attempts: number
  max_attempts: number
  last_attempt_at: string | null
  next_retry_at: string | null
  last_error: string | null
  created_at: string
  completed_at: string | null
}

/** DB row for inventory_v4_listings */
export interface InventoryV4ListingRow {
  id: string
  item_id: string
  user_id: string
  platform: string // DB returns string, cast to ListingPlatform
  platform_name: string | null
  listed_price: number
  listed_currency: string // DB returns string, cast to Currency
  listing_url: string | null
  external_listing_id: string | null
  status: string // DB returns string, cast to ListingStatus
  sold_price: number | null
  sold_at: string | null
  listed_at: string
  created_at: string
  updated_at: string
}

/** DB row for user_purchase_sources */
export interface UserPurchaseSourceRow {
  id: string
  user_id: string
  name: string
  website_url: string | null
  notes: string | null
  created_at: string
}

// =============================================================================
// PLATFORM CONFIG
// =============================================================================

/**
 * Platform display configuration for badges
 */
export const PLATFORM_CONFIG: Record<
  ListingPlatform,
  { label: string; color: string; bgColor: string; textColor: string }
> = {
  stockx: {
    label: 'SX',
    color: '#08A05C',
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-500',
  },
  alias: {
    label: 'AL',
    color: '#3B82F6',
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-500',
  },
  ebay: {
    label: 'eB',
    color: '#E53238',
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-500',
  },
  vinted: {
    label: 'VT',
    color: '#09B1BA',
    bgColor: 'bg-teal-500/10',
    textColor: 'text-teal-500',
  },
  depop: {
    label: 'DP',
    color: '#FF2300',
    bgColor: 'bg-orange-500/10',
    textColor: 'text-orange-500',
  },
  tiktok: {
    label: 'TT',
    color: '#000000',
    bgColor: 'bg-zinc-500/10',
    textColor: 'text-zinc-900 dark:text-zinc-100',
  },
  instagram: {
    label: 'IG',
    color: '#E1306C',
    bgColor: 'bg-pink-500/10',
    textColor: 'text-pink-500',
  },
  shopify: {
    label: 'SH',
    color: '#96BF48',
    bgColor: 'bg-lime-500/10',
    textColor: 'text-lime-600',
  },
  custom: {
    label: '?',
    color: '#6B7280',
    bgColor: 'bg-zinc-500/10',
    textColor: 'text-zinc-500',
  },
}
