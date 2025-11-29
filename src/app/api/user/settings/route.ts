/**
 * User Settings API
 * GET: Fetch user settings (with auto-create if missing)
 * PATCH: Update user settings
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/user/settings
 * Fetch user settings, auto-create if missing
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession()

    if (authError || !session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user settings
    const { data: settings, error: fetchError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', session.user.id)
      .single()

    // If settings don't exist, create default settings
    if (fetchError?.code === 'PGRST116' || !settings) {
      const { data: newSettings, error: createError } = await supabase
        .from('user_settings')
        .insert({
          user_id: session.user.id,
          stockx_seller_level: 1,
          stockx_shipping_fee: 0.0,
          currency_preference: 'GBP',
          timezone: 'Europe/London',
        })
        .select()
        .single()

      if (createError) {
        console.error('[User Settings] Error creating default settings:', createError)
        return NextResponse.json(
          { error: 'Failed to create settings', details: createError.message },
          { status: 500 }
        )
      }

      return NextResponse.json(newSettings)
    }

    if (fetchError) {
      console.error('[User Settings] Error fetching settings:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch settings', details: fetchError.message },
        { status: 500 }
      )
    }

    return NextResponse.json(settings)
  } catch (error: any) {
    console.error('[User Settings] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/user/settings
 * Update user settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession()

    if (authError || !session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate stockx_seller_level if provided
    if (body.stockx_seller_level !== undefined) {
      const level = parseInt(body.stockx_seller_level, 10)
      if (isNaN(level) || level < 1 || level > 5) {
        return NextResponse.json(
          { error: 'Invalid seller level', details: 'Seller level must be between 1 and 5' },
          { status: 400 }
        )
      }
      body.stockx_seller_level = level
    }

    // Validate stockx_shipping_fee if provided
    if (body.stockx_shipping_fee !== undefined) {
      const fee = parseFloat(body.stockx_shipping_fee)
      if (isNaN(fee) || fee < 0) {
        return NextResponse.json(
          { error: 'Invalid shipping fee', details: 'Shipping fee must be >= 0' },
          { status: 400 }
        )
      }
      body.stockx_shipping_fee = fee
    }

    // Check if settings exist
    const { data: existing } = await supabase
      .from('user_settings')
      .select('id')
      .eq('user_id', session.user.id)
      .single()

    let result

    if (!existing) {
      // Create new settings with provided values
      const { data, error } = await supabase
        .from('user_settings')
        .insert({
          user_id: session.user.id,
          ...body,
        })
        .select()
        .single()

      if (error) {
        console.error('[User Settings] Error creating settings:', error)
        return NextResponse.json(
          { error: 'Failed to create settings', details: error.message },
          { status: 500 }
        )
      }

      result = data
    } else {
      // Update existing settings
      const { data, error } = await supabase
        .from('user_settings')
        .update(body)
        .eq('user_id', session.user.id)
        .select()
        .single()

      if (error) {
        console.error('[User Settings] Error updating settings:', error)
        return NextResponse.json(
          { error: 'Failed to update settings', details: error.message },
          { status: 500 }
        )
      }

      result = data
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[User Settings] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
