/**
 * GOAT Products Service
 * Handles product search, details, variants, and market data
 */

import type { GoatClient } from './client';
import type {
  GoatProduct,
  GoatProductVariant,
  GoatSearchParams,
  GoatSearchResult,
  GoatBuyBarData,
  GoatPriceHistory,
  GoatSale,
  GoatSalesHistoryParams,
  GoatMarketDepth,
} from './types';

export class GoatProductsService {
  constructor(private client: GoatClient) {}

  // ==========================================================================
  // Product Search & Discovery
  // ==========================================================================

  /**
   * Search products by keyword with filters
   *
   * @example
   * const results = await productsService.search({
   *   query: 'Jordan 1',
   *   brand: 'Nike',
   *   priceMin: 100,
   *   priceMax: 300,
   *   size: 'UK9',
   *   page: 1,
   *   limit: 20
   * });
   */
  async search(params: GoatSearchParams): Promise<GoatSearchResult> {
    const queryParams: Record<string, any> = {
      page: params.page || 1,
      limit: params.limit || 20,
    };

    if (params.query) queryParams.q = params.query;
    if (params.brand) queryParams.brand = params.brand;
    if (params.category) queryParams.category = params.category;
    if (params.gender) queryParams.gender = params.gender;
    if (params.priceMin !== undefined) queryParams.price_min = params.priceMin;
    if (params.priceMax !== undefined) queryParams.price_max = params.priceMax;
    if (params.size) queryParams.size = params.size;
    if (params.condition) queryParams.condition = params.condition;
    if (params.sort) queryParams.sort = params.sort;

    const response = await this.client.get<{
      results: GoatProduct[];
      total: number;
      page: number;
      limit: number;
    }>('/search', queryParams);

    return {
      ...response,
      hasMore: response.page * response.limit < response.total,
    };
  }

  /**
   * Get detailed product information by slug
   *
   * @example
   * const product = await productsService.getBySlug('air-jordan-1-retro-high-og-chicago');
   */
  async getBySlug(slug: string): Promise<GoatProduct> {
    return this.client.get<GoatProduct>(`/product_templates/${slug}/show_v2`);
  }

  /**
   * Get product by SKU
   *
   * @example
   * const product = await productsService.getBySku('555088-101');
   */
  async getBySku(sku: string): Promise<GoatProduct | null> {
    const results = await this.search({ query: sku, limit: 1 });
    return results.results.length > 0 ? results.results[0] : null;
  }

  /**
   * Get product by internal ID
   */
  async getById(productId: string): Promise<GoatProduct> {
    return this.client.get<GoatProduct>(`/product_templates/${productId}`);
  }

  // ==========================================================================
  // Product Variants & Sizing
  // ==========================================================================

  /**
   * Get all available variants (sizes) for a product with pricing
   *
   * @example
   * const variants = await productsService.getVariants('12345', 'GB');
   * // Returns pricing for all sizes in GBP
   */
  async getVariants(
    productTemplateId: string,
    countryCode: string = 'GB'
  ): Promise<GoatProductVariant[]> {
    const data = await this.client.get<{ variants: GoatProductVariant[] }>(
      '/product_variants',
      { productTemplateId, countryCode }
    );

    return data.variants || [];
  }

  /**
   * Get buy bar data (ask/bid/last sale) for all sizes
   * This is the primary endpoint for live pricing data
   *
   * @example
   * const buyBarData = await productsService.getBuyBarData('12345');
   * buyBarData.variants.forEach(v => {
   *   console.log(`${v.size}: Ask £${v.lowestAsk}, Bid £${v.highestBid}`);
   * });
   */
  async getBuyBarData(
    productTemplateId: string,
    countryCode: string = 'GB'
  ): Promise<GoatBuyBarData> {
    return this.client.get<GoatBuyBarData>(
      '/product_variants/buy_bar_data',
      { productTemplateId, countryCode }
    );
  }

  /**
   * Get lowest ask price for a specific size
   *
   * @example
   * const lowestAsk = await productsService.getLowestAsk('12345', 'UK9');
   * console.log(`Lowest ask: £${lowestAsk}`);
   */
  async getLowestAsk(
    productTemplateId: string,
    size: string,
    countryCode: string = 'GB'
  ): Promise<number | null> {
    const buyBarData = await this.getBuyBarData(productTemplateId, countryCode);
    const variant = buyBarData.variants.find((v) => v.size === size);
    return variant?.lowestAsk || null;
  }

  /**
   * Get highest bid price for a specific size
   */
  async getHighestBid(
    productTemplateId: string,
    size: string,
    countryCode: string = 'GB'
  ): Promise<number | null> {
    const buyBarData = await this.getBuyBarData(productTemplateId, countryCode);
    const variant = buyBarData.variants.find((v) => v.size === size);
    return variant?.highestBid || null;
  }

  // ==========================================================================
  // Market Data & Pricing
  // ==========================================================================

  /**
   * Get historical price data for a product/size
   *
   * @example
   * const history = await productsService.getPriceHistory(
   *   'air-jordan-1-chicago',
   *   'UK9',
   *   '30d'
   * );
   */
  async getPriceHistory(
    slug: string,
    size: string,
    period: '7d' | '30d' | '90d' | '1y' = '30d'
  ): Promise<GoatPriceHistory> {
    return this.client.get<GoatPriceHistory>(
      `/products/${slug}/price_history`,
      { size, period }
    );
  }

