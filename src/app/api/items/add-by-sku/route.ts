/**
 * Add Inventory Item by SKU + Size
 * POST /api/items/add-by-sku
 *
 * NEW FLOW: SKU + Size only, all other fields autofilled from StockX
 * REUSES: Existing size conversion system (size-conversion.ts, findVariantBySize.ts)
 *
 * Process:
 * 1. Search StockX for product by SKU
 * 2. Insert product + variants to DB (if not exists)
 * 3. Detect brand & gender from product data
 * 4. Convert user size to US size using existing size-conversion.ts
 * 5. Find correct variant using findVariantBySize helper
 * 6. Create Inventory row with ALL fields autofilled from StockX
 * 7. Create inventory_market_links row
 * 8. Return full item details
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@/lib/supabase/service'
import { StockxCatalogService } from '@/lib/services/stockx/catalog'
import { upsertStockxProduct, upsertStockxVariant } from '@/lib/market/upsert'
import { findVariantBySize } from '@/lib/stockx/findVariantBySize'
import { syncSingleInventoryItemFromStockx, refreshStockxMarketLatestView } from '@/lib/providers/stockx-worker'

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

    console.log('[Add by SKU] Starting:', {
      userId: user.id,
      sku: input.sku,
      size: input.size,
      sizeSystem: input.sizeSystem,
    })

    // 3. Search StockX for product by SKU
    const catalogService = new StockxCatalogService(user.id)
    const searchResults = await catalogService.searchProducts(input.sku, { limit: 5 })

    if (searchResults.length === 0) {
      return NextResponse.json(
        {
          code: 'NOT_FOUND',
          message: `No StockX products found for SKU "${input.sku}". The product may not exist on StockX.`,
        },
        { status: 404 }
      )
    }

    console.log('[Add by SKU] Found products:', searchResults.map(p => ({
      productId: p.productId,
      styleId: p.styleId,
      title: p.productName,
    })))

    // 4. Find exact SKU match
    const exactMatches = searchResults.filter(
      p => p.styleId.toLowerCase() === input.sku.toLowerCase()
    )

    let selectedProduct
    if (exactMatches.length === 1) {
      selectedProduct = exactMatches[0]
      console.log('[Add by SKU] Found exact SKU match:', selectedProduct.productId)
    } else if (exactMatches.length > 1) {
      return NextResponse.json(
        {
          code: 'AMBIGUOUS_MATCH',
          message: `Multiple StockX products found with SKU "${input.sku}". Cannot automatically determine the correct match.`,
          matches: exactMatches.map(p => ({
            productId: p.productId,
            styleId: p.styleId,
            title: p.productName,
          })),
        },
        { status: 400 }
      )
    } else {
      // No exact SKU match found
      return NextResponse.json(
        {
          code: 'NO_EXACT_MATCH',
          message: `Found ${searchResults.length} StockX product(s) for search term "${input.sku}", but none have an exact SKU match.`,
          matches: searchResults.map(p => ({
            productId: p.productId,
            styleId: p.styleId,
            title: p.productName,
          })),
        },
        { status: 400 }
      )
    }

    // 5. Upsert product to database (idempotent)
    await upsertStockxProduct({
      stockxProductId: selectedProduct.productId,
      brand: selectedProduct.brand,
      title: selectedProduct.productName,
      colorway: selectedProduct.colorway,
      imageUrl: selectedProduct.image,
      category: selectedProduct.category,
      styleId: selectedProduct.styleId,
    })

    console.log('[Add by SKU] Product upserted to DB')

    // 6. Fetch variants for the selected product
    const variants = await catalogService.getProductVariants(selectedProduct.productId)

    if (variants.length === 0) {
      return NextResponse.json(
        {
          code: 'NOT_FOUND',
          message: 'Product found but has no size variants available.',
        },
        { status: 404 }
      )
    }

    // 7. Upsert all variants to database (idempotent)
    for (const variant of variants) {
      await upsertStockxVariant({
        stockxVariantId: variant.variantId,
        stockxProductId: selectedProduct.productId,
        variantValue: variant.variantValue,
        sizeDisplay: variant.variantName,
      })
    }

    console.log('[Add by SKU] Variants upserted to DB:', variants.length)

    // 8. Find matching variant using size conversion system
    const matchingVariant = findVariantBySize(
      input.size,
      input.sizeSystem,
      variants,
      selectedProduct.brand,
      selectedProduct.productName
    )

    if (!matchingVariant) {
      return NextResponse.json(
        {
          code: 'NO_SIZE_MATCH',
          message: `Product found but size "${input.size}" (${input.sizeSystem}) is not available.`,
          availableSizes: variants.map(v => v.variantValue).sort(),
          sizeChartInfo: variants.slice(0, 3).map(v => ({
            variantValue: v.variantValue,
            displayOptions: v.sizeChart?.displayOptions || [],
          })),
        },
        { status: 400 }
      )
    }

    console.log('[Add by SKU] Found matching variant:', {
      variantId: matchingVariant.variantId,
      size: matchingVariant.variantValue,
    })

    // 9. Create Inventory row with ALL fields autofilled from StockX
    const serviceSupabase = createServiceClient()

    // Prepare inventory row
    const inventoryRow = {
      user_id: user.id,
      sku: selectedProduct.styleId,
      brand: selectedProduct.brand,
      model: selectedProduct.productName, // Use full product name as model
      colorway: selectedProduct.colorway,
      style_id: selectedProduct.styleId,
      size: matchingVariant.variantValue, // US size from StockX (always)
      size_uk: input.sizeSystem === 'UK' ? input.size : null,
      size_alt: input.sizeSystem === 'EU' ? `${input.size} EU` : null,
      category: selectedProduct.category === 'sneakers' ? 'sneaker' : (selectedProduct.category || 'other'),
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

    // 10. Create purchase transaction record
    if (input.purchasePrice && input.purchaseDate) {
      const totalCost = input.purchasePrice + (input.tax || 0) + (input.shipping || 0)

      const { error: transactionError } = await serviceSupabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: 'purchase',
          inventory_id: inventoryItem.id,
          sku: selectedProduct.styleId,
          size_uk: input.sizeSystem === 'UK' ? input.size : null,
          title: selectedProduct.productName,
          image_url: selectedProduct.image,
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

    // 11. Create inventory_market_links row
    const { error: linkError } = await serviceSupabase
      .from('inventory_market_links')
      .insert({
        item_id: inventoryItem.id,
        stockx_product_id: selectedProduct.productId,
        stockx_variant_id: matchingVariant.variantId,
      })

    if (linkError) {
      console.error('[Add by SKU] Failed to create market link:', linkError)
      // Don't fail the request if link creation fails
    } else {
      console.log('[Add by SKU] Market link created successfully')

      // 12. Sync market data immediately after mapping
      try {
        await syncSingleInventoryItemFromStockx({
          inventoryItemId: inventoryItem.id,
          userId: user.id,
        })
        console.log('[Add by SKU] Market data synced successfully')
      } catch (syncError: any) {
        console.error('[Add by SKU] Failed to sync market data:', syncError)
      }

      // 13. Refresh materialized view
      try {
        await refreshStockxMarketLatestView({ dryRun: false })
        console.log('[Add by SKU] View refreshed successfully')
      } catch (refreshError: any) {
        console.error('[Add by SKU] Failed to refresh view:', refreshError)
      }
    }

    // 14. Query stockx_market_latest for fresh market data
    const { data: marketData } = await serviceSupabase
      .from('stockx_market_latest')
      .select('last_sale_price, lowest_ask, highest_bid, currency_code, snapshot_at')
      .eq('stockx_product_id', selectedProduct.productId)
      .eq('stockx_variant_id', matchingVariant.variantId)
      .maybeSingle()

    console.log('[Add by SKU] Market data retrieved:', marketData)

    // 15. Return success response with full item details
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
        productId: selectedProduct.productId,
        styleId: selectedProduct.styleId,
        title: selectedProduct.productName,
        brand: selectedProduct.brand,
        colorway: selectedProduct.colorway,
        image: selectedProduct.image,
        category: selectedProduct.category,
        gender: selectedProduct.gender,
        retailPrice: selectedProduct.retailPrice,
        releaseDate: selectedProduct.releaseDate,
      },
      variant: {
        variantId: matchingVariant.variantId,
        size: matchingVariant.variantValue,
      },
      marketData: marketData ? {
        lastSale: marketData.last_sale_price,
        lowestAsk: marketData.lowest_ask,
        highestBid: marketData.highest_bid,
        currencyCode: marketData.currency_code,
        snapshotAt: marketData.snapshot_at,
      } : null,
    }, { status: 201 })
  } catch (error: any) {
    console.error('[Add by SKU] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add item by SKU' },
      { status: 500 }
    )
  }
}
