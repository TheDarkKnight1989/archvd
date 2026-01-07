/**
 * Admin API: Trigger StockX Full Sync
 *
 * Triggers background sync of all StockX products across all regions.
 * Returns immediately while sync runs in background via Inngest.
 */

import { NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest/client'

export async function POST(request: Request) {
  try {
    console.log('[Admin API] Triggering StockX full sync...')

    // Send event to Inngest - returns immediately
    await inngest.send({
      name: 'stockx/sync-all',
      data: {
        triggeredBy: 'admin-api',
        timestamp: new Date().toISOString(),
      },
    })

    console.log('[Admin API] ✅ StockX sync triggered successfully')

    return NextResponse.json({
      success: true,
      message: 'StockX sync started in background',
      details: {
        endpoint: 'stockx/sync-all',
        concurrency: '10 products at a time',
        expectedDuration: '10-15 minutes',
        note: 'Sync is running in background. Check Inngest dashboard for progress.',
      },
    })
  } catch (error: any) {
    console.error('[Admin API] ❌ Failed to trigger sync:', error.message)

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/admin/sync-stockx-all',
    method: 'POST',
    description: 'Triggers background sync of all StockX products across US, UK, EU regions',
    features: [
      'Parallel processing (10 products at a time)',
      'All regions per product (US, UK, EU)',
      'Automatic retry on failures',
      'Timeout detection and categorization',
      'Returns immediately - sync runs in background',
    ],
    usage: 'curl -X POST http://localhost:3000/api/admin/sync-stockx-all',
  })
}
