/**
 * StockX Market Data API
 * GET /api/stockx/products/[productId]/market-data?variantId=xxx&currency=GBP
 * Returns real-time market data for a specific product variant (size)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStockxClient } from '@/lib/services/stockx/client'
import {
  findProductByStyleId,
  findMarketDataByVariantId,
  mapRawMarketDataToDomain,
} from '@/lib/stockx/mappers'
import { findVariantBySize } from '@/lib/stockx/findVariantBySize'
import type {
  StockxRawSearchResponse,
  StockxRawMarketDataItem,
} from '@/lib/stockx/types'

export const maxDuration = 10

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params
    const searchParams = request.nextUrl.searchParams
    const variantId = searchParams.get('variantId')
    const size = searchParams.get('size')
    const sizeSystem = (searchParams.get('sizeSystem') || 'US') as 'UK' | 'US' | 'EU'
    const currency = searchParams.get('currency') || 'GBP'

    console.log('[Market Data API]', { productId, variantId, size, sizeSystem, currency })

    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = getStockxClient(user.id)

    // Detect if productId is a SKU (style code like "IO3372-700")
    // SKUs typically have format: XX####-### or similar patterns
    const isSku = /^[A-Z0-9]{2,}-[A-Z0-9]{3,}$/i.test(productId)

    let actualProductId = productId
    let productBrand: string | undefined
    let productTitle: string | undefined

    // If it's a SKU, search for the product first to get the real StockX product ID
    if (isSku) {
      console.log('[Market Data API] Detected SKU, searching for product:', productId)
      try {
        const rawSearchResponse = await client.request<StockxRawSearchResponse>(
          `/v2/catalog/search?query=${encodeURIComponent(productId)}&pageSize=5&currencyCode=${currency}`
        )

        console.log('[Market Data API] Search returned', rawSearchResponse.products.length, 'products')

        // Use mapper to find product by SKU
        const rawProduct = findProductByStyleId(rawSearchResponse, productId)

        if (rawProduct) {
          actualProductId = rawProduct.productId
          productBrand = rawProduct.brand
          productTitle = rawProduct.title
          console.log('[Market Data API] Found product ID from search:', actualProductId)
          console.log('[Market Data API] Product:', rawProduct.title, '(', rawProduct.styleId, ')')
        } else {
          console.log('[Market Data API] No exact SKU match found in search results')
          return NextResponse.json({
            lowestAsk: null,
            highestBid: null,
            currency,
          })
        }
      } catch (searchError) {
        console.error('[Market Data API] Search failed:', searchError)
        return NextResponse.json({
          lowestAsk: null,
          highestBid: null,
          currency,
        })
      }
    }

    // Fetch real-time market data from StockX API with the actual product ID
    const rawMarketData = await client.request<StockxRawMarketDataItem[]>(
      `/v2/catalog/products/${actualProductId}/market-data?currencyCode=${currency}`
    )

    if (!Array.isArray(rawMarketData) || rawMarketData.length === 0) {
      return NextResponse.json({
        lowestAsk: null,
        highestBid: null,
        currency,
      })
    }

    // Priority 1: Match by size (if provided) - this is the most accurate
    let rawVariantData: StockxRawMarketDataItem | null = null
    if (size) {
      try {
        const variantsResponse = await client.request<any>(
          `/v2/catalog/products/${actualProductId}/variants`
        )
        const variantsArray = Array.isArray(variantsResponse) ? variantsResponse : variantsResponse.variants || []

        // Map variants to expected format
        const variants = variantsArray.map((v: any) => ({
          variantId: v.variantId || v.id,
          variantValue: v.variantValue || v.size || '',
          variantName: v.variantName || v.name || v.size || '',
          sizeChart: v.sizeChart || null,
        }))

        let matchingVariant: any = null

        // If sizeSystem is provided and we have product info, use findVariantBySize for conversion
        if (productBrand && productTitle && sizeSystem) {
          matchingVariant = findVariantBySize(size, sizeSystem, variants, productBrand, productTitle)
          console.log('[Market Data API] Using findVariantBySize:', {
            size,
            sizeSystem,
            brand: productBrand,
            found: !!matchingVariant,
          })
        } else {
          // Fallback to direct matching for US sizes or when product info unavailable
          matchingVariant = variants.find((v: any) =>
            v.variantValue === size ||
            v.variantValue === `US ${size}` ||
            v.variantValue === `M ${size}` ||
            v.variantName === size ||
            v.variantName === `US ${size}` ||
            v.variantName === `M ${size}`
          )
          console.log('[Market Data API] Direct size match:', { size, found: !!matchingVariant })
        }

        if (matchingVariant) {
          const matchedVariantId = matchingVariant.variantId
          rawVariantData = findMarketDataByVariantId(rawMarketData, matchedVariantId)
          console.log('[Market Data API] Found market data for variant:', {
            variantId: matchedVariantId,
            size: matchingVariant.variantValue,
            found: !!rawVariantData,
          })
        }
      } catch (variantError) {
        console.error('[Market Data API] Failed to fetch variants for size matching:', variantError)
      }
    }

    // Priority 2: Match by variantId (if provided and size match failed)
    if (!rawVariantData && variantId) {
      rawVariantData = findMarketDataByVariantId(rawMarketData, variantId)
      console.log('[Market Data API] Matched by variantId:', { variantId, found: !!rawVariantData })
    }

    // Priority 3: Use first available variant with data
    if (!rawVariantData) {
      rawVariantData = rawMarketData.find(
        (v) => v.lowestAskAmount || v.highestBidAmount
      ) || null
      console.log('[Market Data API] Using first available variant')
    }

    if (!rawVariantData) {
      return NextResponse.json({
        lowestAsk: null,
        highestBid: null,
        currency,
      })
    }

    // Map raw data to domain type
    const marketData = mapRawMarketDataToDomain(rawVariantData, currency)

    return NextResponse.json({
      lowestAsk: marketData.lowestAsk || null,
      highestBid: marketData.highestBid || null,
      currency: marketData.currencyCode,
      variantId: marketData.variantId,
    })
  } catch (error: any) {
    console.error('[Market Data API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch market data', message: error.message },
      { status: 500 }
    )
  }
}
