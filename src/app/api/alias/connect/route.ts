/**
 * Alias Connect API
 * POST /api/alias/connect
 * Connects user's Alias account by validating and storing their PAT
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AliasClient } from '@/lib/services/alias/client'
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

    // 2. Parse request body
    const body = await request.json()
    const { pat } = body

    if (!pat || typeof pat !== 'string') {
      return NextResponse.json(
        { error: 'Personal Access Token (PAT) is required' },
        { status: 400 }
      )
    }

    // 3. Validate PAT by calling Alias /test endpoint
    logger.info('[Alias Connect] Validating PAT...', { userId: user.id })

    let aliasUsername = null
    try {
      const client = new AliasClient(pat)
      const testResponse = await client.test()

      logger.info('[Alias Connect] PAT validation successful', {
        userId: user.id,
        testResponse,
      })

      // Extract username if available in test response
      aliasUsername = (testResponse as any)?.username || null
    } catch (error: any) {
      logger.error('[Alias Connect] PAT validation failed', {
        userId: user.id,
        error: error.message,
      })

      return NextResponse.json(
        {
          error: 'Invalid Personal Access Token',
          details: error.message,
        },
        { status: 401 }
      )
    }

    // 4. Store PAT in alias_accounts table
    const { data: existingAccount } = await supabase
      .from('alias_accounts')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existingAccount) {
      // Update existing account
      const { error: updateError } = await supabase
        .from('alias_accounts')
        .update({
          access_token: pat,
          status: 'active',
          alias_username: aliasUsername,
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)

      if (updateError) {
        logger.error('[Alias Connect] Failed to update account', {
          userId: user.id,
          error: updateError,
        })
        return NextResponse.json(
          { error: 'Failed to update account' },
          { status: 500 }
        )
      }

      logger.info('[Alias Connect] Account updated successfully', {
        userId: user.id,
      })
    } else {
      // Create new account
      const { error: insertError } = await supabase
        .from('alias_accounts')
        .insert({
          user_id: user.id,
          access_token: pat,
          status: 'active',
          alias_username: aliasUsername,
          last_sync_at: new Date().toISOString(),
        })

      if (insertError) {
        logger.error('[Alias Connect] Failed to create account', {
          userId: user.id,
          error: insertError,
        })
        return NextResponse.json(
          { error: 'Failed to create account' },
          { status: 500 }
        )
      }

      logger.info('[Alias Connect] Account created successfully', {
        userId: user.id,
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Alias account connected successfully',
      username: aliasUsername,
    })
  } catch (error: any) {
    logger.error('[Alias Connect] Unexpected error', {
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
