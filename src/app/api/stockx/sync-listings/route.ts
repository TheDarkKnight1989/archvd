/**
 * StockX Listings Sync API Route
 * POST /api/stockx/sync-listings
 *
 * Manually triggers a sync of the user's StockX listings
 * Verifies user authentication and StockX integration before syncing
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncUserStockxListings } from '@/lib/services/stockx/listings-sync'

// Force dynamic rendering - never cache this route
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // ========================================================================
    // 1. Authenticate user
    // ========================================================================

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[StockX Sync API] Unauthorized:', {
        hasError: !!authError,
        errorMessage: authError?.message,
      })

      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'Please log in to sync StockX listings',
        },
        { status: 401 }
      )
    }

    console.log('[StockX Sync API] User authenticated:', {
      userId: user.id,
      email: user.email,
    })

    // ========================================================================
    // 2. Verify user has StockX integration connected
    // ========================================================================

    const { data: stockxAccount, error: accountError } = await supabase
      .from('stockx_accounts')
      .select('user_id, access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .single()

    if (accountError || !stockxAccount) {
      console.warn('[StockX Sync API] No StockX integration found:', {
        userId: user.id,
        error: accountError?.message,
      })

      return NextResponse.json(
        {
          success: false,
          error: 'No StockX Integration',
          message: 'Please connect your StockX account before syncing',
          hint: 'Go to Settings → Integrations to connect StockX',
        },
        { status: 400 }
      )
    }

    console.log('[StockX Sync API] StockX integration verified:', {
      userId: user.id,
      hasAccessToken: !!stockxAccount.access_token,
      hasRefreshToken: !!stockxAccount.refresh_token,
    })

    // ========================================================================
    // 3. Parse request body (optional mode parameter)
    // ========================================================================

    let mode: 'quick' | 'full' = 'quick' // Default to quick mode (ACTIVE/PENDING only)
    try {
      const body = await request.json()
      if (body.mode === 'full') {
        mode = 'full'
      }
    } catch {
      // No body or invalid JSON - use default
    }

    // ========================================================================
    // 4. Call sync engine
    // ========================================================================

    console.log('[StockX Sync API] Starting sync for user:', user.id, 'mode:', mode)

    const summary = await syncUserStockxListings(user.id, mode)

    const duration = Date.now() - startTime

    console.log('[StockX Sync API] Sync completed:', {
      userId: user.id,
      mode,
      duration_ms: duration,
      summary,
    })

    // ========================================================================
    // 5. Return success with summary
    // ========================================================================

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      ...summary,
    })

  } catch (error: any) {
    const duration = Date.now() - startTime

    console.error('[StockX Sync API] Error:', {
      error: error.message,
      stack: error.stack,
      duration_ms: duration,
    })

    // Check if it's an auth error (401) from StockX
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      return NextResponse.json(
        {
          success: false,
          error: 'StockX Authentication Failed',
          message: 'Your StockX connection has expired. Please reconnect your account.',
          details: error.message,
          duration_ms: duration,
        },
        { status: 401 }
      )
    }

    // Generic error
    return NextResponse.json(
      {
        success: false,
        error: 'Sync Failed',
        message: error.message || 'Failed to sync StockX listings',
        details: error.stack,
        duration_ms: duration,
      },
      { status: 500 }
    )
  }
}
