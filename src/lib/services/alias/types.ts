/**
 * Alias API Type Definitions
 * Based on Alias API Reference v1
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export type SizeUnit =
  | 'SIZE_UNIT_INVALID'
  | 'SIZE_UNIT_US'
  | 'SIZE_UNIT_UK'
  | 'SIZE_UNIT_IT'
  | 'SIZE_UNIT_FR'
  | 'SIZE_UNIT_EU'
  | 'SIZE_UNIT_JP';

export type ProductCondition =
  | 'PRODUCT_CONDITION_INVALID'
  | 'PRODUCT_CONDITION_NEW'
  | 'PRODUCT_CONDITION_USED'
  | 'PRODUCT_CONDITION_NEW_WITH_DEFECTS';

export type PackagingCondition =
  | 'PACKAGING_CONDITION_INVALID'
  | 'PACKAGING_CONDITION_GOOD_CONDITION'
  | 'PACKAGING_CONDITION_MISSING_LID'
  | 'PACKAGING_CONDITION_BADLY_DAMAGED'
  | 'PACKAGING_CONDITION_NO_ORIGINAL_BOX';

export type ListingStatus =
  | 'LISTING_STATUS_INVALID'
  | 'LISTING_STATUS_ACTIVE'
  | 'LISTING_STATUS_INACTIVE'
  | 'LISTING_STATUS_PENDING'
  | 'LISTING_STATUS_SOLD';

export type ListingDefect =
  | 'LISTING_DEFECT_INVALID'
  | 'LISTING_DEFECT_HAS_ODOR'
  | 'LISTING_DEFECT_HAS_DISCOLORATION'
  | 'LISTING_DEFECT_HAS_MISSING_INSOLES'
  | 'LISTING_DEFECT_HAS_SCUFFS'
  | 'LISTING_DEFECT_HAS_TEARS'
  | 'LISTING_DEFECT_B_GRADE';

export type PictureType =
  | 'PICTURE_TYPE_INVALID'
  | 'PICTURE_TYPE_OUTER'
  | 'PICTURE_TYPE_EXTRA';

export type Gender = 'men' | 'women' | 'unisex' | 'youth' | 'toddler' | 'infant';

export type ProductCategory = 'shoes' | 'apparel' | 'accessories' | 'collectibles';

// ============================================================================
// CATALOG TYPES
// ============================================================================

export interface AliasSize {
  display_name: string;
  value: number;
  us_size_equivalent: number;
}

export interface RequestedPicture {
  type: PictureType;
  quantity: number;
}

export interface AliasCatalogItem {
  catalog_id: string;
  name: string;
  sku: string;
  brand: string;
  gender?: Gender;
  release_date?: string; // ISO 8601 timestamp
  product_category?: string; // e.g., "PRODUCT_CATEGORY_SHOES"
  product_category_v2?: ProductCategory;
  product_type?: string; // e.g., "sneakers"
  size_unit: SizeUnit;
  allowed_sizes: AliasSize[];
  minimum_listing_price_cents: string; // ⚠️ STRING not number (cents as string)
  maximum_listing_price_cents: string; // ⚠️ STRING not number (cents as string)
  main_picture_url?: string;
  retail_price_cents?: string; // ⚠️ STRING not number (cents as string)
  colorway?: string;
  nickname?: string;
  requires_listing_pictures: boolean;
  resellable: boolean;
  requested_pictures?: RequestedPicture[];
}

export interface SearchCatalogResponse {
  catalog_items: AliasCatalogItem[];
  next_pagination_token?: string;
  has_more: boolean;
}

export interface GetCatalogItemResponse {
  catalog_item: AliasCatalogItem;
}

// ============================================================================
// PRICING INSIGHTS TYPES
// ============================================================================

export interface AliasAvailability {
  lowest_listing_price_cents?: string;
  highest_offer_price_cents?: string;
  last_sold_listing_price_cents?: string;
  global_indicator_price_cents?: string;
  number_of_listings?: number;
  number_of_offers?: number;
}

export interface AliasPricingVariant {
  size: number;
  size_unit?: string;  // 'US', 'UK', 'EU', etc. (optional for backwards compatibility)
  product_condition: ProductCondition;
  packaging_condition: PackagingCondition;
  consigned?: boolean;
  availability: AliasAvailability | null;
}

export interface ListPricingInsightsResponse {
  variants: AliasPricingVariant[];
}

export interface GetPricingInsightsResponse {
  availability: AliasAvailability;
}

export interface OfferHistogramBin {
  offer_price_cents: string; // Price in cents (as string)
  count: string; // Count of offers at this price (as string)
}

export interface OfferHistogram {
  bins: OfferHistogramBin[];
}

export interface OfferHistogramResponse {
  offer_histogram: OfferHistogram;
}

// Note: listing_histogram does NOT exist in Alias API
// Only offer_histogram is available

export interface RecentSale {
  purchased_at: string;       // ISO 8601 timestamp
  price_cents: string;        // Sale price in CENTS as STRING
  size: number;               // Numeric size
  consigned: boolean;         // Consignment flag
  catalog_id: string;         // Catalog ID
}

export interface RecentSalesResponse {
  recent_sales: RecentSale[];
}

// ============================================================================
// LISTING TYPES
// ============================================================================

export interface AliasListing {
  id: string;
  catalog_id: string;
  price_cents: number;
  condition: ProductCondition;
  packaging_condition: PackagingCondition;
  size: number;
  size_unit: SizeUnit;
  status: ListingStatus;
  sku?: string;
  consigned?: boolean;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  defects?: ListingDefect[];
  additional_defects?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateListingParams {
  catalog_id: string;
  price_cents: number;
  condition: ProductCondition;
  packaging_condition: PackagingCondition;
  size: number;
  size_unit: SizeUnit;
  activate?: boolean;
  metadata?: Record<string, unknown>;
  defects?: ListingDefect[];
  additional_defects?: string;
}

export interface CreateListingResponse {
  listing: AliasListing;
}

export interface GetListingResponse {
  listing: AliasListing;
}

export interface UpdateListingParams {
  price_cents?: number;
  condition?: ProductCondition;
  packaging_condition?: PackagingCondition;
  defects?: ListingDefect[];
  additional_defects?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateListingResponse {
  listing: AliasListing;
}

export interface ListListingsResponse {
  listings: AliasListing[];
  next_pagination_token?: string;
  has_more: boolean;
}

export interface DeleteListingResponse {
  // Empty response on success
}

// ============================================================================
// BATCH OPERATIONS TYPES
// ============================================================================

export interface BatchListingResult {
  listing_id?: string;
  success: boolean;
  error?: string;
}

export interface BatchOperation {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  total_items: number;
  succeeded_items: number;
  failed_items: number;
  results?: BatchListingResult[];
  created_at: string;
  completed_at?: string;
}

export interface CreateBatchListingsParams {
  listings: CreateListingParams[];
}

export interface CreateBatchListingsResponse {
  batch_id: string;
  status: string;
}

export interface GetBatchOperationResponse {
  operation: BatchOperation;
}

// ============================================================================
// ORDER TYPES
// ============================================================================

export interface AliasOrder {
  id: string;
  listing_id: string;
  catalog_id: string;
  buyer_id: string;
  seller_id: string;
  price_cents: number;
  status: string;
  size: number;
  size_unit: SizeUnit;
  condition: ProductCondition;
  packaging_condition: PackagingCondition;
  created_at: string;
  updated_at: string;
  shipped_at?: string;
  delivered_at?: string;
}

export interface ListOrdersResponse {
  orders: AliasOrder[];
  next_pagination_token?: string;
  has_more: boolean;
}

export interface GetOrderResponse {
  order: AliasOrder;
}

// ============================================================================
// PAYOUT TYPES
// ============================================================================

export interface AliasPayout {
  id: string;
  amount_cents: number;
  currency: string;
  status: 'pending' | 'processing' | 'paid' | 'failed';
  order_ids: string[];
  payment_method?: string;
  payment_date?: string;
  created_at: string;
  updated_at: string;
}

export interface ListPayoutsResponse {
  payouts: AliasPayout[];
  next_pagination_token?: string;
  has_more: boolean;
}

export interface GetPayoutResponse {
  payout: AliasPayout;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface AliasErrorDetail {
  '@type': string;
  [key: string]: unknown;
}

export interface AliasError {
  code: number;
  message: string;
  details?: AliasErrorDetail[];
}

// ============================================================================
// COMMON TYPES
// ============================================================================

export interface PaginationParams {
  limit?: number;
  pagination_token?: string;
}

export interface TestResponse {
  ok: boolean;
}

// ============================================================================
// REGION TYPES
// ============================================================================

export interface Region {
  id: string;
  name: string;
}

export interface ListRegionsResponse {
  regions: Region[];
}
