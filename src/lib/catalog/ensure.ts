/**
 * DEPRECATED - STABILISATION MODE
 *
 * This auto-heal system is DISABLED to prevent catalog corruption.
 * Use the canonical createOrUpdateProductFromStockx function instead.
 *
 * @deprecated Use src/lib/catalog/stockx.ts instead
 */

import { createClient } from '@/lib/supabase/service'
import { normalizeSku } from '@/lib/utils/sku-normalize'

// ============================================================================
// Types
// ============================================================================

export interface EnsureCatalogResult {
  success: boolean
  catalogItemSku?: string
  created: boolean
  error?: string
  source?: 'existing' | 'stockx' | 'alias'
}

// ============================================================================
// Core Function
// ============================================================================

/**
 * Ensure a product exists in product_catalog for the given SKU.
 *
 * Auto-creates the catalog entry if missing by:
 * 1. Searching StockX
 * 2. Falling back to Alias if StockX fails
 * 3. Creating minimal entry if both fail
 *
 * @param sku - Product SKU (will be normalized)
 * @param userId - Optional user ID for OAuth-based searches
 * @returns Result with catalog item ID
 */
export async function ensureProductInCatalogForSku(
  sku: string,
  userId?: string
): Promise<EnsureCatalogResult> {
  console.log('[Catalog DISABLED] Auto-heal is disabled. Use createOrUpdateProductFromStockx instead:', sku)

  try {
    const normalizedSku = normalizeSku(sku)
    const supabase = createClient()

    // ONLY check if catalog entry exists - DO NOT CREATE
    const { data: existing, error: queryError } = await supabase
      .from('product_catalog')
      .select('sku, brand, model')
      .eq('sku', normalizedSku)
      .maybeSingle()

    if (queryError) {
      console.error('[Catalog] Query error:', queryError)
      return {
        success: false,
        created: false,
        error: `Database query failed: ${queryError.message}`,
      }
    }

    if (existing) {
      console.log('[Catalog] ✅ Catalog entry exists:', existing.sku)
      return {
        success: true,
        catalogItemSku: existing.sku,
        created: false,
        source: 'existing',
      }
    }

    // AUTO-HEAL DISABLED - Return error instead of creating placeholder
    console.error('[Catalog] ❌ No catalog entry found and auto-heal is disabled:', normalizedSku)
    return {
      success: false,
      created: false,
      error: 'Product not in catalog. Auto-heal disabled. Use Add Item flow to create products.',
    }

  } catch (error: any) {
    console.error('[Catalog] Unexpected error:', error)
    return {
      success: false,
      created: false,
      error: error.message || 'Unexpected error',
    }
  }
}

// ============================================================================
// Search & Create Functions
// ============================================================================

/**
 * Search StockX and create catalog entry if found
 */
