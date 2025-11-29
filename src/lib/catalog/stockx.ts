/**
 * Canonical StockX Product Catalog Creation
 *
 * SINGLE SOURCE OF TRUTH for creating/updating product_catalog entries from StockX.
 * This is the ONLY allowed way to create catalog products.
 *
 * STABILISATION MODE - NO AUTO-HEAL, NO PLACEHOLDERS
 */

import { createClient as createServiceClient } from '@/lib/supabase/service'
import { StockxCatalogService } from '@/lib/services/stockx/catalog'
import { normalizeSku } from '@/lib/utils/sku-normalize'

// ============================================================================
// Types
// ============================================================================

export interface CreateProductResult {
  success: boolean
  productCatalogId?: string
  stockxProductId?: string
  variantCount?: number
  error?: string
}

export interface ProductCatalogData {
  id: string
  sku: string
  brand: string
  name: string
  primary_image_url: string | null
  stockx_product_id: string
  category?: string | null
  gender?: string | null
}

// ============================================================================
// Canonical Function
// ============================================================================

/**
 * Create or update a product in the catalog from StockX data
 *
 * This is the ONLY allowed way to create catalog entries.
 * NO placeholders, NO auto-heal - real StockX data or nothing.
 *
 * Process:
 * 1. Search StockX for product (with specified currency/region)
 * 2. If not found → return error (don't create placeholder)
 * 3. If found:
 *    - Upsert stockx_products
 *    - Upsert ALL variants to stockx_variants
 *    - Create/update product_catalog with real data
 *
 * @param options.sku - Product SKU (e.g., "DH3227-105")
 * @param options.userId - Optional user ID for OAuth (uses client credentials if not provided)
 * @param options.currency - Currency code for region-based search (defaults to GBP)
 * @returns Result with catalog ID and product details
 */
export async function createOrUpdateProductFromStockx({
  sku,
  userId,
  currency = 'GBP',
}: {
  sku: string
  userId?: string
  currency?: 'GBP' | 'EUR' | 'USD'
}): Promise<CreateProductResult> {
  console.log('[Catalog] Creating product from StockX:', { sku, userId: userId ? 'yes' : 'no' })

  try {
    const normalizedSku = normalizeSku(sku)
    const supabase = createServiceClient()

    // ========================================================================
    // Step 1: Search StockX for product (GBP currency)
    // ========================================================================

    console.log('[Catalog] Searching StockX...')
    const catalogService = new StockxCatalogService(userId)

    // Search with specified currency (determines region)
    const searchResults = await catalogService.searchProducts(normalizedSku, {
      limit: 5,
      currencyCode: currency
    })

    if (!searchResults || searchResults.length === 0) {
      console.error('[Catalog] ❌ No StockX results found for:', normalizedSku)
      return {
        success: false,
        error: `Product not found on StockX for SKU: ${normalizedSku}`,
      }
    }

    // Find exact SKU match
    const exactMatch = searchResults.find(
      p => normalizeSku(p.styleId) === normalizedSku
    )

    if (!exactMatch) {
      console.error('[Catalog] ❌ No exact SKU match found in StockX results')
      return {
        success: false,
        error: `No exact SKU match found on StockX for: ${normalizedSku}`,
      }
    }

    const product = exactMatch
    console.log('[Catalog] ✅ Found StockX product:', {
      productId: product.productId,
      styleId: product.styleId,
      title: product.productName,
    })

    // ========================================================================
    // Step 2: Upsert to stockx_products
    // ========================================================================

    console.log('[Catalog] Upserting stockx_products...')
    const { error: productError } = await supabase
      .from('stockx_products')
      .upsert({
        stockx_product_id: product.productId,
        brand: product.brand || 'Unknown',
        title: product.productName,
        colorway: product.colorway || null,
        style_id: product.styleId,
        image_url: product.image || null,
        thumb_url: product.image || null, // StockX doesn't separate thumb
        category: product.category || null,
        silhouette: null, // Not available in search results, can be populated later
        gender: product.gender || null,
        retail_price: product.retailPrice || null,
        release_date: product.releaseDate || null,
      }, {
        onConflict: 'stockx_product_id',
        ignoreDuplicates: false, // Always update with latest data
      })

    if (productError) {
      console.error('[Catalog] Failed to upsert stockx_products:', productError)
      return {
        success: false,
        error: `Failed to save product: ${productError.message}`,
      }
    }

    console.log('[Catalog] ✅ stockx_products upserted')

    // ========================================================================
    // Step 3: Fetch and upsert ALL variants
    // ========================================================================

    console.log('[Catalog] Fetching variants from StockX...')
    const variants = await catalogService.getProductVariants(product.productId)

    if (!variants || variants.length === 0) {
      console.warn('[Catalog] ⚠️ No variants found for product')
      // Continue anyway - some products might not have size variants
    } else {
      console.log('[Catalog] Found', variants.length, 'variants')

      // Upsert all variants
      for (const variant of variants) {
        const { error: variantError } = await supabase
          .from('stockx_variants')
          .upsert({
            stockx_variant_id: variant.variantId,
            stockx_product_id: product.productId,
            size_display: variant.variantName,
            variant_value: variant.variantValue, // StockX size value (usually US)
            size_chart: variant.sizeChart || null, // Store size chart data for accurate size matching
          }, {
            onConflict: 'stockx_variant_id',
            ignoreDuplicates: false,
          })

        if (variantError) {
          console.error('[Catalog] Failed to upsert variant:', variant.variantId, variantError)
          // Continue with other variants
        }
      }

      console.log('[Catalog] ✅ All variants upserted')
    }

    // ========================================================================
    // Step 4: Create/update product_catalog with REAL data
    // ========================================================================

    console.log('[Catalog] Upserting product_catalog...')
    const { data: catalogData, error: catalogError } = await supabase
      .from('product_catalog')
      .upsert({
        sku: normalizedSku,
        brand: product.brand || 'Unknown',
        model: product.productName, // Use full product name from StockX
        colorway: product.colorway || null,
        image_url: product.image || null,
        retail_price: product.retailPrice || null,
        retail_currency: 'USD', // StockX retail prices are in USD
        release_date: product.releaseDate || null,
        stockx_product_id: product.productId,
        category: product.category || null,
        gender: product.gender || null,
      }, {
        onConflict: 'sku',
        ignoreDuplicates: false, // Always update with latest data
      })
      .select('id, sku, brand, model, image_url, stockx_product_id')
      .single()

    if (catalogError) {
      console.error('[Catalog] Failed to upsert product_catalog:', catalogError)
      return {
        success: false,
        error: `Failed to save catalog entry: ${catalogError.message}`,
      }
    }

    console.log('[Catalog] ✅ product_catalog upserted:', {
      id: catalogData.id,
      sku: catalogData.sku,
      brand: catalogData.brand,
      model: catalogData.model,
    })

    // ========================================================================
    // Success
    // ========================================================================

    return {
      success: true,
      productCatalogId: catalogData.id,
      stockxProductId: product.productId,
      variantCount: variants?.length || 0,
    }

  } catch (error: any) {
    console.error('[Catalog] Unexpected error:', error)
    return {
      success: false,
      error: error.message || 'Unexpected error creating product',
    }
  }
}
