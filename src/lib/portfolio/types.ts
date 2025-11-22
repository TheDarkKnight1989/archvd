export const TABLE_ITEMS = 'Inventory'; // IMPORTANT: Must match Supabase table name exactly
export const TABLE_EXPENSES = 'expenses';

export type Category = 'sneaker' | 'apparel' | 'accessory' | 'other';
export type Status = 'active' | 'listed' | 'worn' | 'sold';
export type Platform = 'StockX' | 'eBay' | 'Vinted' | 'Instagram' | 'Other';
export type ExpenseCategory = 'shipping' | 'fees' | 'ads' | 'supplies' | 'misc';

export type InventoryItem = {
  id: string;
  user_id: string;
  sku: string;
  brand: string;
  model: string;
  size: string;
  category?: Category;
  purchase_price: number;
  tax?: number;
  shipping?: number;
  purchase_date?: string;
  sale_price?: number | null;
  sold_price?: number | null;
  sold_date?: string | null;
  platform?: Platform | null;
  sales_fee?: number | null;
  market_value?: number | null;
  status: Status;
  location: string;
  image_url?: string | null;
  created_at: string;
};

export type Expense = {
  id: string;
  user_id: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  description: string;
  linked_item_id?: string | null;
  created_at: string;
};

export type MonthlyPnL = {
  month: string;
  revenue: number;
  cost: number;
  sales_fees: number;
  expenses: number;
  net_profit: number;
};

/**
 * EnrichedLineItem - V3 data type for InventoryTableV3
 * WHY: Unified interface for inventory display with all computed values
 */
export type EnrichedLineItem = {
  id: string;
  brand: string;
  model: string;
  colorway?: string | null;
  sku: string;
  size_uk?: number | string | null;

  // Image resolved through fallback chain
  image: { src: string; alt: string };
  imageSource?: 'local' | 'stockx' | null;

  // Purchase info
  purchaseDate?: string | null;
  qty: number;
  invested: number;       // total cost (purchase_price + tax + shipping)
  avgCost: number;        // invested / qty

  // Market data
  // PHASE 3.8: Market price = lowest_ask ?? highest_bid ?? null
  // WHY: lowest_ask represents market value (what buyers pay to purchase instantly)
  market: {
    price?: number | null;
    lowestAsk?: number | null;
    currency?: 'GBP' | 'EUR' | 'USD' | null;
    provider?: 'stockx' | 'alias' | 'ebay' | 'seed' | null;
    updatedAt?: string | null;
    spark30d: Array<{ date: string; price: number | null }>;
  };

  // Instant Sell data (highest bid)
  instantSell: {
    gross: number | null;      // highestBid (raw)
    net: number | null;        // after fees
    currency?: 'GBP' | 'EUR' | 'USD' | null;
    provider?: 'stockx' | null;
    updatedAt?: string | null;
    feePct: number;            // seller fee percentage
  };

  // Computed P/L
  total: number;          // market.price * qty
  pl: number | null;      // total - invested
  performancePct: number | null;  // pl / invested * 100

  // Links
  links: { productUrl?: string | null };

  // Status
  status: 'active' | 'listed' | 'worn' | 'sold' | 'archived';
  category?: string;

  // StockX mapping & listing data
  stockx?: {
    mapped: boolean;                    // Has StockX mapping in inventory_market_links
    productId?: string | null;          // stockx_product_id
    variantId?: string | null;          // stockx_variant_id
    listingId?: string | null;          // stockx_listing_id (if listed)
    listingStatus?: 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'CANCELLED' | 'SOLD' | null;
    askPrice?: number | null;           // Current ask price
    expiresAt?: string | null;          // Listing expiry
    // Market data (exact match for this product+variant+currency)
    // PHASE 3.8: Market price = lowest_ask ?? highest_bid ?? null
    lowestAsk?: number | null;          // Lowest ask
    highestBid?: number | null;         // Highest bid
    // PHASE 3.11: Mapping health status
    mappingStatus?: 'ok' | 'stockx_404' | 'invalid' | 'unmapped' | null;
    lastSyncSuccessAt?: string | null;
    lastSyncError?: string | null;
  };
};