async function searchAndCreateFromStockX(
  sku: string,
  userId?: string
): Promise<EnsureCatalogResult> {
  try {
    // Dynamic import to avoid circular dependencies
    const { StockxCatalogService } = await import('@/lib/services/stockx/catalog')

    // Pass userId only if it's a valid string, otherwise use client credentials
    const catalogService = new StockxCatalogService(userId || undefined)
    const searchResults = await catalogService.searchProducts(sku, { limit: 1 })

    if (!searchResults || searchResults.length === 0) {
      console.log('[Catalog Auto-Heal] No StockX results found for:', sku)
      return {
        success: false,
        created: false,
        error: 'No StockX results',
      }
    }

    const product = searchResults[0]

    // Create catalog entry from StockX data
    const supabase = createClient()

    // Use upsert to handle race conditions
    const { data: newCatalog, error: insertError } = await supabase
      .from('product_catalog')
      .upsert({
        sku: sku,
        brand: product.brand || 'Unknown',
        model: product.productName || 'Unknown Model',
        colorway: product.colorway || null,
        image_url: product.image || null,
        retail_price: product.retailPrice || null,
        retail_currency: 'USD',
        release_date: product.releaseDate || null,
      }, {
        onConflict: 'sku',
        ignoreDuplicates: false, // Update if exists to ensure latest StockX data
      })
      .select('sku')
      .maybeSingle()

    if (insertError) {
      console.error('[Catalog Auto-Heal] Failed to insert from StockX:', insertError)
      return {
        success: false,
        created: false,
        error: `Insert failed: ${insertError.message}`,
      }
    }

    if (!newCatalog) {
      console.error('[Catalog Auto-Heal] Upsert returned no data')
      return {
        success: false,
        created: false,
        error: 'Upsert returned no data',
      }
    }

    // Also create StockX product mapping
    if (product.productId) {
      const { upsertStockxProduct } = await import('@/lib/market/upsert')
      await upsertStockxProduct({
        stockxProductId: product.productId,
        brand: product.brand,
        title: product.productName,
        colorway: product.colorway,
        imageUrl: product.image,
        category: product.category,
        styleId: product.styleId,
      }).catch(err => console.error('[Catalog Auto-Heal] Failed to upsert StockX product:', err))
    }

    console.log('[Catalog Auto-Heal] ✅ Created catalog from StockX:', newCatalog.sku)

    return {
      success: true,
      catalogItemSku: newCatalog.sku,
      created: true,
      source: 'stockx',
    }

  } catch (error: any) {
    console.error('[Catalog Auto-Heal] StockX search error:', error)
    return {
      success: false,
      created: false,
      error: error.message,
    }
  }
}

/**
 * Search Alias and create catalog entry if found
 * NOTE: Currently disabled - Alias search service not implemented yet
 */
async function searchAndCreateFromAlias(
  sku: string
): Promise<EnsureCatalogResult> {
  // TODO: Implement Alias search when service is available
  console.log('[Catalog Auto-Heal] Alias search not yet implemented')
  return {
    success: false,
    created: false,
    error: 'Alias search not implemented',
  }
}

/**
 * Create minimal catalog entry when all searches fail
 */
async function createMinimalCatalogEntry(
  sku: string
): Promise<EnsureCatalogResult> {
  try {
    const supabase = createClient()

    // Parse SKU to extract potential brand/model hints
    const skuParts = sku.split(/[\s-]+/)
    const potentialBrand = skuParts[0] || 'Unknown'

    // Use upsert to handle race conditions where entry might be created concurrently
    const { data: newCatalog, error: insertError } = await supabase
      .from('product_catalog')
      .upsert({
        sku: sku,
        brand: potentialBrand,
        model: `Product ${sku}`,
        colorway: null,
        image_url: null,
        retail_price: null,
        retail_currency: 'USD',
        release_date: null,
      }, {
        onConflict: 'sku',
        ignoreDuplicates: true, // Don't overwrite if already exists
      })
      .select('sku')
      .maybeSingle()

    if (insertError) {
      console.error('[Catalog Auto-Heal] Failed to create minimal entry:', insertError)
      return {
        success: false,
        created: false,
        error: `Failed to create minimal entry: ${insertError.message}`,
      }
    }

    // If no data returned, the entry already existed (ignoreDuplicates=true)
    if (!newCatalog) {
      console.log('[Catalog Auto-Heal] Entry already exists (race condition avoided):', sku)
      return {
        success: true,
        catalogItemSku: sku,
        created: false,
        source: 'existing',
      }
    }

    console.log('[Catalog Auto-Heal] ⚠️  Created minimal catalog entry (no search results):', newCatalog.sku)

    return {
      success: true,
      catalogItemSku: newCatalog.sku,
      created: true,
      source: 'alias', // Mark as alias to indicate it needs manual review
    }

  } catch (error: any) {
    console.error('[Catalog Auto-Heal] Failed to create minimal entry:', error)
    return {
      success: false,
      created: false,
      error: error.message,
    }
  }
}

// ============================================================================
// Helper: SKU Normalization
// ============================================================================

// Note: This should ideally be in @/lib/utils/sku.ts
// If it doesn't exist, we define it here
function normalizeSku(sku: string): string {
  return sku
    .toUpperCase()
    .replace(/[-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
