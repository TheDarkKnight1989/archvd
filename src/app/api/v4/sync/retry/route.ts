/**
 * V4 Sync Retry Endpoint
 *
 * POST /api/v4/sync/retry
 *
 * Retry failed sync jobs for a style.
 * Requires authentication.
 *
 * Request body:
 * {
 *   styleId: string            // Required: SKU to retry
 *   provider?: 'stockx' | 'alias' // Optional: specific provider to retry
 * }
 *
 * Response:
 * {
 *   styleId: string,
 *   jobsCreated: Array<{ id: string, provider: string }>,
 *   errors: string[]
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { retrySyncV4, getSyncStatusV4 } from '@/lib/inventory-v4/sync-queue'
import type { SyncProvider } from '@/lib/inventory-v4/types'

// Force Node.js runtime
export const runtime = 'nodejs'

// Disable caching
export const dynamic = 'force-dynamic'

interface RetryRequestBody {
  styleId: string
  provider?: SyncProvider
}

export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  try {
    // Auth gate
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse body
    const body = await request.json() as RetryRequestBody

    // Validate styleId
    if (!body.styleId || typeof body.styleId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "styleId" field' },
        { status: 400 }
      )
    }

    const styleId = body.styleId.trim().toUpperCase()
    if (styleId.length < 3) {
      return NextResponse.json(
        { error: 'styleId must be at least 3 characters' },
        { status: 400 }
      )
    }

    // Validate provider if provided
    let provider: SyncProvider | undefined
    if (body.provider !== undefined) {
      if (body.provider !== 'stockx' && body.provider !== 'alias') {
        return NextResponse.json(
          { error: 'provider must be "stockx" or "alias"' },
          { status: 400 }
        )
      }
      provider = body.provider
    }

    // Ownership check: user must own at least one item with this SKU
    // This prevents arbitrary users from triggering paid sync calls
    const { data: ownedItem, error: ownershipError } = await supabase
      .from('Inventory')
      .select('id')
      .eq('sku', styleId)
      .limit(1)
      .maybeSingle()

    if (ownershipError) {
      console.error('[API V4 Sync Retry] Ownership check error:', ownershipError)
      return NextResponse.json(
        { error: 'Failed to verify ownership' },
        { status: 500 }
      )
    }

    if (!ownedItem) {
      return NextResponse.json(
        { error: 'You do not own any items with this SKU' },
        { status: 403 }
      )
    }

    // Execute retry
    const result = await retrySyncV4(styleId, provider)

    // Return result
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('[API V4 Sync Retry] Error:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Retry failed: ${message}` },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check sync status for a style
 *
 * GET /api/v4/sync/retry?styleId=DD1391-100
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  try {
    // Auth gate
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get styleId from query params
    const styleId = request.nextUrl.searchParams.get('styleId')

    if (!styleId) {
      return NextResponse.json(
        { error: 'Missing "styleId" query parameter' },
        { status: 400 }
      )
    }

    const normalizedStyleId = styleId.trim().toUpperCase()
    if (normalizedStyleId.length < 3) {
      return NextResponse.json(
        { error: 'styleId must be at least 3 characters' },
        { status: 400 }
      )
    }

    // Ownership check: user must own at least one item with this SKU
    const { data: ownedItem, error: ownershipError } = await supabase
      .from('Inventory')
      .select('id')
      .eq('sku', normalizedStyleId)
      .limit(1)
      .maybeSingle()

    if (ownershipError) {
      console.error('[API V4 Sync Status] Ownership check error:', ownershipError)
      return NextResponse.json(
        { error: 'Failed to verify ownership' },
        { status: 500 }
      )
    }

    if (!ownedItem) {
      return NextResponse.json(
        { error: 'You do not own any items with this SKU' },
        { status: 403 }
      )
    }

    // Get sync status
    const status = await getSyncStatusV4(normalizedStyleId)

    return NextResponse.json(status, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('[API V4 Sync Status] Error:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Status check failed: ${message}` },
      { status: 500 }
    )
  }
}
