// Category-based provider router

import type { Category } from '../portfolio/types';
import type { PriceProvider } from './types';

/**
 * Determine which providers to use based on item category
 * Priority order matters - first provider is tried first
 */
export function getProvidersForCategory(category?: Category): PriceProvider[] {
  switch (category) {
    case 'sneaker':
      // Sneakers: StockX first, then Laced (UK market)
      // Skip eBay for sneakers - not reliable for authentic market prices
      return ['stockx', 'laced'];

    case 'apparel':
      // Apparel: StockX for streetwear, then general marketplaces
      return ['stockx', 'laced'];

    case 'accessory':
      // Accessories: depends on type, but try StockX first
      return ['stockx', 'laced', 'ebay'];

    case 'other':
    default:
      // Unknown/Other: try all providers
      // This catches LEGO, Bearbrick, Jellycat, etc.
      return ['stockx', 'ebay', 'laced'];
  }
}

/**
 * Get provider display names
 */
export function getProviderName(provider: PriceProvider): string {
  const names: Record<PriceProvider, string> = {
    stockx: 'StockX',
    laced: 'Laced',
    restocks: 'Restocks',
    klekt: 'Klekt',
    ebay: 'eBay',
  };
  return names[provider] || provider;
}

/**
 * Check if provider should be used for category
 */
export function shouldUseProvider(provider: PriceProvider, category?: Category): boolean {
  const providers = getProvidersForCategory(category);
  return providers.includes(provider);
}

/**
 * Get primary provider for quick lookups
 */
export function getPrimaryProvider(category?: Category): PriceProvider {
  const providers = getProvidersForCategory(category);
  return providers[0]; // Return first (highest priority) provider
}
