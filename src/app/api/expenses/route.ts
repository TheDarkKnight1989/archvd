// Expenses API - Create and manage expenses with FX snapshots
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
      category,
      amount,
      date,
      description,
      linked_item_id,
      expense_currency = 'GBP', // Currency in which expense was incurred
    } = body

    // Validate required fields
    if (!category || !amount || !date || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: category, amount, date, description' },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
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
      console.error('[Add Expense] Profile fetch error:', profileError)
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      )
    }

    const baseCurrency = profile?.base_currency || 'GBP'

    // Calculate FX rate and expense amount in base currency using database function
    const { data: fxData, error: fxError } = await supabase
      .rpc('fx_rate_for', {
        date_in: date,
        from_ccy: expense_currency,
        to_ccy: baseCurrency
      })

    if (fxError) {
      console.error('[Add Expense] FX rate error:', fxError)
      return NextResponse.json(
        { error: `Failed to calculate FX rate: ${fxError.message}` },
        { status: 500 }
      )
    }

    const expenseFxRate = fxData || 1.0
    const expenseAmountBase = amount * expenseFxRate

    // Insert expense with FX snapshot
    const insertData: any = {
      user_id: user.id,
      category,
      amount,
      date,
      description,
      // FX snapshot fields
      expense_currency,
      expense_date: date,
      expense_base_ccy: baseCurrency,
      expense_fx_rate: expenseFxRate,
      expense_amount_base: expenseAmountBase,
      expense_fx_source: 'auto',
    }

    if (linked_item_id) {
      insertData.linked_item_id = linked_item_id
    }

    const { data: newExpense, error: insertError } = await supabase
      .from('expenses')
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      console.error('[Add Expense] Insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to create expense', details: insertError.message },
        { status: 500 }
      )
    }

    // Log FX conversion audit trail
    const { error: auditError } = await supabase
      .from('fx_audit_log')
      .insert({
        user_id: user.id,
        table_name: 'expenses',
        record_id: newExpense.id,
        field_prefix: 'expense',
        original_currency: expense_currency,
        original_amount: amount,
        base_currency: baseCurrency,
        fx_rate: expenseFxRate,
        fx_date: date,
        base_amount: expenseAmountBase,
        fx_source: 'auto'
      })

    if (auditError) {
      console.error('[Add Expense] Audit log error:', auditError)
      // Don't fail the request if audit logging fails, just log the error
    }

    return NextResponse.json({
      success: true,
      expense: newExpense,
      fx_info: {
        original_currency: expense_currency,
        original_amount: amount,
        base_currency: baseCurrency,
        fx_rate: expenseFxRate,
        base_amount: expenseAmountBase
      }
    })

  } catch (error: any) {
    console.error('[Add Expense] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
