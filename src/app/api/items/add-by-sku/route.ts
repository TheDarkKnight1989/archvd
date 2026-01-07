/**
 * Add Inventory Item by SKU + Size
 * POST /api/items/add-by-sku
 *
 * STABILISATION MODE - SIMPLE FLOW:
 * 1. Search StockX for product by SKU
 * 2. Insert product + variants to DB (if not exists)
 * 3. Find correct variant using size conversion
 * 4. Create Inventory row with fields from StockX
 * 5. Create inventory_market_links row
 * 6. Return item details
 *
 * NO experimental sync/refresh - market data populated by next manual sync
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@/lib/supabase/service'
import { findVariantBySize } from '@/lib/stockx/findVariantBySize'
import { currencyToRegion, getAliasRegion, getStockxCountryCode } from '@/lib/utils/region'
import type { Currency } from '@/hooks/useCurrency'
// STABILISATION MODE: Using canonical createOrUpdateProductFromStockx function

// Input validation schema
const requestSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  size: z.string().min(1, 'Size is required'),
  sizeSystem: z.enum(['UK', 'US', 'EU']),
  purchasePrice: z.number().positive('Purchase price must be positive'),
  purchaseDate: z.string().min(1, 'Purchase date is required'),
  tax: z.number().optional(),
  shipping: z.number().optional(),
  placeOfPurchase: z.string().optional(),
  orderNumber: z.string().optional(),
  condition: z.enum(['new', 'used', 'worn', 'defect']).optional(),
  notes: z.string().max(250).optional(),
  currency: z.enum(['GBP', 'EUR', 'USD']).optional(), // User's selected currency (determines region)
  aliasCatalogId: z.string().optional(), // Alias catalog ID if known from search
  hasStockx: z.boolean().optional(), // Whether product has StockX data
})

type RequestBody = z.infer<typeof requestSchema>

/**
 * Check if a category indicates trading cards / TCG / collectible cards
 * Trading cards don't have shoe sizes but still get live StockX pricing
 */
function isTradingCardProduct(category: string | null | undefined): boolean {
  if (!category) return false
  const lower = category.toLowerCase()
  return lower.includes('trading card') ||
         lower.includes('trading-card') ||
         lower.includes('tcg') ||
         lower.includes('pokemon') ||
         lower.includes('pokémon') ||
         lower.includes('collectible card') ||
         lower.includes('sports card') ||
         lower === 'trading cards' ||
         lower === 'collectibles'
}

/**
 * Alias Fallback: Try to add item using Alias data when StockX fails
 * FIX: Use proper Alias catalog search endpoint (not old products/search)
 */
async function tryAliasFailback(
  input: RequestBody,
  userId: string,
  aliasRegion: string,
  serviceSupabase: ReturnType<typeof createServiceClient>
) {
  console.log('[Alias Fallback] Searching Alias for SKU:', input.sku)

  // FIX: If we already have the Alias catalog ID from search, use it directly
  if (input.aliasCatalogId) {
    console.log('[Alias Fallback] Using provided Alias catalog ID:', input.aliasCatalogId)

    // Import Alias client to fetch product details
    const { createAliasClient } = await import('@/lib/services/alias/client')
    const aliasClient = createAliasClient()

    try {
      // Fetch product by catalog ID
      const response = await fetch(`https://api.alias.org/api/v1/catalog/${input.aliasCatalogId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.ALIAS_PAT}`,
        },
      })

      if (response.ok) {
        const aliasMatch = await response.json()

        console.log('[Alias Fallback] ✅ Found product via catalog ID:', {
          catalogId: aliasMatch.catalog_id || input.aliasCatalogId,
          name: aliasMatch.name,
          brand: aliasMatch.brand,
        })

        // Continue with existing logic using aliasMatch
        return await createAliasInventoryItem(input, userId, aliasMatch, serviceSupabase)
      }
    } catch (error: any) {
      console.warn('[Alias Fallback] Failed to fetch by catalog ID:', error.message)
      // Fall through to SKU search
    }
  }

  // FIX: Use proper Alias catalog search endpoint
  const { createAliasClient } = await import('@/lib/services/alias/client')
  const aliasClient = createAliasClient()

  try {
    const searchResults = await aliasClient.searchCatalog(input.sku, { limit: 10 })

    if (!searchResults.catalog_items || searchResults.catalog_items.length === 0) {
      console.log('[Alias Fallback] No catalog items found for SKU:', input.sku)
      return { success: false, error: 'Product not found on Alias' }
    }

    // Normalize SKUs for matching
    const { normalizeSkuForMatching } = await import('@/lib/sku/normalizeSkuForMatching')
    const targetCanonical = normalizeSkuForMatching(input.sku)

    // Find exact SKU match (canonical comparison)
    const aliasMatch = searchResults.catalog_items.find((item: any) => {
      if (!item.sku) return false
      const itemCanonical = normalizeSkuForMatching(item.sku)
      return itemCanonical === targetCanonical
    })

    if (!aliasMatch) {
      console.log('[Alias Fallback] No exact SKU match found on Alias')
      return { success: false, error: 'Product not found on Alias' }
    }

    console.log('[Alias Fallback] ✅ Found product on Alias:', {
      catalogId: aliasMatch.catalog_id,
      name: aliasMatch.name,
      brand: aliasMatch.brand,
    })

    return await createAliasInventoryItem(input, userId, aliasMatch, serviceSupabase)
  } catch (error: any) {
    console.error('[Alias Fallback] Catalog search failed:', error.message)
    return { success: false, error: 'Alias search failed' }
  }
}

