/**
 * StockX Orders Auto Mark-Sold API
 * POST /api/stockx/orders/auto-mark-sold
 *
 * Processes completed StockX orders and attempts to automatically
 * mark matched inventory items as sold.
 *
 * Matching logic:
 * 1. Look for inventory_v4_items with matching style_id (SKU) and size
 * 2. If exactly 1 match found → call mark-sold with order data
 * 3. If 0 or multiple matches → mark order as "needs_match" for manual resolution
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface AutoMarkSoldResult {
  processed: number
  auto_sold: number
  needs_match: number
  already_sold: number
  errors: string[]
  details: Array<{
    orderId: string
    sku: string
    size: string
    status: 'auto_sold' | 'needs_match' | 'already_sold' | 'error'
    message?: string
    matchCount?: number
    itemId?: string
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

    console.log('[Auto Mark-Sold] Starting for user:', user.id)

    // Get completed orders that haven't been processed for auto-sell
    // We check by looking for orders with status=COMPLETED that don't have
    // a corresponding sale record
    const { data: completedOrders, error: ordersError } = await supabase
      .from('stockx_orders')
      .select(`
        id,
        stockx_order_id,
        stockx_product_id,
        stockx_variant_id,
        amount,
        currency_code,
        sold_at,
        payout_amount,
        processing_fee,
        transaction_fee,
        shipping_cost
      `)
      .eq('user_id', user.id)
      .eq('status', 'COMPLETED')

    if (ordersError) {
      throw new Error(`Failed to fetch orders: ${ordersError.message}`)
    }

    if (!completedOrders || completedOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No completed orders to process',
        result: {
          processed: 0,
          auto_sold: 0,
          needs_match: 0,
          already_sold: 0,
          errors: [],
          details: [],
        },
        duration_ms: Date.now() - startTime,
      })
    }

    console.log('[Auto Mark-Sold] Found completed orders:', completedOrders.length)

    // Get existing sales to check for already-processed orders
    const { data: existingSales } = await supabase
      .from('inventory_v4_sales')
      .select('notes, original_item_id')
      .eq('user_id', user.id)
      .eq('platform', 'stockx')

    // Create a set of order IDs that have already been processed
    const processedOrderIds = new Set<string>()
    if (existingSales) {
      for (const sale of existingSales) {
        // Check if notes contains a StockX order ID reference
        if (sale.notes && sale.notes.includes('stockx_order:')) {
          const match = sale.notes.match(/stockx_order:([a-zA-Z0-9-]+)/)
          if (match) {
            processedOrderIds.add(match[1])
          }
        }
      }
    }

    const result: AutoMarkSoldResult = {
      processed: 0,
      auto_sold: 0,
      needs_match: 0,
      already_sold: 0,
      errors: [],
      details: [],
    }

    // Get user's base currency
    const { data: profile } = await supabase
      .from('profiles')
      .select('base_currency')
      .eq('id', user.id)
      .single()

    const baseCurrency = profile?.base_currency || 'GBP'

    // Process each completed order
    for (const order of completedOrders) {
      result.processed++

      // Check if already processed
      if (processedOrderIds.has(order.stockx_order_id)) {
        result.already_sold++
        result.details.push({
          orderId: order.stockx_order_id,
          sku: order.stockx_product_id,
          size: '',
          status: 'already_sold',
          message: 'Already marked as sold',
        })
        continue
      }

      try {
        // Look up product info from catalog to get SKU
        const { data: stockxProduct } = await supabase
          .from('stockx_products')
          .select('style_id, title, brand')
          .eq('stockx_product_id', order.stockx_product_id)
          .single()

        // Look up variant to get size
        const { data: stockxVariant } = await supabase
          .from('stockx_variants')
          .select('variant_value')
          .eq('stockx_variant_id', order.stockx_variant_id)
          .single()

        const sku = stockxProduct?.style_id || order.stockx_product_id
        const size = stockxVariant?.variant_value || ''

        if (!size) {
          result.needs_match++
          result.details.push({
            orderId: order.stockx_order_id,
            sku,
            size: '',
            status: 'needs_match',
            message: 'Could not determine size from order',
            matchCount: 0,
          })
          continue
        }

        // Find matching inventory items
        // Match by style_id (SKU) and size
        const { data: matchingItems, error: matchError } = await supabase
          .from('inventory_v4_items')
          .select('id, style_id, size, purchase_price, purchase_currency, purchase_date, condition, consignment_location')
          .eq('user_id', user.id)
          .eq('style_id', sku)
          .eq('size', size)

        if (matchError) {
          throw new Error(`Failed to find matching items: ${matchError.message}`)
        }

        const matchCount = matchingItems?.length || 0

        if (matchCount === 0) {
          // No matches - needs manual matching
          result.needs_match++
          result.details.push({
            orderId: order.stockx_order_id,
            sku,
            size,
            status: 'needs_match',
            message: 'No matching inventory item found',
            matchCount: 0,
          })
          continue
        }

        if (matchCount > 1) {
          // Multiple matches - needs manual selection
          result.needs_match++
          result.details.push({
            orderId: order.stockx_order_id,
            sku,
            size,
            status: 'needs_match',
            message: `Multiple items match (${matchCount}) - manual selection required`,
            matchCount,
          })
          continue
        }

        // Exactly 1 match - auto mark as sold
        const item = matchingItems![0]

        // Calculate sold price from payout (convert from cents)
        const soldPrice = (order.payout_amount || order.amount) / 100
        const fees = ((order.processing_fee || 0) + (order.transaction_fee || 0)) / 100
        const shipping = (order.shipping_cost || 0) / 100

        // Call mark-sold API internally
        const markSoldResponse = await fetch(
          `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/items/${item.id}/mark-sold`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: request.headers.get('cookie') || '',
            },
            body: JSON.stringify({
              sold_price: soldPrice,
              sold_date: order.sold_at,
              sale_currency: order.currency_code || 'USD',
              platform: 'stockx',
              fees: fees,
              shipping: shipping,
              notes: `Auto-sold from StockX order | stockx_order:${order.stockx_order_id}`,
            }),
          }
        )

        if (!markSoldResponse.ok) {
          const errorData = await markSoldResponse.json()
          throw new Error(errorData.error || 'Failed to mark as sold')
        }

        result.auto_sold++
        result.details.push({
          orderId: order.stockx_order_id,
          sku,
          size,
          status: 'auto_sold',
          message: 'Successfully marked as sold',
          itemId: item.id,
        })

        console.log('[Auto Mark-Sold] Marked item as sold:', {
          orderId: order.stockx_order_id,
          itemId: item.id,
          sku,
          size,
          soldPrice,
        })
      } catch (err: any) {
        console.error('[Auto Mark-Sold] Error processing order:', {
          orderId: order.stockx_order_id,
          error: err.message,
        })
        result.errors.push(`Order ${order.stockx_order_id}: ${err.message}`)
        result.details.push({
          orderId: order.stockx_order_id,
          sku: order.stockx_product_id,
          size: '',
          status: 'error',
          message: err.message,
        })
      }
    }

    const duration = Date.now() - startTime

    console.log('[Auto Mark-Sold] Completed:', {
      processed: result.processed,
      auto_sold: result.auto_sold,
      needs_match: result.needs_match,
      already_sold: result.already_sold,
      errors: result.errors.length,
      duration_ms: duration,
    })

    return NextResponse.json({
      success: true,
      result,
      duration_ms: duration,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime

    console.error('[Auto Mark-Sold] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to process auto mark-sold',
        details: error.message,
        duration_ms: duration,
      },
      { status: 500 }
    )
  }
}
