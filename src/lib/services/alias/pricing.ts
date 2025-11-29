/**
 * Alias Pricing Service
 * Handles fetching pricing data from Alias API
 */

import { AliasClient } from './client';
import { STANDARD_ALIAS_PRICING_CONDITIONS } from './sync';
import type { AliasPricingVariant, ListPricingInsightsResponse } from './types';

export interface AliasAvailabilityVariant {
  size: number;
  lowestAskCents: number | null;
  highestBidCents: number | null;
  lastSoldCents: number | null;
}

/**
 * Get all size availabilities for a catalog item
 * LOCKED to NEW + GOOD_CONDITION (same as all other pricing)
 * NO region filtering, NO consigned filtering
 *
 * @param client - Alias API client
 * @param catalogId - Catalog ID to fetch availabilities for
 * @returns Array of availability variants for all sizes
 */
export async function listAvailabilitiesForCatalog(
  client: AliasClient,
  catalogId: string
): Promise<AliasAvailabilityVariant[]> {
  try {
    console.log(`[Alias Pricing] Fetching availabilities for catalog: ${catalogId}`);

    // Call the availabilities endpoint with no region/consigned filters
    // This uses the same locked conditions as everywhere else
    const response: ListPricingInsightsResponse = await client.listPricingInsights(
      catalogId,
      undefined, // no region_id
      undefined  // no consigned filter
    );

    // Filter to only NEW + GOOD_CONDITION variants
    // (API may return multiple condition variants, we only want our standard ones)
    const standardVariants = response.variants.filter(
      (v) =>
        v.product_condition === STANDARD_ALIAS_PRICING_CONDITIONS.product_condition &&
        v.packaging_condition === STANDARD_ALIAS_PRICING_CONDITIONS.packaging_condition
    );

    console.log(
      `[Alias Pricing] Found ${standardVariants.length} variants (NEW + GOOD_CONDITION) out of ${response.variants.length} total`
    );

    // Transform to our simplified format
    const availabilities: AliasAvailabilityVariant[] = standardVariants.map((variant) => ({
      size: variant.size,
      lowestAskCents: variant.availability.lowest_listing_price_cents
        ? parseInt(variant.availability.lowest_listing_price_cents, 10)
        : null,
      highestBidCents: variant.availability.highest_offer_price_cents
        ? parseInt(variant.availability.highest_offer_price_cents, 10)
        : null,
      lastSoldCents: variant.availability.last_sold_listing_price_cents
        ? parseInt(variant.availability.last_sold_listing_price_cents, 10)
        : null,
    }));

    // Filter out variants with no pricing data at all
    const withPricing = availabilities.filter(
      (v) => v.lowestAskCents !== null || v.highestBidCents !== null || v.lastSoldCents !== null
    );

    console.log(`[Alias Pricing] Returning ${withPricing.length} variants with pricing data`);

    return withPricing;
  } catch (error) {
    console.error('[Alias Pricing] Error fetching availabilities:', error);
    throw error;
  }
}
