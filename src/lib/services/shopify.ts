/**
 * Shopify Admin API Client
 * Fetches products and variants from Shopify
 */

import { logger } from '@/lib/logger';
import {
  getShopifyAccessToken,
  getShopifyApiUrl,
  maskShopifyToken,
} from '@/lib/config/shopify';

// ============================================================================
// Types
// ============================================================================

export interface ShopifyProduct {
  id: number;
  title: string;
  vendor: string;
  product_type: string;
  handle: string;
  status: string;
  tags: string;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  created_at: string;
  updated_at: string;
}

export interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  sku: string;
  price: string;
  compare_at_price: string | null;
  inventory_quantity: number;
  option1: string | null; // Usually size
  option2: string | null;
  option3: string | null;
  image_id: number | null;
  weight: number;
  weight_unit: string;
}

export interface ShopifyImage {
  id: number;
  product_id: number;
  src: string;
  position: number;
  width: number;
  height: number;
  variant_ids: number[];
}

export interface ShopifyProductsResponse {
  products: ShopifyProduct[];
}

// ============================================================================
// Shopify API Client
// ============================================================================

export class ShopifyClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Make authenticated request to Shopify Admin API
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = getShopifyApiUrl(endpoint);

    logger.info('[Shopify] API Request', {
      endpoint,
      method: options.method || 'GET',
      token: maskShopifyToken(this.accessToken),
    });

    const response = await fetch(url, {
      ...options,
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[Shopify] API Error', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch all products with pagination
   */
  async getAllProducts(options: {
    status?: 'active' | 'archived' | 'draft';
    limit?: number;
  } = {}): Promise<ShopifyProduct[]> {
    const { status = 'active', limit = 250 } = options;

    logger.info('[Shopify] Fetching all products', { status, limit });

    const allProducts: ShopifyProduct[] = [];
    let hasMore = true;
    let pageInfo: string | null = null;

    while (hasMore) {
      const endpoint = pageInfo
        ? `products.json?limit=${limit}&page_info=${pageInfo}&status=${status}`
        : `products.json?limit=${limit}&status=${status}`;

      const response = await this.request<ShopifyProductsResponse>(endpoint);

      allProducts.push(...response.products);

      // Check for pagination (Link header)
      // For simplicity, we'll just fetch once with max limit
      hasMore = false;
    }

    logger.info('[Shopify] Fetched products', {
      count: allProducts.length,
      status,
    });

    return allProducts;
  }

  /**
   * Get products filtered by tags or product type
   */
  async getProductsByFilter(filter: {
    productType?: string;
    tags?: string[];
    status?: 'active' | 'archived' | 'draft';
  }): Promise<ShopifyProduct[]> {
    const allProducts = await this.getAllProducts({
      status: filter.status || 'active',
    });

    let filtered = allProducts;

    // Filter by product type
    if (filter.productType) {
      filtered = filtered.filter((product) =>
        product.product_type.toLowerCase().includes(filter.productType!.toLowerCase())
      );
    }

    // Filter by tags
    if (filter.tags && filter.tags.length > 0) {
      filtered = filtered.filter((product) => {
        const productTags = product.tags.toLowerCase().split(',').map((t) => t.trim());
        return filter.tags!.some((tag) =>
          productTags.includes(tag.toLowerCase())
        );
      });
    }

    logger.info('[Shopify] Filtered products', {
      originalCount: allProducts.length,
      filteredCount: filtered.length,
      filter,
    });

    return filtered;
  }

  /**
   * Get a single product by ID
   */
  async getProduct(productId: number): Promise<ShopifyProduct> {
    logger.info('[Shopify] Fetching product', { productId });

    const response = await this.request<{ product: ShopifyProduct }>(
      `products/${productId}.json`
    );

    return response.product;
  }
}

/**
 * Create Shopify client instance
 */
export function createShopifyClient(): ShopifyClient {
  const accessToken = getShopifyAccessToken();
  return new ShopifyClient(accessToken);
}
