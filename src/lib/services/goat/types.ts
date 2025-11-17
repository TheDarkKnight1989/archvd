/**
 * Alias (GOAT) API Type Definitions
 * Based on API documentation analysis
 */

// ============================================================================
// Core API Types
// ============================================================================

export interface GoatApiConfig {
  apiUrl: string;
  accessToken: string;
  timeout?: number;
  retries?: number;
}

export interface GoatApiError {
  status: number;
  code: string;
  message: string;
  details?: any;
}

export interface GoatApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    total?: number;
    limit?: number;
  };
}

// ============================================================================
// Product Types
// ============================================================================

export interface GoatProduct {
  id: string;
  slug: string;
  sku: string;
  name: string;
  brand: string;
  model: string;
  colorway: string;
  category: 'sneakers' | 'apparel' | 'accessories';
  gender: 'men' | 'women' | 'youth' | 'infant' | 'unisex';
  releaseDate: string | null;
  retailPrice: number;
  retailCurrency: string;
  mainPictureUrl: string;
  pictureUrls: string[];
  description?: string;
  condition: 'new' | 'used';
  createdAt: string;
  updatedAt: string;
}

export interface GoatProductVariant {
  id: string;
  productTemplateId: string;
  size: string;
  sizeType: 'US' | 'UK' | 'EU' | 'CM';
  sku: string;
  available: boolean;
  lowestAsk: number | null;
  highestBid: number | null;
  lastSale: number | null;
  salesLast72h: number;
  currency: string;
}

export interface GoatSearchParams {
  query?: string;
  brand?: string;
  category?: string;
  gender?: string;
  priceMin?: number;
  priceMax?: number;
  size?: string;
  condition?: 'new' | 'used';
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'release_date' | 'popularity';
  page?: number;
  limit?: number;
}

