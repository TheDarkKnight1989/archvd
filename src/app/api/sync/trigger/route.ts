/**
 * Trigger Market Data Sync
 * Manually trigger sync for all products via Inngest
 */

import { NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest/client'

export async function POST() {
  try {
    console.log('🚀 Triggering sync for all products...')

    // Send event to Inngest to start sync
    await inngest.send({
      name: 'products/sync-all',
      data: {
        timestamp: new Date().toISOString(),
      },
    })

    console.log('✅ Sync triggered successfully')

    return NextResponse.json({
      success: true,
      message: 'Sync triggered for all products',
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('❌ Failed to trigger sync:', error.message)

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}
