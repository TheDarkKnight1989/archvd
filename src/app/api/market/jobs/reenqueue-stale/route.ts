/**
 * POST /api/market/jobs/reenqueue-stale
 * WHY: Re-enqueue items with stale market prices (>N hours old or NULL)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/service'
import { enqueueJob } from '@/lib/market/enqueue'

export async function POST(request: NextRequest) {
  const supabase = createClient()

  try {
    const body = await request.json()
    const { provider = 'stockx', max = 200, staleness_minutes = 180 } = body

    const staleThreshold = new Date(Date.now() - staleness_minutes * 60 * 1000)

    // WHY: Find inventory items with stale or missing market prices
    const { data: items, error } = await supabase
      .from('Inventory')
      .select('id, sku, size_uk, market_price_updated_at')
      .in('status', ['active', 'listed', 'worn'])
      .or(`market_price_updated_at.is.null,market_price_updated_at.lt.${staleThreshold.toISOString()}`)
      .limit(max)

    if (error) throw error

    let queued = 0

    for (const item of items || []) {
      const result = await enqueueJob({
        provider,
        sku: item.sku,
        size: item.size_uk,
        priority: 100, // Background priority
        userId: null, // System-triggered
      })

      if (result) queued++
    }

    console.log(`[Re-enqueue Stale] Queued ${queued} jobs for ${provider}`)

    return NextResponse.json({
      queued,
      message: `Enqueued ${queued} stale items for ${provider}`,
    })
  } catch (error: any) {
    console.error('[Re-enqueue Stale] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
