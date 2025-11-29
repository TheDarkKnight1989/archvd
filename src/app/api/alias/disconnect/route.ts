/**
 * Alias Disconnect API
 * POST /api/alias/disconnect
 * Disconnects user's Alias account by removing stored credentials
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Delete user's Alias account record
    const { error: deleteError } = await supabase
      .from('alias_accounts')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      logger.error('[Alias Disconnect] Failed to delete account', {
        userId: user.id,
        error: deleteError,
      })
      return NextResponse.json(
        { error: 'Failed to disconnect account' },
        { status: 500 }
      )
    }

    logger.info('[Alias Disconnect] Account disconnected successfully', {
      userId: user.id,
    })

    return NextResponse.json({
      success: true,
      message: 'Alias account disconnected successfully',
    })
  } catch (error: any) {
    logger.error('[Alias Disconnect] Unexpected error', {
      error: error.message,
      stack: error.stack,
    })

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error.message,
      },
      { status: 500 }
    )
  }
}