export interface GoatSearchResult {
  results: GoatProduct[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface GoatBuyBarData {
  productTemplateId: string;
  variants: Array<{
    size: string;
    lowestAsk: number;
    highestBid: number;
    lastSale: number;
    salesCount: number;
    salesLast72h?: number;
    askCount: number;
    bidCount: number;
  }>;
  currency: string;
  asOf: string;
}

// ============================================================================
// Listing Types
// ============================================================================

export interface GoatListing {
  id: string;
  sellerId: string;
  productId: string;
  productSlug: string;
  sku: string;
  size: string;
  condition: 'new' | 'used' | 'defects';
  price: number;
  currency: string;
  status: 'active' | 'sold' | 'cancelled' | 'expired';
  quantity: number;
  boxCondition?: 'good_condition' | 'no_original_box' | 'damaged_box';
  defects?: string[];
  listedAt: string;
  expiresAt: string | null;
  lastPriceUpdate: string | null;
  views: number;
  favorites: number;
}

export interface GoatCreateListingParams {
  productId: string;
  size: string;
  price: number;
  currency?: string;
  condition?: 'new' | 'used' | 'defects';
  boxCondition?: 'good_condition' | 'no_original_box' | 'damaged_box';
  quantity?: number;
  defects?: string[];
  expirationDays?: number;
}

export interface GoatUpdateListingParams {
  price?: number;
  quantity?: number;
  condition?: 'new' | 'used' | 'defects';
  boxCondition?: string;
}

export interface GoatBulkPriceUpdate {
  listingId: string;
  newPrice: number;
}

// ============================================================================
// Order Types
// ============================================================================

export interface GoatOrder {
  id: string;
  orderNumber: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  productId: string;
  productName: string;
  sku: string;
  size: string;
  condition: string;
  salePrice: number;
  currency: string;
  commission: number;
  processingFee: number;
  shippingCost: number;
  netPayout: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'completed' | 'cancelled';
  paymentStatus: 'pending' | 'processing' | 'paid' | 'failed';
  soldAt: string;
  confirmedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  trackingNumber: string | null;
  shippingLabelUrl: string | null;
  buyerAddress?: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoatOrdersParams {
  status?: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'completed';
  since?: string; // ISO date or '24h', '7d', '30d'
  page?: number;
  limit?: number;
}

export interface GoatShippingLabel {
  orderId: string;
  labelUrl: string;
  trackingNumber: string;
  carrier: 'ups' | 'usps' | 'fedex' | 'dhl';
  serviceName: string;
  cost: number;
  expiresAt: string;
}

// ============================================================================
// Pricing & Market Data Types
// ============================================================================

export interface GoatPriceHistory {
  sku: string;
  size: string;
  dataPoints: Array<{
    date: string;
    lowestAsk: number;
    highestBid: number;
    lastSale: number;
    salesVolume: number;
  }>;
  currency: string;
  from: string;
  to: string;
}

export interface GoatSale {
  id: string;
  sku: string;
  size: string;
  salePrice: number;
  currency: string;
  condition: 'new' | 'used';
  soldAt: string;
  orderNumber?: string;
}

export interface GoatSalesHistoryParams {
  sku: string;
  size?: string;
  condition?: 'new' | 'used';
  from?: string; // ISO date
  to?: string;   // ISO date
  limit?: number;
}

export interface GoatMarketDepth {
  sku: string;
  size: string;
  asks: Array<{
    price: number;
    quantity: number;
    sellerId: string;
  }>;
  bids: Array<{
    price: number;
    quantity: number;
    buyerId: string;
  }>;
  spread: number;
  spreadPct: number;
  asOf: string;
}

// ============================================================================
// Seller Profile Types
// ============================================================================

export interface GoatSellerProfile {
  id: string;
  username: string;
  displayName: string;
  rating: number; // 1-5
  totalSales: number;
  totalListings: number;
  averageShipTime: number; // hours
  responseRate: number; // percentage
  onTimeShipRate: number; // percentage
  defectRate: number; // percentage
  joinedAt: string;
  vacationMode: boolean;
  verifiedSeller: boolean;
  badges: string[];
}

export interface GoatSellerAnalytics {
  period: '7d' | '30d' | '90d' | '1y';
  sales: {
    count: number;
    revenue: number;
    avgSalePrice: number;
    topSkus: Array<{
      sku: string;
      count: number;
      revenue: number;
    }>;
  };
  performance: {
    avgShipTime: number;
    onTimeShipRate: number;
    responseTime: number; // hours
    defectRate: number;
  };
  inventory: {
    activeListings: number;
    totalValue: number;
    avgDaysToSell: number;
    turnoverRate: number;
  };
  fees: {
    totalCommission: number;
    totalProcessingFees: number;
    avgCommissionRate: number;
  };
}

// ============================================================================
// Authentication Types
// ============================================================================

export interface GoatAuthCredentials {
  email: string;
  password: string;
}

export interface GoatAuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    username: string;
  };
}

export interface GoatRefreshTokenParams {
  refreshToken: string;
}

// ============================================================================
// Webhook Types (if supported)
// ============================================================================

export interface GoatWebhookEvent {
  id: string;
  type: 'order.created' | 'order.confirmed' | 'order.shipped' | 'order.cancelled' | 'listing.sold' | 'listing.expired' | 'price.changed';
  data: any;
  createdAt: string;
}

export interface GoatWebhookConfig {
  url: string;
  events: string[];
  secret: string;
}

// ============================================================================
// Fee Schedule Types
// ============================================================================

export interface GoatFeeSchedule {
  sellerId: string;
  tier: 'standard' | 'verified' | 'power' | 'enterprise';
  commissionRate: number; // percentage
  processingFee: number; // fixed amount per transaction
  shippingCredit: number; // amount credited for shipping
  updatedAt: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type GoatCurrency = 'USD' | 'GBP' | 'EUR' | 'CAD' | 'AUD' | 'JPY';
export type GoatSortOrder = 'asc' | 'desc';
export type GoatDateRange = '24h' | '7d' | '30d' | '90d' | '1y' | 'all';

export interface GoatPaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: GoatSortOrder;
}

export interface GoatPaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
