/**
 * GOAT API Service Layer
 *
 * Usage:
 *
 * ```typescript
 * import { createGoatClient, GoatProductsService, GoatListingsService } from '@/lib/services/goat';
 *
 * // Create authenticated client
 * const client = createGoatClient({
 *   accessToken: 'your-token-here'
 * });
 *
 * // Use services
 * const productsService = new GoatProductsService(client);
 * const listingsService = new GoatListingsService(client);
 *
 * // Search products
 * const results = await productsService.search({ query: 'Jordan 1' });
 *
 * // Get pricing
 * const buyBarData = await productsService.getBuyBarData('product-id');
 *
 * // Create listing
 * const listing = await listingsService.create({
 *   productId: 'product-id',
 *   size: 'UK9',
 *   price: 250
 * });
 * ```
 */

export { GoatClient, createGoatClient, createUserGoatClient } from './client';
export { GoatProductsService } from './products';
export { GoatListingsService } from './listings';

export type * from './types';

// Re-export common types for convenience
export type {
  GoatProduct,
  GoatListing,
  GoatOrder,
  GoatSearchParams,
  GoatSearchResult,
  GoatBuyBarData,
} from './types';
