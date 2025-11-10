/**
 * /api/v1/market/[sku]
 *
 * Get market data for a SKU - Mock implementation
 * - Returns mock price points for development
 * - Production: Replace with real market data provider
 * - API request logging
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sku: string }> }
) {
  const startTime = Date.now()
  let userId: string | undefined

  try {
    const supabase = await createClient()

    // Auth guard
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { code: 'UNAUTHORIZED', message: 'Please sign in' },
        { status: 401 }
      )
    }

    userId = user.id
    const { sku } = await params

    // Query mock market data from database
    const { data: marketData, error: fetchError } = await supabase
      .from('product_market_prices')
      .select('*')
      .eq('sku', sku)
      .order('as_of', { ascending: false })
      .limit(30) // Last 30 days

    if (fetchError) {
      await db.logApp('error', 'api:v1:market', 'Failed to fetch market data', {
        sku,
        error: fetchError.message
      }, userId)

      return NextResponse.json(
        { code: 'FETCH_FAILED', message: 'Failed to fetch market data', details: fetchError.message },
        { status: 500 }
      )
    }

    // Log successful request
    const duration = Date.now() - startTime
    await db.logApp('info', 'api:v1:market', 'Market data fetched', {
      sku,
      dataPoints: marketData?.length || 0,
      duration
    }, userId)

    // Return market data
    return NextResponse.json({
      success: true,
      sku,
      data_points: marketData || [],
      meta: {
        source: 'mock',
        count: marketData?.length || 0,
        latest: marketData?.[0] || null
      }
    })

  } catch (error: any) {
    // Log fatal error
    if (userId) {
      await db.logApp('error', 'api:v1:market', 'Internal server error', {
        error: error.message,
        stack: error.stack
      }, userId)
    }

    console.error('[API v1 Market Data] Error:', error)
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