  /**
   * Get sales history for a product
   *
   * @example
   * const sales = await productsService.getSalesHistory({
   *   sku: '555088-101',
   *   size: 'UK9',
   *   from: '2025-01-01',
   *   limit: 50
   * });
   */
  async getSalesHistory(params: GoatSalesHistoryParams): Promise<GoatSale[]> {
    const queryParams: Record<string, any> = {
      limit: params.limit || 50,
    };

    if (params.size) queryParams.size = params.size;
    if (params.condition) queryParams.condition = params.condition;
    if (params.from) queryParams.from = params.from;
    if (params.to) queryParams.to = params.to;

    const response = await this.client.get<{ sales: GoatSale[] }>(
      `/products/${params.sku}/sales`,
      queryParams
    );

    return response.sales || [];
  }

  /**
   * Get last sale price for a product/size
   *
   * @example
   * const lastSale = await productsService.getLastSalePrice('12345', 'UK9');
   * console.log(`Last sale: £${lastSale}`);
   */
  async getLastSalePrice(
    productTemplateId: string,
    size: string,
    countryCode: string = 'GB'
  ): Promise<number | null> {
    const buyBarData = await this.getBuyBarData(productTemplateId, countryCode);
    const variant = buyBarData.variants.find((v) => v.size === size);
    return variant?.lastSale || null;
  }

  /**
   * Get market depth (full order book) for a product/size
   * Shows all active asks and bids
   *
   * @example
   * const depth = await productsService.getMarketDepth('555088-101', 'UK9');
   * console.log(`${depth.asks.length} asks, ${depth.bids.length} bids`);
   * console.log(`Spread: £${depth.spread} (${depth.spreadPct}%)`);
   */
  async getMarketDepth(sku: string, size: string): Promise<GoatMarketDepth> {
    return this.client.get<GoatMarketDepth>(
      `/products/${sku}/market_depth`,
      { size }
    );
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Check if a product/size is available (has active asks)
   */
  async isAvailable(
    productTemplateId: string,
    size: string,
    countryCode: string = 'GB'
  ): Promise<boolean> {
    const lowestAsk = await this.getLowestAsk(productTemplateId, size, countryCode);
    return lowestAsk !== null && lowestAsk > 0;
  }

  /**
   * Get spread (difference between ask and bid) for a size
   * Returns null if no bid or ask available
   */
  async getSpread(
    productTemplateId: string,
    size: string,
    countryCode: string = 'GB'
  ): Promise<{ absolute: number; percentage: number } | null> {
    const buyBarData = await this.getBuyBarData(productTemplateId, countryCode);
    const variant = buyBarData.variants.find((v) => v.size === size);

    if (!variant?.lowestAsk || !variant?.highestBid) {
      return null;
    }

    const absolute = variant.lowestAsk - variant.highestBid;
    const percentage = (absolute / variant.highestBid) * 100;

    return { absolute, percentage };
  }

  /**
   * Get sales velocity (sales per day) for a product/size
   * Based on last 72 hours
   */
  async getSalesVelocity(
    productTemplateId: string,
    size: string,
    countryCode: string = 'GB'
  ): Promise<number> {
    const buyBarData = await this.getBuyBarData(productTemplateId, countryCode);
    const variant = buyBarData.variants.find((v) => v.size === size);

    if (!variant?.salesLast72h) {
      return 0;
    }

    // Sales per day = (sales in 72h) / 3
    return variant.salesLast72h / 3;
  }

  /**
   * Get liquidity score (0-100) based on number of asks/bids
   * Higher = more liquid market
   */
  async getLiquidityScore(
    productTemplateId: string,
    size: string,
    countryCode: string = 'GB'
  ): Promise<number> {
    const buyBarData = await this.getBuyBarData(productTemplateId, countryCode);
    const variant = buyBarData.variants.find((v) => v.size === size);

    if (!variant) {
      return 0;
    }

    // Simple liquidity score: (asks + bids) / 2, capped at 100
    const totalOrders = (variant.askCount || 0) + (variant.bidCount || 0);
    return Math.min(totalOrders / 2, 100);
  }

  /**
   * Enrich local product catalog entry with GOAT data
   * Useful for syncing product_catalog table
   *
   * @example
   * const enriched = await productsService.enrichProduct('555088-101');
   * await supabase.from('product_catalog').upsert({
   *   sku: enriched.sku,
   *   brand: enriched.brand,
   *   model: enriched.model,
   *   ...
   * });
   */
  async enrichProduct(sku: string): Promise<Partial<GoatProduct> | null> {
    const product = await this.getBySku(sku);

    if (!product) {
      return null;
    }

    return {
      sku: product.sku,
      brand: product.brand,
      model: product.model,
      colorway: product.colorway,
      retailPrice: product.retailPrice,
      retailCurrency: product.retailCurrency,
      releaseDate: product.releaseDate,
      mainPictureUrl: product.mainPictureUrl,
      category: product.category,
      gender: product.gender,
    };
  }
}
