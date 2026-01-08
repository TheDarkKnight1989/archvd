/**
 * StockX Shipping Label API
 * GET /api/stockx/orders/[orderId]/shipping-label?shippingId={shippingId}
 *
 * Get shipping label PDF for an order
 * Requires shippingId from order details
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
    const searchParams = request.nextUrl.searchParams
    const shippingId = searchParams.get('shippingId')

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing orderId parameter' },
        { status: 400 }
      )
    }

    if (!shippingId) {
      return NextResponse.json(
        { error: 'Missing shippingId query parameter. Get this from order details.' },
        { status: 400 }
      )
    }

    console.log('[Shipping Label] Fetching label:', {
      userId: user.id,
      orderId,
      shippingId,
      stockxUrl: `https://api.stockx.com/v2/selling/orders/${orderId}/shipping-document/${shippingId}`,
    })

    const ordersService = getOrdersService(user.id)
    const pdfBlob = await ordersService.getShippingDocument(orderId, shippingId)

    const duration = Date.now() - startTime

    // Log what we received
    console.log('[Shipping Label] Response received:', {
      type: typeof pdfBlob,
      isBlob: pdfBlob instanceof Blob,
      size: pdfBlob instanceof Blob ? pdfBlob.size : 'N/A',
      duration_ms: duration,
    })

    // Return PDF as downloadable file
    const headers = new Headers()
    headers.set('Content-Type', 'application/pdf')
    headers.set(
      'Content-Disposition',
      `attachment; filename="stockx-label-${orderId}.pdf"`
    )

    return new NextResponse(pdfBlob, {
      status: 200,
      headers,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime

    console.error('[Shipping Label] Error:', error)

    if (error.message?.includes('404')) {
      return NextResponse.json(
        {
          error: 'Shipping label not found',
          details: error.message,
          duration_ms: duration,
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch shipping label',
        details: error.message,
        duration_ms: duration,
      },
      { status: 500 }
    )
  }
}
