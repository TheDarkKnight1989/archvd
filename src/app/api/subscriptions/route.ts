// Subscriptions API - Create and manage subscriptions with FX snapshots
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const {
      name,
      vendor,
      amount,
      currency = 'GBP',
      interval,
      next_charge,
      notes,
      is_active = true,
      subscription_currency = 'GBP', // Currency in which subscription is billed
    } = body

    // Validate required fields
    if (!name || !amount || !interval) {
      return NextResponse.json(
        { error: 'Missing required fields: name, amount, interval' },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    if (!['monthly', 'annual'].includes(interval)) {
      return NextResponse.json(
        { error: 'Interval must be either "monthly" or "annual"' },
        { status: 400 }
      )
    }

    // Fetch user's base currency
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('base_currency')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[Add Subscription] Profile fetch error:', profileError)
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      )
    }

    const baseCurrency = profile?.base_currency || 'GBP'

    // Calculate FX rate and subscription amount in base currency using database function
    const { data: fxData, error: fxError } = await supabase
      .rpc('fx_rate_for', {
        date_in: new Date().toISOString().split('T')[0], // Use today's date for subscriptions
        from_ccy: subscription_currency,
        to_ccy: baseCurrency
      })

    if (fxError) {
      console.error('[Add Subscription] FX rate error:', fxError)
      return NextResponse.json(
        { error: `Failed to calculate FX rate: ${fxError.message}` },
        { status: 500 }
      )
    }

    const subscriptionFxRate = fxData || 1.0
    const subscriptionAmountBase = amount * subscriptionFxRate

    // Insert subscription with FX snapshot
    const insertData: any = {
      user_id: user.id,
      name,
      vendor: vendor || null,
      amount,
      currency,
      interval,
      next_charge: next_charge || null,
      notes: notes || null,
      is_active,
      // FX snapshot fields
      subscription_currency,
      subscription_base_ccy: baseCurrency,
      subscription_fx_rate: subscriptionFxRate,
      subscription_amount_base: subscriptionAmountBase,
      subscription_fx_source: 'auto',
    }

    const { data: newSubscription, error: insertError } = await supabase
      .from('subscriptions')
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      console.error('[Add Subscription] Insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to create subscription', details: insertError.message },
        { status: 500 }
      )
    }

    // Log FX conversion audit trail
    const { error: auditError } = await supabase
      .from('fx_audit_log')
      .insert({
        user_id: user.id,
        table_name: 'subscriptions',
        record_id: newSubscription.id,
        field_prefix: 'subscription',
        original_currency: subscription_currency,
        original_amount: amount,
        base_currency: baseCurrency,
        fx_rate: subscriptionFxRate,
        fx_date: new Date().toISOString().split('T')[0],
        base_amount: subscriptionAmountBase,
        fx_source: 'auto'
      })

    if (auditError) {
      console.error('[Add Subscription] Audit log error:', auditError)
      // Don't fail the request if audit logging fails, just log the error
    }

    return NextResponse.json({
      success: true,
      subscription: newSubscription,
      fx_info: {
        original_currency: subscription_currency,
        original_amount: amount,
        base_currency: baseCurrency,
        fx_rate: subscriptionFxRate,
        base_amount: subscriptionAmountBase
      }
    })

  } catch (error: any) {
    console.error('[Add Subscription] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
