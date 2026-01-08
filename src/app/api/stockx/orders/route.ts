/**
 * StockX Orders API
 * GET /api/stockx/orders?status=ACTIVE|HISTORICAL
 *
 * List all orders for the authenticated user
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrdersService } from '@/lib/services/stockx/orders'
import { isStockxMockMode } from '@/lib/config/stockx'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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
        { error: 'StockX is in mock mode. Real API calls are disabled.', code: 'MOCK_MODE' },
        { status: 503 }
      )
    }

    // Check if user has a connected StockX account
    // Match the same logic as /api/stockx/status
    const { data: stockxAccount, error: accountError } = await supabase
      .from('stockx_accounts')
      .select('id, account_email')
      .eq('user_id', user.id)
      .single()

    if (accountError || !stockxAccount) {
      return NextResponse.json(
        { error: 'StockX account not connected', code: 'NOT_CONNECTED' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const status = (searchParams.get('status') || 'ACTIVE') as 'ACTIVE' | 'HISTORICAL'

    console.log('[Orders] Fetching orders:', { userId: user.id, status })

    const ordersService = getOrdersService(user.id)
    const orders = await ordersService.getOrders(status)

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      orders,
      count: orders.length,
      status,
      duration_ms: duration,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime

    console.error('[Orders] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch orders',
        details: error.message,
        duration_ms: duration,
      },
      { status: 500 }
    )
  }
}
