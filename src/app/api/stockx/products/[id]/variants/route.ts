/**
 * StockX Product Variants API
 * GET /api/stockx/products/[id]/variants
 * Fetches all size variants for a StockX product
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCatalogService } from '@/lib/services/stockx/catalog'
import { isStockxMockMode } from '@/lib/config/stockx'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    console.log('[Product Variants] Fetching variants for:', id)

    // Check if StockX is in mock mode
    if (isStockxMockMode()) {
      return NextResponse.json(
        { error: 'StockX is in mock mode. Real API calls are disabled.' },
        { status: 503 }
      )
    }

    // Get catalog service and fetch product with variants
    const catalogService = getCatalogService()
    const variants = await catalogService.getProductVariants(id)

    if (!variants || variants.length === 0) {
      return NextResponse.json(
        { error: 'No variants found for this product' },
        { status: 404 }
      )
    }

    console.log('[Product Variants] Success:', {
      productId: id,
      variantsCount: variants.length,
    })

    return NextResponse.json({
      productId: id,
      variants: variants.map(v => ({
        id: v.variantId,
        size: v.variantValue,
        gtins: v.gtins || [],
      })),
    })
  } catch (error: any) {
    console.error('[Product Variants] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
