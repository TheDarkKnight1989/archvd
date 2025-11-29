/**
 * Alias SKU Matching Service
 * Match inventory items to Alias catalog using SKU and product details
 *
 * ⚠️ IMPORTANT: This service is SUGGEST-ONLY
 * - Does NOT write to database automatically
 * - Does NOT create inventory_alias_links entries
 * - Only returns match suggestions with confidence scores
 * - Manual approval required before persisting any matches
 */

import { AliasClient } from './client';
import type { AliasCatalogItem } from './types';

export interface MatchResult {
  catalogId: string | null;
  confidence: number;
  catalogItem?: AliasCatalogItem;
  matchMethod?: 'exact_sku' | 'normalized_sku' | 'search_sku' | 'search_name' | 'manual';
  searchResults?: AliasCatalogItem[];
}

export interface InventoryItemForMatching {
  sku?: string | null;
  productName?: string | null;
  brand?: string | null;
  size?: string | null;
}

/**
 * Normalize SKU by removing spaces, dashes, and converting to uppercase
 */
function normalizeSKU(sku: string): string {
  return sku
    .replace(/[\s-]/g, '') // Remove spaces and dashes
    .toUpperCase()
    .trim();
}

/**
 * Calculate string similarity using Levenshtein distance
 * Returns value between 0 (completely different) and 1 (identical)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Calculate Levenshtein distance
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const maxLen = Math.max(len1, len2);
  const distance = matrix[len1][len2];
  return 1 - distance / maxLen;
}

/**
 * Match inventory item to Alias catalog item
 */
export async function matchInventoryToAliasCatalog(
  client: AliasClient,
  inventoryItem: InventoryItemForMatching
): Promise<MatchResult> {
  const { sku, productName, brand } = inventoryItem;

  // ============================================================================
  // Method 1: Exact SKU match (confidence: 1.0)
  // ============================================================================
  if (sku && sku.trim() !== '') {
    try {
      const searchResponse = await client.searchCatalog(sku.trim(), { limit: 5 });

      for (const item of searchResponse.catalog_items) {
        if (item.sku.toUpperCase() === sku.trim().toUpperCase()) {
          return {
            catalogId: item.catalog_id,
            confidence: 1.0,
            catalogItem: item,
            matchMethod: 'exact_sku',
          };
        }
      }
    } catch (error) {
      console.warn('[Alias Matching] Exact SKU search failed:', error);
    }

    // ============================================================================
    // Method 2: Normalized SKU match (confidence: 0.95)
    // ============================================================================
    const normalizedSKU = normalizeSKU(sku);

    try {
      const searchResponse = await client.searchCatalog(sku.trim(), { limit: 10 });

      for (const item of searchResponse.catalog_items) {
        if (normalizeSKU(item.sku) === normalizedSKU) {
          return {
            catalogId: item.catalog_id,
            confidence: 0.95,
            catalogItem: item,
            matchMethod: 'normalized_sku',
          };
        }
      }
    } catch (error) {
      console.warn('[Alias Matching] Normalized SKU search failed:', error);
    }

    // ============================================================================
    // Method 3: Best SKU search result (confidence: 0.85)
    // ============================================================================
    try {
      const searchResponse = await client.searchCatalog(sku.trim(), { limit: 5 });

      if (searchResponse.catalog_items.length > 0) {
        const bestMatch = searchResponse.catalog_items[0];

        // Calculate SKU similarity
        const similarity = calculateSimilarity(
          normalizeSKU(sku),
          normalizeSKU(bestMatch.sku)
        );

        // If similarity is high enough, return as match
        if (similarity >= 0.7) {
          return {
            catalogId: bestMatch.catalog_id,
            confidence: 0.85 * similarity, // Adjust confidence by similarity
            catalogItem: bestMatch,
            matchMethod: 'search_sku',
            searchResults: searchResponse.catalog_items,
          };
        }
      }
    } catch (error) {
      console.warn('[Alias Matching] SKU search failed:', error);
    }
  }

  // ============================================================================
  // Method 4: Product name search (confidence: 0.70)
  // ============================================================================
  if (productName && productName.trim() !== '') {
    try {
      const searchQuery = brand
        ? `${brand} ${productName}`.trim()
        : productName.trim();

      const searchResponse = await client.searchCatalog(searchQuery, { limit: 5 });

      if (searchResponse.catalog_items.length > 0) {
        const bestMatch = searchResponse.catalog_items[0];

        // Calculate name similarity
        const nameSimilarity = calculateSimilarity(
          productName.toLowerCase(),
          bestMatch.name.toLowerCase()
        );

        // If similarity is decent, return as potential match
        if (nameSimilarity >= 0.6) {
          return {
            catalogId: bestMatch.catalog_id,
            confidence: 0.70 * nameSimilarity,
            catalogItem: bestMatch,
            matchMethod: 'search_name',
            searchResults: searchResponse.catalog_items,
          };
        }
      }
    } catch (error) {
      console.warn('[Alias Matching] Product name search failed:', error);
    }
  }

  // ============================================================================
  // No match found - requires manual mapping
  // ============================================================================
  return {
    catalogId: null,
    confidence: 0.0,
    matchMethod: 'manual',
  };
}

/**
 * Batch match multiple inventory items
 */
export async function batchMatchInventory(
  client: AliasClient,
  inventoryItems: InventoryItemForMatching[]
): Promise<MatchResult[]> {
  const results: MatchResult[] = [];

  for (const item of inventoryItems) {
    try {
      const result = await matchInventoryToAliasCatalog(client, item);
      results.push(result);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('[Alias Matching] Batch match error:', error);
      results.push({
        catalogId: null,
        confidence: 0.0,
        matchMethod: 'manual',
      });
    }
  }

  return results;
}

/**
 * Get recommended confidence threshold for suggestions
 * This is informational only - ALL matches require manual approval
 *
 * @deprecated Auto-mapping is disabled. This function is for reference only.
 */
export function getConfidenceThreshold(): number {
  return 0.85;
}

/**
 * Check if a match result has high confidence
 * Note: Even high-confidence matches require manual approval before persisting
 *
 * @deprecated Auto-mapping is disabled. Use this only for UI indication.
 */
export function isHighConfidenceMatch(result: MatchResult): boolean {
  return result.confidence >= getConfidenceThreshold() && result.catalogId !== null;
}

/**
 * @deprecated Auto-mapping is disabled. Use isHighConfidenceMatch() instead.
 */
export function shouldAutoMap(result: MatchResult): boolean {
  console.warn('[Alias Matching] shouldAutoMap() is deprecated - auto-mapping is disabled');
  return false; // Always return false - no auto-mapping allowed
}

/**
 * @deprecated Auto-mapping is disabled. Use getConfidenceThreshold() instead.
 */
export function getAutoMapThreshold(): number {
  console.warn('[Alias Matching] getAutoMapThreshold() is deprecated - auto-mapping is disabled');
  return getConfidenceThreshold();
}
