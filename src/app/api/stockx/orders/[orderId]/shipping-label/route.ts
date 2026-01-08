/**
 * StockX Shipping Label API
 * GET /api/stockx/orders/[orderId]/shipping-label?format=pdf|json
 *
 * Get shipping label for an order
 * - PDF format: Returns downloadable PDF blob
 * - JSON format: Returns label URL and metadata
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
    const format = (searchParams.get('format') || 'pdf').toUpperCase() as 'PDF' | 'JSON'

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing orderId parameter' },
        { status: 400 }
      )
    }

    console.log('[Shipping Label] Fetching label:', {
      userId: user.id,
      orderId,
      format,
    })

    const ordersService = getOrdersService(user.id)
    const result = await ordersService.getShippingDocument(orderId, format)

    const duration = Date.now() - startTime

    if (format === 'PDF' && result instanceof Blob) {
      // Return PDF as downloadable file
      const headers = new Headers()
      headers.set('Content-Type', 'application/pdf')
      headers.set(
        'Content-Disposition',
        `attachment; filename="stockx-label-${orderId}.pdf"`
      )

      return new NextResponse(result, {
        status: 200,
        headers,
      })
    } else {
      // Return JSON with label info
      return NextResponse.json({
        success: true,
        shippingDocument: result,
        duration_ms: duration,
      })
    }
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
