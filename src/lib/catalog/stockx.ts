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
import { normalizeSkuForMatching } from '@/lib/sku/normalizeSkuForMatching'

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
    // PHASE 3: GENERIC SKU MATCHING
    // Use canonical normalization for consistent matching across all SKUs
    const canonicalInputSku = normalizeSkuForMatching(sku)

    if (canonicalInputSku === null) {
      console.error('[Catalog] ❌ Invalid SKU format:', sku)
      return {
        success: false,
        error: `Invalid SKU format: ${sku}`,
      }
    }

    const supabase = createServiceClient()

    // ========================================================================
    // Step 1: Search StockX for product (GBP currency)
    // ========================================================================

    console.log('[Catalog] Searching StockX with canonical SKU...')
    const catalogService = new StockxCatalogService(userId)

    console.log('[Catalog] 🔍 SEARCH DEBUG:', {
      originalSku: sku,
      canonicalSku: canonicalInputSku,
      currency: currency
    })

    // Search with the original SKU (let StockX do its own fuzzy matching)
    const searchResults = await catalogService.searchProducts(sku, {
      limit: 10, // Fetch more to account for variations
      currencyCode: currency
    })

    if (!searchResults || searchResults.length === 0) {
      console.error('[Catalog] ❌ No StockX results found for SKU:', sku)
      console.error('[Catalog] StockX returned 0 results - product does not exist on StockX')
      return {
        success: false,
        error: `Product not found on StockX for SKU: ${sku}`,
      }
    }

    // Log all results with their canonical SKUs for debugging
    console.log('[Catalog] 📦 StockX returned', searchResults.length, 'results')
    console.log('[Catalog] First 3 results:', searchResults.slice(0, 3).map(p => ({
      productId: p.productId,
      styleId: p.styleId,
      canonicalStyleId: normalizeSkuForMatching(p.styleId),
      productName: p.productName,
      brand: p.brand
    })))

    // PHASE 3: GENERIC MATCHING RULE
    // Find exact match using canonical SKU comparison
    let exactMatch = null
    let skippedInvalidCount = 0

    for (const product of searchResults) {
      const canonicalProductSku = normalizeSkuForMatching(product.styleId)

      // Skip products with invalid SKUs but count them
      if (canonicalProductSku === null) {
        console.warn('[Catalog] ⚠️ Skipping result with invalid SKU:', product.styleId)
        skippedInvalidCount++
        continue
      }

      // Match using canonical comparison
      if (canonicalProductSku === canonicalInputSku) {
        exactMatch = product
        console.log('[Catalog] ✅ Found canonical match:', {
          input: canonicalInputSku,
          matched: canonicalProductSku,
          productId: product.productId
        })
        break
      }
    }

    // FALLBACK: If canonical matching failed, try case-insensitive direct string match
    // This handles cases where normalization is too strict
    if (!exactMatch && skippedInvalidCount === 0) {
      console.log('[Catalog] 🔄 No canonical match, trying fallback matching (case-insensitive)...')
      const normalizedInput = sku.trim().toUpperCase().replace(/\s+/g, '-')

      for (const product of searchResults) {
        const normalizedProductSku = product.styleId.trim().toUpperCase().replace(/\s+/g, '-')

        if (normalizedProductSku === normalizedInput) {
          exactMatch = product
          console.log('[Catalog] ✅ Found fallback match:', {
            input: normalizedInput,
            matched: normalizedProductSku,
            productId: product.productId
          })
          break
        }
      }
    }

    if (!exactMatch) {
      console.error('[Catalog] ❌ No canonical SKU match found in StockX results')
      console.error('[Catalog] Input SKU:', sku)
      console.error('[Catalog] Canonical Input SKU:', canonicalInputSku)
      console.error('[Catalog] StockX results comparison:')
      searchResults.slice(0, 5).forEach((p, i) => {
        const canonical = normalizeSkuForMatching(p.styleId)
        console.error(`[Catalog]   [${i + 1}] ${p.styleId} → ${canonical} ${canonical === canonicalInputSku ? '✓ MATCH' : '✗ no match'}`)
      })
      console.error('[Catalog] Why this might happen:')
      console.error('[Catalog]   1. SKU normalization is too strict (filtering out valid matches)')
      console.error('[Catalog]   2. StockX uses a different SKU format than expected')
      console.error('[Catalog]   3. Product exists on StockX but with a different styleId')
      return {
        success: false,
        error: `No exact SKU match found on StockX for: ${sku}`,
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
    const { data: stockxProductData, error: productError } = await supabase
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
      .select('id')
      .single()

    if (productError || !stockxProductData) {
      console.error('[Catalog] Failed to upsert stockx_products:', productError)
      return {
        success: false,
        error: `Failed to save product: ${productError?.message || 'No data returned'}`,
      }
    }

    console.log('[Catalog] ✅ stockx_products upserted, id:', stockxProductData.id)

    // ========================================================================
    // Step 3: Create/update product_catalog with REAL data (MUST BE FIRST)
    // ========================================================================

    // BUG FIX #6: Validate SKU before upsert
    if (!product.styleId || product.styleId.trim() === '') {
      console.error('[Catalog] Invalid product styleId:', product)
      return {
        success: false,
        error: 'Product has no valid SKU (styleId is empty)',
      }
    }

    const productSku = product.styleId.trim()

    // Check for existing entry with different brand (data quality warning)
    const { data: existing } = await supabase
      .from('product_catalog')
      .select('brand, model, stockx_product_id')
      .eq('sku', productSku)
      .single()

    if (existing && existing.brand !== (product.brand || 'Unknown')) {
      console.warn('[Catalog] ⚠️ SKU collision detected:', {
        sku: productSku,
        existingBrand: existing.brand,
        existingModel: existing.model,
        newBrand: product.brand,
        newModel: product.productName,
        existingStockxId: existing.stockx_product_id,
        newStockxId: product.productId,
      })
      // Continue with update - StockX is source of truth
    }

    console.log('[Catalog] Upserting product_catalog...')
    const { data: catalogData, error: catalogError } = await supabase
      .from('product_catalog')
      .upsert({
        sku: productSku, // Use validated/trimmed SKU
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
    // Step 4: Fetch and upsert ALL variants (using product_id from stockx_products)
    // ========================================================================

    console.log('[Catalog] Fetching variants from StockX...')
    const variants = await catalogService.getProductVariants(product.productId)

    if (!variants || variants.length === 0) {
      console.warn('[Catalog] ⚠️ No variants found for product')
      // Continue anyway - some products might not have size variants
    } else {
      console.log('[Catalog] Found', variants.length, 'variants')

      // Upsert all variants with product_id from stockx_products (correct FK reference)
      for (const variant of variants) {
        const { error: variantError } = await supabase
          .from('stockx_variants')
          .upsert({
            product_id: stockxProductData.id, // ✅ FIXED: Use stockx_products.id (correct FK)
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