/**
 * Helper: Create inventory item from Alias data
 */
async function createAliasInventoryItem(
  input: RequestBody,
  userId: string,
  aliasMatch: any,
  serviceSupabase: ReturnType<typeof createServiceClient>
) {

  console.log('[Alias Fallback] ✅ Found product on Alias:', {
    catalogId: aliasMatch.catalog_id,
    name: aliasMatch.name,
    brand: aliasMatch.brand,
  })

  // Create inventory item directly (no StockX product catalog needed)
  const inventoryRow = {
    user_id: userId,
    sku: input.sku,
    brand: aliasMatch.brand || 'Unknown',
    model: aliasMatch.name || input.sku,
    colorway: aliasMatch.colorway || null,
    style_id: input.sku,
    size: input.size, // User's input size
    size_uk: input.sizeSystem === 'UK' ? input.size : null,
    size_alt: input.sizeSystem === 'EU' ? `${input.size} EU` : null,
    category: 'sneaker', // Default category
    condition: input.condition ? (input.condition.charAt(0).toUpperCase() + input.condition.slice(1)) as 'New' | 'Used' | 'Worn' | 'Defect' : 'New',
    purchase_price: input.purchasePrice,
    tax: input.tax || null,
    shipping: input.shipping || null,
    place_of_purchase: input.placeOfPurchase || null,
    purchase_date: input.purchaseDate ? new Date(input.purchaseDate) : null,
    order_number: input.orderNumber || null,
    notes: input.notes || null,
    status: 'active' as const,
  }

  const { data: inventoryItem, error: inventoryError } = await serviceSupabase
    .from('Inventory')
    .insert(inventoryRow)
    .select('*')
    .single()

  if (inventoryError) {
    console.error('[Alias Fallback] Failed to create inventory item:', inventoryError)
    return { success: false, error: 'Failed to create inventory item' }
  }

  console.log('[Alias Fallback] Inventory item created:', inventoryItem.id)

  // Create purchase transaction record
  if (input.purchasePrice && input.purchaseDate) {
    await serviceSupabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'purchase',
        inventory_id: inventoryItem.id,
        sku: input.sku,
        size_uk: input.sizeSystem === 'UK' ? input.size : null,
        title: aliasMatch.name || input.sku,
        image_url: aliasMatch.main_picture_url || null,
        qty: 1,
        unit_price: input.purchasePrice,
        fees: (input.tax || 0) + (input.shipping || 0),
        platform: input.placeOfPurchase || null,
        notes: input.notes || null,
        occurred_at: input.purchaseDate,
      })
  }

  // Upsert Alias catalog item
  await serviceSupabase
    .from('alias_catalog_items')
    .upsert({
      catalog_id: aliasMatch.catalog_id,
      slug: aliasMatch.slug || null,
      product_name: aliasMatch.name || input.sku,
      brand: aliasMatch.brand || 'Unknown',
      sku: input.sku,
      image_url: aliasMatch.main_picture_url || null,
      thumbnail_url: aliasMatch.thumbnail_url || null,
      category: aliasMatch.product_category_v2 || null,
      colorway: aliasMatch.colorway || null,
      retail_price_cents: aliasMatch.retail_price_cents || null,
      release_date: aliasMatch.release_date || null,
    }, {
      onConflict: 'catalog_id',
      ignoreDuplicates: false,
    })

  // Create inventory_alias_links entry
  await serviceSupabase
    .from('inventory_alias_links')
    .insert({
      inventory_id: inventoryItem.id,
      alias_catalog_id: aliasMatch.catalog_id,
      alias_sku: input.sku,
      alias_product_name: aliasMatch.name || input.sku,
      alias_brand: aliasMatch.brand || 'Unknown',
      match_confidence: 1.0,
      mapping_status: 'ok',
      last_sync_success_at: new Date().toISOString(),
    })

  console.log('[Alias Fallback] ✅ Complete - item added via Alias')

  return {
    success: true,
    data: {
      success: true,
      source: 'alias',
      item: {
        id: inventoryItem.id,
        sku: inventoryItem.sku,
        brand: inventoryItem.brand,
        model: inventoryItem.model,
        colorway: inventoryItem.colorway,
        size: input.sizeSystem === 'UK' ? inventoryItem.size_uk : inventoryItem.size,
        sizeSystem: input.sizeSystem,
        condition: inventoryItem.condition,
        purchasePrice: inventoryItem.purchase_price,
        purchaseDate: inventoryItem.purchase_date,
      },
      product: {
        catalogId: aliasMatch.catalog_id,
        sku: input.sku,
        brand: aliasMatch.brand,
        title: aliasMatch.name,
        colorway: aliasMatch.colorway,
        image: aliasMatch.main_picture_url,
        source: 'alias',
      },
    },
  }
}

