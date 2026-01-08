/**
 * StockX Order Details API
 * GET /api/stockx/orders/[orderId]
 *
 * Get detailed information about a specific order
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrdersService } from '@/lib/services/stockx/orders'
import { isStockxMockMode } from '@/lib/config/stockx'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
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

    const { orderId } = await params

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing orderId parameter' },
        { status: 400 }
      )
    }

    console.log('[Order Details] Fetching order:', { userId: user.id, orderId })

    const ordersService = getOrdersService(user.id)
    const order = await ordersService.getOrder(orderId)

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      order,
      duration_ms: duration,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime

    console.error('[Order Details] Error:', error)

    if (error.message?.includes('404')) {
      return NextResponse.json(
        {
          error: 'Order not found',
          details: error.message,
          duration_ms: duration,
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch order details',
        details: error.message,
        duration_ms: duration,
      },
      { status: 500 }
    )
  }
}
