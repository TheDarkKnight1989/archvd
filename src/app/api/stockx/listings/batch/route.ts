/**
 * StockX Batch Create Listings API
 * POST /api/stockx/listings/batch
 *
 * Creates multiple listings in one batch request using StockX batch API.
 * More efficient than creating listings one-by-one.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBatchService } from '@/lib/services/stockx/batch'
import type { BatchListingItem } from '@/lib/services/stockx/batch'
import { isStockxMockMode } from '@/lib/config/stockx'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Batch operations can take longer

interface BatchListingRequest {
  listings: Array<{
    inventoryItemId: string
    askPrice: number
    currencyCode?: string
    expiresAt?: string
  }>
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if StockX is in mock mode
    if (isStockxMockMode()) {
      return NextResponse.json(
        { error: 'StockX is in mock mode. Real API calls are disabled.' },
        { status: 503 }
      )
    }

    const body: BatchListingRequest = await request.json()

    if (!body.listings || body.listings.length === 0) {
      return NextResponse.json(
        { error: 'At least one listing is required' },
        { status: 400 }
      )
    }

    if (body.listings.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 listings per batch' },
        { status: 400 }
      )
    }

    console.log('[Batch Listings] Processing', body.listings.length, 'listings')

    // Get StockX mappings for all inventory items
    const inventoryItemIds = body.listings.map((l) => l.inventoryItemId)

    const { data: marketLinks, error: linksError } = await supabase
      .from('inventory_market_links')
      .select('item_id, stockx_product_id, stockx_variant_id')
      .in('item_id', inventoryItemIds)
      .eq('user_id', user.id)

    if (linksError || !marketLinks || marketLinks.length === 0) {
      return NextResponse.json(
        { error: 'No StockX mappings found for these items' },
        { status: 400 }
      )
    }

    // Build batch request
    const batchListings: BatchListingItem[] = []
    const itemIdToListingMap = new Map<string, typeof body.listings[0]>()

    for (const listing of body.listings) {
      const link = marketLinks.find((l) => l.item_id === listing.inventoryItemId)

      if (!link || !link.stockx_product_id || !link.stockx_variant_id) {
        console.warn(
          '[Batch Listings] Skipping item without mapping:',
          listing.inventoryItemId
        )
        continue
      }

      batchListings.push({
        productId: link.stockx_product_id,
        variantId: link.stockx_variant_id,
        amount: listing.askPrice.toFixed(2),
        currencyCode: listing.currencyCode || 'GBP',
        expiresAt: listing.expiresAt,
      })

      itemIdToListingMap.set(listing.inventoryItemId, listing)
    }

    if (batchListings.length === 0) {
      return NextResponse.json(
        { error: 'No valid listings to create (missing StockX mappings)' },
        { status: 400 }
      )
    }

    // Create batch and wait for completion
    const batchService = getBatchService(user.id)
    const results = await batchService.createAndWaitForListings(batchListings)

    console.log('[Batch Listings] Batch completed:', {
      total: results.length,
      success: results.filter((r) => r.status === 'SUCCESS').length,
      failed: results.filter((r) => r.status === 'FAILURE').length,
    })

    // Update inventory_market_links with listing IDs
    const updates = []
    const inventoryIdsByProductVariant = new Map<string, string>()

    // Create reverse lookup map
    for (const [itemId, listing] of itemIdToListingMap.entries()) {
      const link = marketLinks.find((l) => l.item_id === itemId)
      if (link) {
        const key = `${link.stockx_product_id}:${link.stockx_variant_id}`
        inventoryIdsByProductVariant.set(key, itemId)
      }
    }

    for (const result of results) {
      if (result.status === 'SUCCESS' && result.listingId) {
        const key = `${result.productId}:${result.variantId}`
        const itemId = inventoryIdsByProductVariant.get(key)

        if (itemId) {
          updates.push(
            supabase
              .from('inventory_market_links')
              .update({
                stockx_listing_id: result.listingId,
                stockx_listing_status: 'ACTIVE',
                updated_at: new Date().toISOString(),
              })
              .eq('item_id', itemId)
              .eq('user_id', user.id)
          )
        }
      }
    }

    // Execute all updates
    if (updates.length > 0) {
      await Promise.all(updates)
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      results: results.map((r) => ({
        productId: r.productId,
        variantId: r.variantId,
        status: r.status,
        listingId: r.listingId,
        error: r.error?.message,
      })),
      summary: {
        total: results.length,
        successful: results.filter((r) => r.status === 'SUCCESS').length,
        failed: results.filter((r) => r.status === 'FAILURE').length,
      },
      duration_ms: duration,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime

    console.error('[Batch Listings] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to create batch listings',
        details: error.message,
        duration_ms: duration,
      },
      { status: 500 }
    )
  }
}
