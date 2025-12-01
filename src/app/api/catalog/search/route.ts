/**
 * Unified Catalog Search API
 * Searches both StockX and Alias catalogs and returns normalized results
 * GET /api/catalog/search?q=nike+dunk&limit=10
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCatalogService } from '@/lib/services/stockx/catalog'
import { createAliasClient } from '@/lib/services/alias/client'

export const maxDuration = 10

interface UnifiedProduct {
  id: string
  source: 'stockx' | 'alias'
  sku: string
  name: string
  brand: string
  colorway?: string
  imageUrl: string | null
  releaseDate?: string | null
  retailPrice?: number | null
  // StockX specific
  stockxProductId?: string
  stockxVariants?: Array<{
    id: string
    size: string
    gtins?: string[]
  }>
  // Alias specific
  aliasCatalogId?: string
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    if (!query || query.trim() === '') {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      )
    }

    console.log('[API /catalog/search]', { query, limit })

    // Get user for StockX auth
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Search both platforms in parallel
    const [stockxResults, aliasResults] = await Promise.allSettled([
      // StockX search
      (async () => {
        try {
          const catalogService = getCatalogService(user.id)
          const products = await catalogService.searchProducts(query, { limit })

          // Fetch variants for each product
          const productsWithVariants = await Promise.all(
            products.map(async (product) => {
              try {
                const variants = await catalogService.getProductVariants(product.productId)
                return {
                  ...product,
                  variants: variants.map(v => ({
                    id: v.variantId,
                    size: v.variantValue,
                    gtins: v.gtins
                  }))
                }
              } catch (error) {
                console.warn(`Failed to fetch variants for ${product.productId}:`, error)
                return { ...product, variants: [] }
              }
            })
          )

          return productsWithVariants
        } catch (error) {
          console.error('[Catalog Search] StockX search failed:', error)
          return []
        }
      })(),

      // Alias search
      (async () => {
        try {
          const aliasClient = createAliasClient()
          const response = await aliasClient.searchCatalog(query, { limit })
          return response.catalog_items
        } catch (error) {
          console.error('[Catalog Search] Alias search failed:', error)
          return []
        }
      })()
    ])

    // Normalize results
    const results: UnifiedProduct[] = []

    // Add StockX results
    if (stockxResults.status === 'fulfilled' && stockxResults.value) {
      for (const product of stockxResults.value) {
        results.push({
          id: `stockx-${product.productId}`,
          source: 'stockx',
          sku: product.styleId,
          name: product.productName,
          brand: product.brand,
          colorway: product.colorway,
          imageUrl: product.image,
          releaseDate: product.releaseDate,
          retailPrice: product.retailPrice,
          stockxProductId: product.productId,
          stockxVariants: (product as any).variants || []
        })
      }
    }

    // Add Alias results
    if (aliasResults.status === 'fulfilled' && aliasResults.value) {
      for (const item of aliasResults.value) {
        // Skip if we already have this SKU from StockX
        if (results.some(r => r.sku === item.sku)) {
          console.log(`[Catalog Search] Skipping duplicate SKU ${item.sku} from Alias`)
          continue
        }

        results.push({
          id: `alias-${item.catalog_id}`,
          source: 'alias',
          sku: item.sku || '',
          name: item.name,
          brand: item.brand || '',
          colorway: item.colorway,
          imageUrl: item.main_picture_url ?? null,
          releaseDate: item.release_date,
          retailPrice: item.retail_price_cents ? item.retail_price_cents / 100 : null,
          aliasCatalogId: item.catalog_id
        })
      }
    }

    const duration = Date.now() - startTime

    console.log('[API /catalog/search] Success', {
      query,
      resultsCount: results.length,
      stockxCount: stockxResults.status === 'fulfilled' ? stockxResults.value.length : 0,
      aliasCount: aliasResults.status === 'fulfilled' ? aliasResults.value.length : 0,
      duration_ms: duration
    })

    return NextResponse.json({
      results,
      total: results.length,
      duration_ms: duration
    })

  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error('[API /catalog/search] Error:', error)

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error.message
      },
      { status: 500 }
    )
  }
}
