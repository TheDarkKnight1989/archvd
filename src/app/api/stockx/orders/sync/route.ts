/**
 * StockX Orders Sync API
 * POST /api/stockx/orders/sync
 *
 * Fetches orders from StockX and upserts them into the database.
 * Optionally triggers auto-mark-sold for completed orders.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrdersService, type Order, type OrderStatus } from '@/lib/services/stockx/orders'
import { isStockxMockMode } from '@/lib/config/stockx'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60 seconds for sync

interface SyncResult {
  fetched: number
  inserted: number
  updated: number
  errors: string[]
}

/**
 * Map StockX API order status to database status
 */
function mapStatusToDb(status: OrderStatus): 'ACTIVE' | 'COMPLETED' | 'CANCELLED' {
  switch (status) {
    // Active - still in progress
    case 'CREATED':
    case 'PENDING':
    case 'SHIPPED':
    case 'RECEIVED':
    case 'AUTHENTICATING':
    case 'AUTHENTICATED':
    case 'PAYOUTPENDING':
    case 'CCAUTHORIZATIONFAILED':
      return 'ACTIVE'
    // Completed - successfully done
    case 'PAYOUTCOMPLETED':
    case 'SYSTEMFULFILLED':
    case 'COMPLETED':
    case 'DELIVERED':
      return 'COMPLETED'
    // Cancelled/Failed
    case 'CANCELLED':
    case 'PAYOUTFAILED':
    case 'SUSPENDED':
      return 'CANCELLED'
    default:
      return 'ACTIVE'
  }
}

/**
 * Convert payout amount string to cents
 */
function toCents(amount: string | number): number {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return Math.round(num * 100)
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

    console.log('[Orders Sync] Starting sync for user:', user.id)

    const ordersService = getOrdersService(user.id)

    // Fetch both ACTIVE and HISTORICAL orders in parallel
    const [activeOrders, historicalOrders] = await Promise.all([
      ordersService.getOrders('ACTIVE'),
      ordersService.getOrders('HISTORICAL'),
    ])

    const allOrders = [...activeOrders, ...historicalOrders]
    console.log('[Orders Sync] Fetched orders:', {
      active: activeOrders.length,
      historical: historicalOrders.length,
      total: allOrders.length,
    })

    const result: SyncResult = {
      fetched: allOrders.length,
      inserted: 0,
      updated: 0,
      errors: [],
    }

    // Process each order
    for (const order of allOrders) {
      try {
        // Build the upsert record
        const record = {
          user_id: user.id,
          stockx_order_id: order.orderNumber,
          stockx_listing_id: order.listingId,
          stockx_product_id: order.product.productId,
          stockx_variant_id: order.variant.variantId,
          // Sale details
          amount: toCents(order.amount),
          currency_code: order.currencyCode,
          status: mapStatusToDb(order.status),
          // Dates
          sold_at: order.createdAt,
          shipped_at: null, // Not in new API response
          delivered_at: null, // Not in new API response
          // Payout
          payout_amount: order.payout?.totalPayout ? toCents(order.payout.totalPayout) : null,
          processing_fee: null, // Compute from adjustments if needed
          // Shipping
          tracking_number: order.shipment?.trackingNumber || null,
          carrier: order.shipment?.carrierCode || null,
          // Timestamps
          last_synced_at: new Date().toISOString(),
        }

        // Upsert the order
        const { error: upsertError, data: upsertData } = await supabase
          .from('stockx_orders')
          .upsert(record, {
            onConflict: 'stockx_order_id',
            ignoreDuplicates: false,
          })
          .select('id')
          .single()

        if (upsertError) {
          console.error('[Orders Sync] Upsert error:', {
            orderNumber: order.orderNumber,
            error: upsertError.message,
          })
          result.errors.push(`Order ${order.orderNumber}: ${upsertError.message}`)
        } else {
          // Check if it was an insert or update
          // Since we're upserting, we count all as updated for simplicity
          result.updated++
        }
      } catch (err: any) {
        console.error('[Orders Sync] Processing error:', {
          orderNumber: order.orderNumber,
          error: err.message,
        })
        result.errors.push(`Order ${order.orderNumber}: ${err.message}`)
      }
    }

    const duration = Date.now() - startTime

    console.log('[Orders Sync] Completed:', {
      ...result,
      duration_ms: duration,
    })

    return NextResponse.json({
      success: true,
      result,
      duration_ms: duration,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime

    console.error('[Orders Sync] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to sync orders',
        details: error.message,
        duration_ms: duration,
      },
      { status: 500 }
    )
  }
}