export async function POST(request: Request) {
  try {
    // 1. Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse and validate request body
    const body = await request.json()
    const validationResult = requestSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: validationResult.error.flatten()
        },
        { status: 400 }
      )
    }

    const input: RequestBody = validationResult.data

    // Auto-normalize SKU: replace spaces with hyphens
    const normalizedSku = input.sku.trim().replace(/\s+/g, '-')
    input.sku = normalizedSku

    // Derive region from currency (defaults to UK if not provided)
    const currency: Currency = input.currency || 'GBP'
    const region = currencyToRegion(currency)
    const aliasRegion = getAliasRegion(region)
    const stockxCountryCode = getStockxCountryCode(region)

    // Create service client early (needed for both manual and Alias fallback paths)
    const serviceSupabase = createServiceClient()

    console.log('[Add by SKU] Starting:', {
      userId: user.id,
      sku: input.sku,
      normalizedSku,
      size: input.size,
      sizeSystem: input.sizeSystem,
      currency,
      region,
      aliasRegion,
      stockxCountryCode,
    })

    // Manual mode has been removed - only StockX-backed items are supported
    if ((input as any).mode === 'manual') {
      return NextResponse.json(
        { error: 'Manual mode is no longer supported', code: 'MANUAL_MODE_DISABLED' },
        { status: 400 }
      )
    }

    // Removed manual mode block - kept for reference but disabled
    if (false) {
      console.log('[ManualAddItemDebug] Manual mode - creating inventory item without catalog data')

      const serviceSupabase = createServiceClient()

      // Create minimal inventory row for apparel/accessories (no StockX/Alias catalog links)
      // MANUAL ITEM FIX: Normalize brand (null if not provided) and size (OS for "one size")

      // Normalize "one size" to "OS" consistently
      const rawSize = input.size.toString().trim()
      const normalisedSize = rawSize.toLowerCase() === 'one size' ? 'OS' : rawSize

      let sizeUk = normalisedSize
      let sizeAlt: string | null = null

      // Convert to UK size if needed (skip conversion for OS)
      if (normalisedSize !== 'OS') {
        if (input.sizeSystem === 'US') {
          sizeUk = (parseFloat(normalisedSize) - 0.5).toString() // US to UK conversion (approximate)
          sizeAlt = `${normalisedSize} US`
        } else if (input.sizeSystem === 'EU') {
          sizeUk = normalisedSize // For manual items, just use the size as-is
          sizeAlt = `${normalisedSize} EU`
        }
      }
      // If UK or OS, use as-is

      const inventoryRow = {
        user_id: user.id,
        sku: input.sku,
        // MANUAL FIX: Store null for brand if not provided (not "Unknown")
        brand: input.brand && input.brand.trim().length > 0 ? input.brand.trim() : null,
        // MANUAL FIX: Use user's name if provided, otherwise fall back to SKU
        model: input.name && input.name.trim().length > 0 ? input.name.trim() : input.sku.trim(),
        colorway: null,
        style_id: input.sku,
        size: normalisedSize,
        size_uk: sizeUk, // ALWAYS set (never null)
        size_alt: sizeAlt,
        category: 'other', // Default to "other" for manual items
        condition: input.condition ? (input.condition.charAt(0).toUpperCase() + input.condition.slice(1)) as 'New' | 'Used' | 'Worn' | 'Defect' : 'New',
        purchase_price: input.purchasePrice,
        tax: input.tax || null,
        shipping: input.shipping || null,
        place_of_purchase: input.placeOfPurchase || null,
        purchase_date: input.purchaseDate ? new Date(input.purchaseDate) : null,
        order_number: input.orderNumber || null,
        notes: input.notes || null,
        location: input.location || null,
        status: 'active' as const,
      }

      console.log('[ManualAddItemDebug] Inserting inventory row:', { ...inventoryRow, user_id: '***' })

      const { data: inventoryItem, error: inventoryError } = await serviceSupabase
        .from('Inventory')
        .insert(inventoryRow)
        .select('*')
        .single()

      if (inventoryError) {
        console.error('[ManualAddItemDebug] Manual mode - failed to create inventory item:', {
          error: inventoryError,
          message: inventoryError.message,
          details: inventoryError.details,
          hint: inventoryError.hint,
          code: inventoryError.code,
        })
        return NextResponse.json(
          {
            error: 'Failed to create inventory item',
            details: inventoryError.message,
            code: inventoryError.code,
          },
          { status: 500 }
        )
      }

      // STEP 1 DEBUG: Confirm manual insert result
      console.log('[ManualAddItemDebug] ✅ INSERT SUCCESS - Manual item saved to Inventory table:', {
        id: inventoryItem.id,
        sku: inventoryItem.sku,
        status: inventoryItem.status,
        category: inventoryItem.category,
        user_id: inventoryItem.user_id,
        brand: inventoryItem.brand,
        model: inventoryItem.model,
        size: inventoryItem.size,
        size_uk: inventoryItem.size_uk,
        purchase_price: inventoryItem.purchase_price,
        purchase_date: inventoryItem.purchase_date,
        table: 'Inventory',
      })

      // STEP 2 DEBUG: Verify row exists in DB by querying latest 5 items
      const { data: latestItems, error: latestError } = await serviceSupabase
        .from('Inventory')
        .select('id, sku, status, category, size, size_uk, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      console.log('[ManualAddItemDebug] ✅ Latest 5 inventory items from DB:', {
        count: latestItems?.length || 0,
        items: latestItems || [],
        error: latestError,
        justInsertedId: inventoryItem.id,
        isInLatest5: latestItems?.some(item => item.id === inventoryItem.id),
      })

      // Create purchase transaction record
      if (input.purchasePrice && input.purchaseDate) {
        console.log('[ManualAddItemDebug] Creating purchase transaction')
        const { error: transactionError } = await serviceSupabase
          .from('transactions')
          .insert({
            user_id: user.id,
            type: 'purchase',
            inventory_id: inventoryItem.id,
            sku: input.sku,
            size_uk: input.sizeSystem === 'UK' ? input.size : null,
            title: input.sku,
            image_url: null,
            qty: 1,
            unit_price: input.purchasePrice,
            fees: (input.tax || 0) + (input.shipping || 0),
            platform: input.placeOfPurchase || null,
            notes: input.notes || null,
            occurred_at: input.purchaseDate,
          })

        if (transactionError) {
          console.error('[ManualAddItemDebug] Transaction creation failed:', transactionError)
          // Don't fail the request - transaction is optional
        } else {
          console.log('[ManualAddItemDebug] Purchase transaction created')
        }
      }

      console.log('[ManualAddItemDebug] ✅ Manual mode - item added successfully, returning response')

      // FIX: Return consistent response structure matching normal path
      return NextResponse.json(
        {
          success: true,
          item: {
            id: inventoryItem.id,
            sku: inventoryItem.sku,
            brand: inventoryItem.brand,
            model: inventoryItem.model,
            colorway: inventoryItem.colorway,
            size: inventoryItem.size,
            sizeSystem: input.sizeSystem,
            condition: inventoryItem.condition,
            purchasePrice: inventoryItem.purchase_price,
            purchaseDate: inventoryItem.purchase_date,
          },
          // Manual items don't have product/variant data
          product: null,
          variant: null,
        },
        { status: 201 }
      )
    }

    // 3. CHECK IF THIS IS ALIAS-ONLY PRODUCT (skip StockX if we know it won't work)
    const isAliasOnly = input.hasStockx === false && input.aliasCatalogId

    if (isAliasOnly) {
      console.log('[Add by SKU] ⚡ Alias-only product detected, skipping StockX and going straight to Alias')

      const { normalizeSkuForMatching: normalizeSku } = await import('@/lib/sku/normalizeSkuForMatching')
      const normalizedInputSku = normalizeSku(input.sku)

      try {
        const aliasResult = await tryAliasFailback(input, user.id, aliasRegion, serviceSupabase)
        if (aliasResult.success) {
          console.log('[Add by SKU] ✅ Successfully added Alias-only item')
          return NextResponse.json(aliasResult.data, { status: 201 })
        } else {
          return NextResponse.json(
            {
              code: 'NOT_FOUND',
              error: `Product not found on Alias for SKU "${input.sku}". ${aliasResult.error}`,
            },
            { status: 404 }
          )
        }
      } catch (aliasError: any) {
        console.error('[Add by SKU] Alias-only add failed:', aliasError.message)
        return NextResponse.json(
          {
            code: 'NOT_FOUND',
            error: `Failed to add Alias-only product: ${aliasError.message}`,
          },
          { status: 404 }
        )
      }
    }

    // 4. CANONICAL FUNCTION: Create/update product catalog from StockX
    // This replaces all the old search/upsert logic - single source of truth
    const { createOrUpdateProductFromStockx } = await import('@/lib/catalog/stockx')

    console.log('[Add by SKU] Creating product catalog from StockX...')
    const catalogResult = await createOrUpdateProductFromStockx({
      sku: input.sku,
      userId: user.id,
      currency, // Use user's selected currency/region
    })

    // If StockX fails, try Alias as fallback
    if (!catalogResult.success) {
      console.log('[Add by SKU] StockX failed, trying Alias fallback...', catalogResult.error)

      // Import normalization for debug logging
      const { normalizeSkuForMatching: normalizeSku } = await import('@/lib/sku/normalizeSkuForMatching')
      const normalizedInputSku = normalizeSku(input.sku)

      try {
        const aliasResult = await tryAliasFailback(input, user.id, aliasRegion, serviceSupabase)
        if (aliasResult.success) {
          console.log('[Add by SKU] ✅ Successfully added item via Alias fallback')
          return NextResponse.json(aliasResult.data, { status: 201 })
        }
      } catch (aliasError: any) {
        console.error('[Add by SKU] Alias fallback also failed:', aliasError.message)
      }

      // Both StockX and Alias failed - log comprehensive debug info
      console.error('[AddItem NOT_FOUND DEBUG] ==================== NOT_FOUND ERROR ====================')
      console.error('[AddItem NOT_FOUND DEBUG] ❌ Item cannot be added - no matching product found')
      console.error('[AddItem NOT_FOUND DEBUG] SKU Details:', {
        rawSku: input.sku,
        normalizedSku: normalizedInputSku,
        currency: currency,
        region: region,
      })
      console.error('[AddItem NOT_FOUND DEBUG] StockX Error:', catalogResult.error)
      console.error('[AddItem NOT_FOUND DEBUG] Check logs above for:')
      console.error('[AddItem NOT_FOUND DEBUG]   - StockX search results')
      console.error('[AddItem NOT_FOUND DEBUG]   - Canonical SKU matching attempts')
      console.error('[AddItem NOT_FOUND DEBUG]   - Why no match was found')
      console.error('[AddItem NOT_FOUND DEBUG] ================================================================')

      return NextResponse.json(
        {
          code: 'NOT_FOUND',
          error: `Product not found on StockX or Alias for SKU "${input.sku}". Please check the SKU and try again.`,
        },
        { status: 404 }
      )
    }

    console.log('[Add by SKU] ✅ Product catalog created:', {
      catalogId: catalogResult.productCatalogId,
      stockxProductId: catalogResult.stockxProductId,
      variants: catalogResult.variantCount,
    })

    // 4. Fetch the created catalog data and variants for inventory creation
    const { data: catalogData, error: catalogFetchError} = await serviceSupabase
      .from('product_catalog')
      .select('*')
      .eq('id', catalogResult.productCatalogId)
      .single()

    if (catalogFetchError || !catalogData) {
      console.error('[Add by SKU] Failed to fetch catalog data:', catalogFetchError)
      return NextResponse.json(
        { error: 'Failed to fetch product data' },
        { status: 500 }
      )
    }

    // Check if this is a trading card product (no size variants needed)
    const isTradingCard = isTradingCardProduct(catalogData.category)
    console.log('[Add by SKU] Product type:', {
      category: catalogData.category,
      isTradingCard,
    })

    let matchingVariant: { variantId: string; variantValue: string } | null = null

    // 5. Trading cards: Skip variant matching (no shoe sizes)
    if (isTradingCard) {
      console.log('[Add by SKU] Trading card detected - skipping size variant matching')
      // Trading cards don't have size variants - will use stockx_variant_id = NULL in market link
    } else {
      // 5. Sneakers: Fetch variants from database and match by size
      const { data: variantsData, error: variantsError } = await serviceSupabase
        .from('stockx_variants')
        .select('*')
        .eq('stockx_product_id', catalogData.stockx_product_id)

      if (variantsError || !variantsData || variantsData.length === 0) {
        console.error('[Add by SKU] Failed to fetch variants:', variantsError)
        return NextResponse.json(
          {
            code: 'NOT_FOUND',
            message: 'Product found but has no size variants available.',
          },
          { status: 404 }
        )
      }

      // Convert DB variant format to match expected format for findVariantBySize
      const variants = variantsData.map(v => ({
        variantId: v.stockx_variant_id,
        variantName: v.size_display,
        variantValue: v.variant_value, // StockX size value (usually US)
        sizeChart: v.size_chart, // Size chart data with displayOptions for accurate matching
      }))

      console.log('[Add by SKU] Found variants:', variants.length)

      // 6. Find matching variant using size conversion system
      matchingVariant = findVariantBySize(
        input.size,
        input.sizeSystem,
        variants,
        catalogData.brand,
        catalogData.model
      )

      if (!matchingVariant) {
        return NextResponse.json(
          {
            code: 'NO_SIZE_MATCH',
            message: `Product found but size "${input.size}" (${input.sizeSystem}) is not available.`,
            availableSizes: variants.map(v => v.variantValue).sort(),
          },
          { status: 400 }
        )
      }

      console.log('[Add by SKU] Found matching variant:', {
        variantId: matchingVariant.variantId,
        size: matchingVariant.variantValue,
      })
    }

    // 7. Create Inventory row with fields from catalog

    // Prepare inventory row from catalog data
    const inventoryRow = {
      user_id: user.id,
      catalog_id: catalogData.id, // ✅ FIXED BUG #16: Link to product_catalog
      sku: catalogData.sku,
      brand: catalogData.brand,
      model: catalogData.model, // Full product name from catalog
      colorway: catalogData.colorway,
      style_id: catalogData.sku,
      size: isTradingCard ? 'OS' : (matchingVariant?.variantValue || 'OS'), // Trading cards: "OS" (one size)
      size_system: input.sizeSystem || null, // ✅ FIXED BUG #16: Save size system (UK/US/EU)
      size_uk: isTradingCard ? null : (input.sizeSystem === 'UK' ? input.size : null),
      size_alt: isTradingCard ? null : (input.sizeSystem === 'EU' ? `${input.size} EU` : null),
      category: isTradingCard ? 'trading-cards' : (catalogData.category === 'sneakers' ? 'sneaker' : (catalogData.category || 'other')),
      condition: input.condition ? (input.condition.charAt(0).toUpperCase() + input.condition.slice(1)) as 'New' | 'Used' | 'Worn' | 'Defect' : 'New',
      purchase_price: input.purchasePrice,
      purchase_currency: input.currency || 'GBP', // ✅ FIXED BUG #16: Save purchase currency
      tax: input.tax || null,
      shipping: input.shipping || null,
      place_of_purchase: input.placeOfPurchase || null,
      purchase_date: input.purchaseDate ? new Date(input.purchaseDate) : null,
      order_number: input.orderNumber || null,
      notes: input.notes || null,
      status: 'active' as const,
    }

    const { data: inventoryItem, error: inventoryError } = await serviceSupabase
      .from('Inventory')
      .insert(inventoryRow)
      .select('*')
      .single()

    if (inventoryError) {
      console.error('[Add by SKU] Failed to create inventory item:', inventoryError)
      return NextResponse.json(
        { error: 'Failed to create inventory item', details: inventoryError.message },
        { status: 500 }
      )
    }

    console.log('[Add by SKU] Inventory item created:', inventoryItem.id)

    // 8. Create purchase transaction record
    if (input.purchasePrice && input.purchaseDate) {
      const { error: transactionError } = await serviceSupabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: 'purchase',
          inventory_id: inventoryItem.id,
          sku: catalogData.sku,
          size_uk: input.sizeSystem === 'UK' ? input.size : null,
          title: catalogData.model,
          image_url: catalogData.image_url,
          qty: 1,
          unit_price: input.purchasePrice,
          fees: (input.tax || 0) + (input.shipping || 0),
          platform: input.placeOfPurchase || null,
          notes: input.notes || null,
          occurred_at: input.purchaseDate,
        })

      if (transactionError) {
        console.error('[Add by SKU] CRITICAL: Transaction creation failed:', {
          error: transactionError,
          code: transactionError.code,
          inventoryId: inventoryItem.id,
          purchasePrice: input.purchasePrice,
        })

        // BUG FIX #3: Don't silently continue - transaction history is critical
        // Without this, P/L calculations will be incorrect
        return NextResponse.json(
          {
            error: 'Failed to record purchase transaction',
            message: `Item added but transaction history not recorded: ${transactionError.message}`,
            code: 'TRANSACTION_FAILED',
          },
          { status: 500 }
        )
      }

      console.log('[Add by SKU] ✅ Purchase transaction created')
    }

    // 9. Create inventory_market_links row
    // Trading cards: stockx_variant_id = NULL (product-level pricing only)
    // Sneakers: stockx_variant_id = matched variant (size-specific pricing)
    console.log('[Add by SKU] Creating market link:', {
      itemId: inventoryItem.id,
      stockxProductId: catalogData.stockx_product_id,
      stockxVariantId: matchingVariant?.variantId || 'NULL (no size variant)',
      isTradingCard,
    })

    const { error: linkError } = await serviceSupabase
      .from('inventory_market_links')
      .insert({
        item_id: inventoryItem.id,
        user_id: user.id, // Required for the inventory_market_links table
        stockx_product_id: catalogData.stockx_product_id,
        stockx_variant_id: matchingVariant?.variantId || null, // NULL for trading cards
        mapping_status: 'ok',
      })

    if (linkError) {
      console.error('[Add by SKU] CRITICAL: Market link creation failed:', {
        error: linkError,
        code: linkError.code,
        message: linkError.message,
        isTradingCard,
        hadVariant: !!matchingVariant,
      })
      // BUG FIX #2: Don't silently continue - market links are critical for pricing
      return NextResponse.json(
        {
          error: 'Failed to create market data link',
          message: `Item added but pricing data link failed: ${linkError.message}`,
          code: 'MARKET_LINK_FAILED',
        },
        { status: 500 }
      )
    }

    console.log('[Add by SKU] ✅ Market link created successfully')

    // 10. Sync Alias market data (if available from search)
    // This ensures the inventory table shows both StockX and Alias prices
    let aliasCatalogId = input.aliasCatalogId

    if (!aliasCatalogId) {
      // Fallback: Search Alias if catalog ID wasn't provided
      console.log('[Add by SKU] No Alias catalog ID provided, searching Alias...')

      try {
        const apiBaseUrl = process.env.ALIAS_API_BASE_URL || 'https://api.alias.org'
        const aliasToken = process.env.ALIAS_PAT

        if (aliasToken) {
          const response = await fetch(`${apiBaseUrl}/products/search?query=${encodeURIComponent(catalogData.sku)}&region=${aliasRegion}`, {
            headers: {
              'Authorization': `Bearer ${aliasToken}`,
            },
          })

          if (response.ok) {
            const aliasData = await response.json()
            const aliasProducts = aliasData.products || []

            // Find exact SKU match
            const aliasMatch = aliasProducts.find((p: any) =>
              p.sku?.toLowerCase() === catalogData.sku.toLowerCase()
            )

            if (aliasMatch && aliasMatch.catalog_id) {
              aliasCatalogId = aliasMatch.catalog_id
              console.log('[Add by SKU] ✅ Found Alias product via search:', aliasCatalogId)
            } else {
              console.log('[Add by SKU] No Alias match found for SKU:', catalogData.sku)
            }
          }
        }
      } catch (aliasError: any) {
        console.warn('[Add by SKU] Alias search failed:', aliasError.message)
      }
    } else {
      console.log('[Add by SKU] Using Alias catalog ID from search:', aliasCatalogId)
    }

    // If we have an Alias catalog ID (from search or fallback), sync full market data
    if (aliasCatalogId) {
      try {
        console.log('[Add by SKU] Syncing Alias market data...')

        // Create inventory_alias_links entry first
        const { error: aliasLinkError } = await serviceSupabase
          .from('inventory_alias_links')
          .insert({
            inventory_id: inventoryItem.id,
            alias_catalog_id: aliasCatalogId,
            match_confidence: 1.0, // ✅ FIXED: Numeric value (0.0-1.0), not string
            mapping_status: 'ok',
          })

        if (aliasLinkError && aliasLinkError.code !== '23505') { // Ignore duplicate key errors
          console.warn('[Add by SKU] Failed to create Alias link:', aliasLinkError)
        } else {
          console.log('[Add by SKU] ✅ Alias link created')
        }

        // Sync full market data from Alias (all regions)
        const { syncAliasProductMultiRegion } = await import('@/lib/services/alias/sync')
        const { AliasClient } = await import('@/lib/services/alias/client')

        const aliasClient = new AliasClient(user.id)
        const syncResult = await syncAliasProductMultiRegion(
          aliasClient,
          aliasCatalogId,
          {
            sku: catalogData.sku,
            userRegion: aliasRegion,
            syncSecondaryRegions: true, // Sync all regions (US, UK, EU)
          }
        )

        if (syncResult.success) {
          console.log('[Add by SKU] ✅ Alias market data synced:', {
            totalVariants: syncResult.totalVariantsIngested,
            regions: Object.keys(syncResult.regionResults),
          })
        } else {
          console.warn('[Add by SKU] Alias sync failed:', syncResult.primaryResult.error)
        }
      } catch (aliasError: any) {
        console.warn('[Add by SKU] Alias sync error:', aliasError.message)
        // Continue - not critical for adding item
      }
    } else {
      console.log('[Add by SKU] No Alias catalog ID available, skipping Alias sync')
    }

    // 11. Sync StockX market data to master_market_data (all regions)
    // This ensures the inventory table shows StockX prices across all currencies
    console.log('[Add by SKU] Syncing StockX market data...')

    try {
      const { syncProductAllRegions } = await import('@/lib/services/stockx/market-refresh')

      const stockxSyncResult = await syncProductAllRegions(
        user.id,
        catalogData.stockx_product_id,
        region, // User's primary region
        true // Sync all secondary regions
      )

      if (stockxSyncResult.success) {
        console.log('[Add by SKU] ✅ StockX market data synced:', {
          totalSnapshots: stockxSyncResult.totalSnapshotsCreated,
          primaryRegion: stockxSyncResult.primaryRegion,
          secondaryRegions: Object.keys(stockxSyncResult.secondaryResults),
        })
      } else {
        console.warn('[Add by SKU] StockX sync failed:', stockxSyncResult.primaryResult.error)
      }
    } catch (marketError: any) {
      console.error('[Add by SKU] StockX market data sync failed:', marketError)
      // Don't fail the entire request if market data sync fails
    }

    // 12. Return success response
    return NextResponse.json({
      success: true,
      item: {
        id: inventoryItem.id,
        sku: inventoryItem.sku,
        brand: inventoryItem.brand,
        model: inventoryItem.model,
        colorway: inventoryItem.colorway,
        size: input.sizeSystem === 'UK' ? inventoryItem.size_uk : inventoryItem.size,
        sizeSystem: input.sizeSystem,
        condition: inventoryItem.condition,
        purchasePrice: inventoryItem.purchase_price,
        purchaseDate: inventoryItem.purchase_date,
      },
      product: {
        catalogId: catalogData.id,
        stockxProductId: catalogData.stockx_product_id,
        sku: catalogData.sku,
        brand: catalogData.brand,
        title: catalogData.model,
        colorway: catalogData.colorway,
        image: catalogData.image_url,
        category: catalogData.category,
        gender: catalogData.gender,
        retailPrice: catalogData.retail_price,
        releaseDate: catalogData.release_date,
      },
      // BUG FIX #10: Handle null variants for trading cards/Alias-only items
      variant: matchingVariant ? {
        variantId: matchingVariant.variantId,
        size: matchingVariant.variantValue,
      } : null,
      // Market data will be populated by next sync/view refresh
    }, { status: 201 })
  } catch (error: any) {
    console.error('[Add by SKU] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add item by SKU' },
      { status: 500 }
    )
  }
}
