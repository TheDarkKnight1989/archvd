// Price aggregation logic

import type { PriceData, AggregatedPrice } from './types';
import type { Category } from '../portfolio/types';

/**
 * Aggregate multiple price sources into a single market value
 *
 * Rules for sneakers:
 * - If StockX available: use StockX (most reliable)
 * - If Laced available: use Laced (UK market)
 * - Average only if prices are within 20% of each other
 * - Flag low confidence if sources disagree significantly
 */
export function aggregatePrices(
  prices: PriceData[],
  category?: Category
): AggregatedPrice | null {
  if (prices.length === 0) {
    return null;
  }

  // Convert all prices to GBP for consistency
  const pricesInGBP = prices.map(convertToGBP);

  // For sneakers, prioritize StockX
  if (category === 'sneaker' || category === 'apparel') {
    const stockxPrice = pricesInGBP.find(p => p.provider === 'stockx');
    if (stockxPrice) {
      return {
        price: stockxPrice.price,
        sources_used: [stockxPrice.provider],
        timestamp: new Date(),
        confidence: 'high',
      };
    }

    const lacedPrice = pricesInGBP.find(p => p.provider === 'laced');
    if (lacedPrice) {
      return {
        price: lacedPrice.price,
        sources_used: [lacedPrice.provider],
        timestamp: new Date(),
        confidence: 'high',
      };
    }
  }

  // For other categories or when no priority provider available
  // Calculate average and check variance
  const priceValues = pricesInGBP.map(p => p.price);
  const avgPrice = priceValues.reduce((sum, p) => sum + p, 0) / priceValues.length;
  const maxPrice = Math.max(...priceValues);
  const minPrice = Math.min(...priceValues);
  const variance = (maxPrice - minPrice) / avgPrice;

  // If prices disagree by more than 20%, flag as low confidence
  let confidence: 'high' | 'medium' | 'low' = 'high';
  if (variance > 0.2) {
    confidence = 'medium';
  }
  if (variance > 0.4) {
    confidence = 'low';
  }

  // Use median for more robust aggregation when multiple sources
  const medianPrice = calculateMedian(priceValues);

  return {
    price: medianPrice,
    sources_used: pricesInGBP.map(p => p.provider),
    timestamp: new Date(),
    confidence,
  };
}

/**
 * Convert price to GBP
 */
function convertToGBP(priceData: PriceData): PriceData {
  if (priceData.currency === 'GBP') {
    return priceData;
  }

  // Simple conversion rates (in production, use live rates)
  const conversionRates: Record<string, number> = {
    USD: 0.79, // 1 USD = 0.79 GBP
    EUR: 0.86, // 1 EUR = 0.86 GBP
    GBP: 1.0,
  };

  const rate = conversionRates[priceData.currency] || 1.0;

  return {
    ...priceData,
    price: priceData.price * rate,
    currency: 'GBP',
  };
}

/**
 * Calculate median of array
 */
function calculateMedian(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

/**
 * Format sources for display
 */
export function formatSources(sources: string[]): string {
  if (sources.length === 0) return 'No sources';
  if (sources.length === 1) return sources[0];
  if (sources.length === 2) return sources.join(' & ');
  return `${sources.slice(0, -1).join(', ')} & ${sources[sources.length - 1]}`;
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return timestamp.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
