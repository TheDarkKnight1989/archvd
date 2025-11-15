/**
 * GET /api/transactions/export
 * WHY: Export transactions to CSV with filters applied
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'sale' // 'sale' or 'purchase'
    const q = searchParams.get('q') || ''
    const timeRange = searchParams.get('timeRange') || 'all'

    // Build time filter
    let timeFilter: Date | null = null
    if (timeRange === '7d') {
      timeFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    } else if (timeRange === '30d') {
      timeFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    } else if (timeRange === '90d') {
      timeFilter = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    }

    // Fetch transactions
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', type)
      .order('occurred_at', { ascending: false })

    if (timeFilter) {
      query = query.gte('occurred_at', timeFilter.toISOString())
    }

    const { data: transactions, error } = await query

    if (error) throw error

    // Filter by search query if provided
    let filtered = transactions || []
    if (q) {
      const searchLower = q.toLowerCase()
      filtered = filtered.filter(tx =>
        tx.title?.toLowerCase().includes(searchLower) ||
        tx.sku?.toLowerCase().includes(searchLower) ||
        tx.platform?.toLowerCase().includes(searchLower)
      )
    }

    // Build CSV
    const headers = type === 'sale'
      ? ['Date', 'Title', 'SKU', 'Size', 'Qty', 'Sale Price', 'Fees', 'Total', 'Platform', 'Notes']
      : ['Date', 'Title', 'SKU', 'Size', 'Qty', 'Purchase Price', 'Fees', 'Total', 'Platform', 'Notes']

    const rows = filtered.map(tx => [
      new Date(tx.occurred_at).toISOString().split('T')[0],
      tx.title || '',
      tx.sku || '',
      tx.size_uk || '',
      tx.qty,
      tx.unit_price.toFixed(2),
      (tx.fees || 0).toFixed(2),
      tx.total.toFixed(2),
      tx.platform || '',
      tx.notes || '',
    ].map(field => `"${field}"`))

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="transactions-${type}-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error: any) {
    console.error('[Export Transactions] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
