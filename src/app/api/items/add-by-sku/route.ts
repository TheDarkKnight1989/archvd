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
})

type RequestBody = z.infer<typeof requestSchema>

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

    // Derive region from currency (defaults to UK if not provided)
    const currency: Currency = input.currency || 'GBP'
    const region = currencyToRegion(currency)
    const aliasRegion = getAliasRegion(region)
    const stockxCountryCode = getStockxCountryCode(region)

    console.log('[Add by SKU] Starting:', {
      userId: user.id,
      sku: input.sku,
      size: input.size,
      sizeSystem: input.sizeSystem,
      currency,
      region,
      aliasRegion,
      stockxCountryCode,
    })

    // 3. CANONICAL FUNCTION: Create/update product catalog from StockX
    // This replaces all the old search/upsert logic - single source of truth
    const { createOrUpdateProductFromStockx } = await import('@/lib/catalog/stockx')

    console.log('[Add by SKU] Creating product catalog from StockX...')
    const catalogResult = await createOrUpdateProductFromStockx({
      sku: input.sku,
      userId: user.id,
      currency, // Use user's selected currency/region
    })

    if (!catalogResult.success) {
      console.error('[Add by SKU] Failed to create catalog:', catalogResult.error)
      return NextResponse.json(
        {
          code: 'CATALOG_ERROR',
          error: catalogResult.error || 'Failed to create product catalog from StockX',
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
    const serviceSupabase = createServiceClient()

    const { data: catalogData, error: catalogFetchError } = await serviceSupabase
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

    // 5. Fetch variants from database (already upserted by canonical function)
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
    const matchingVariant = findVariantBySize(
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

    // 7. Create Inventory row with fields from catalog

    // Prepare inventory row from catalog data
    const inventoryRow = {
      user_id: user.id,
      sku: catalogData.sku,
      brand: catalogData.brand,
      model: catalogData.model, // Full product name from catalog
      colorway: catalogData.colorway,
      style_id: catalogData.sku,
      size: matchingVariant.variantValue, // US size from StockX
      size_uk: input.sizeSystem === 'UK' ? input.size : null,
      size_alt: input.sizeSystem === 'EU' ? `${input.size} EU` : null,
      category: catalogData.category === 'sneakers' ? 'sneaker' : (catalogData.category || 'other'),
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
        console.error('[Add by SKU] Transaction creation error:', transactionError)
        // Don't fail the request if transaction creation fails
      }
    }

    // 9. Create inventory_market_links row
    const { error: linkError } = await serviceSupabase
      .from('inventory_market_links')
      .insert({
        item_id: inventoryItem.id,
        stockx_product_id: catalogData.stockx_product_id,
        stockx_variant_id: matchingVariant.variantId,
      })

    if (linkError) {
      console.error('[Add by SKU] Failed to create market link:', linkError)
      // Don't fail the request if link creation fails
    } else {
      console.log('[Add by SKU] Market link created successfully')
    }

    // 10. Search Alias and create mapping for images
    // This ensures the inventory table shows Alias images (preferred source)
    console.log('[Add by SKU] Searching Alias for image mapping...')

    try {
      const apiBaseUrl = process.env.ALIAS_API_BASE_URL || 'https://api.alias.org'
      const aliasToken = process.env.ALIAS_PAT

      if (!aliasToken) {
        console.warn('[Add by SKU] No ALIAS_PAT found, skipping Alias image mapping')
        throw new Error('ALIAS_PAT not configured')
      }

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
          console.log('[Add by SKU] ✅ Found Alias product:', {
            catalogId: aliasMatch.catalog_id,
            hasImage: !!aliasMatch.main_picture_url,
          })

          // Create inventory_alias_links entry
          const { error: aliasLinkError } = await serviceSupabase
            .from('inventory_alias_links')
            .insert({
              inventory_id: inventoryItem.id,
              alias_catalog_id: aliasMatch.catalog_id,
              match_confidence: 'high',
              mapping_status: 'ok',
            })

          if (aliasLinkError) {
            console.warn('[Add by SKU] Failed to create Alias link:', aliasLinkError)
          } else {
            console.log('[Add by SKU] ✅ Alias mapping created')

            // Also upsert to alias_catalog_items if not exists
            await serviceSupabase
              .from('alias_catalog_items')
              .upsert({
                catalog_id: aliasMatch.catalog_id,
                slug: aliasMatch.slug || null,
                product_name: aliasMatch.name || catalogData.model,
                brand: aliasMatch.brand || catalogData.brand,
                sku: catalogData.sku,
                image_url: aliasMatch.main_picture_url || null,
                thumbnail_url: aliasMatch.thumbnail_url || null,
              }, {
                onConflict: 'catalog_id',
                ignoreDuplicates: false,
              })

            console.log('[Add by SKU] ✅ Alias catalog item stored')
          }
        } else {
          console.log('[Add by SKU] No Alias match found for SKU:', catalogData.sku)
        }
      }
    } catch (aliasError: any) {
      console.warn('[Add by SKU] Alias search failed:', aliasError.message)
      // Continue - not critical for adding item
    }

    // 11. Fetch and store market data immediately after adding item
    // This ensures the inventory table shows prices right away
    console.log('[Add by SKU] Fetching market data for newly added item...')

    try {
      const { StockxMarketService } = await import('@/lib/services/stockx/market')
      const marketService = new StockxMarketService(user.id)

      // Fetch market data for all standard currencies
      const currencies = ['GBP', 'USD', 'EUR']
      for (const currency of currencies) {
        try {
          const marketData = await marketService.getMarketData(
            catalogData.stockx_product_id,
            matchingVariant.variantId,
            { currencyCode: currency }
          )

          if (marketData.lowestAsk || marketData.highestBid) {
            // Store in stockx_market_latest table
            await serviceSupabase
              .from('stockx_market_latest')
              .upsert({
                stockx_product_id: catalogData.stockx_product_id,
                stockx_variant_id: matchingVariant.variantId,
                currency_code: currency,
                lowest_ask: marketData.lowestAsk,
                highest_bid: marketData.highestBid,
                sales_last_72h: marketData.salesLast72h,
                snapshot_at: new Date().toISOString(),
              }, {
                onConflict: 'stockx_product_id,stockx_variant_id,currency_code',
                ignoreDuplicates: false,
              })

            console.log(`[Add by SKU] ✅ Market data stored for ${currency}:`, {
              lowestAsk: marketData.lowestAsk,
              highestBid: marketData.highestBid,
            })
          }
        } catch (currencyError: any) {
          console.warn(`[Add by SKU] Failed to fetch ${currency} market data:`, currencyError.message)
          // Continue with other currencies
        }
      }
    } catch (marketError: any) {
      console.error('[Add by SKU] Market data fetch failed:', marketError)
      // Don't fail the entire request if market data fetch fails
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
      variant: {
        variantId: matchingVariant.variantId,
        size: matchingVariant.variantValue,
      },
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
