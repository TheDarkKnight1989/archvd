// Main pricing API

import type { Category } from '../portfolio/types';
import type { PriceLookupResult, PriceData, ProductInfo } from './types';
import { getProvidersForCategory, getPrimaryProvider } from './router';
import { aggregatePrices } from './aggregate';
import * as stockx from './providers/stockx';
import * as laced from './providers/laced';
import * as ebay from './providers/ebay';

/**
 * Quick lookup using primary provider only
 * Used for SKU blur enrichment in Add Item form
 */
export async function quickLookup(
  sku: string,
  category?: Category
): Promise<{
  product?: ProductInfo;
  price?: number;
}> {
  const primaryProvider = getPrimaryProvider(category);

  let result;
  switch (primaryProvider) {
    case 'stockx':
      result = await stockx.lookupBySKU(sku);
      break;
    case 'laced':
      result = await laced.lookupBySKU(sku);
      break;
    case 'ebay':
      result = await ebay.lookupBySKU(sku);
      break;
    default:
      result = {};
  }

  return {
    product: result.product,
    price: result.price?.price,
  };
}

/**
 * Full lookup across multiple providers
 * Used for comprehensive pricing and refresh operations
 */
export async function fullLookup(
  sku: string,
  category?: Category
): Promise<PriceLookupResult> {
  const providers = getProvidersForCategory(category);
  const prices: PriceData[] = [];
  let productInfo: ProductInfo | undefined;

  // Try each provider in priority order
  for (const provider of providers) {
    try {
      let result;
      switch (provider) {
        case 'stockx':
          result = await stockx.lookupBySKU(sku);
          break;
        case 'laced':
          result = await laced.lookupBySKU(sku);
          break;
        case 'ebay':
          result = await ebay.lookupBySKU(sku);
          break;
        default:
          continue;
      }

      // Save product info from first successful lookup
      if (result.product && !productInfo) {
        productInfo = result.product;
      }

      // Add price if available
      if (result.price) {
        prices.push(result.price);
      }
    } catch (error: any) {
      console.error(`[${provider}] Error:`, error.message);
    }
  }

  // Aggregate prices if multiple sources
  const aggregated = prices.length > 0
    ? aggregatePrices(prices, category)
    : undefined;

  return {
    product: productInfo,
    prices,
    aggregated,
  };
}

/**
 * Batch refresh prices for multiple items
 * Used by nightly cron job
 */
export async function batchRefresh(
  items: Array<{ sku: string; category?: Category }>
): Promise<Map<string, PriceLookupResult>> {
  const results = new Map<string, PriceLookupResult>();

  for (const item of items) {
    const result = await fullLookup(item.sku, item.category);
    results.set(item.sku, result);

    // Rate limit between items
    if (items.indexOf(item) < items.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return results;
}

// Re-export utilities
export { formatSources, formatTimestamp } from './aggregate';
export { getProviderName } from './router';
export type { PriceLookupResult, PriceData, AggregatedPrice, ProductInfo } from './types';
