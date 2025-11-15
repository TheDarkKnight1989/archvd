/**
 * GET /api/transactions/history/purchases
 * WHY: Fetch purchases history with KPIs (Total Spent, Total Items, Unique Products, Recent 7d)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TxHistoryResponse, TxRow } from '@/lib/transactions/types'

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

    // Fetch purchase transactions
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'purchase')
      .order('occurred_at', { ascending: false })

    if (timeFilter) {
      query = query.gte('occurred_at', timeFilter.toISOString())
    }

    const { data: purchases, error } = await query

    if (error) throw error

    // Filter by search query if provided
    let filteredPurchases = purchases || []
    if (q) {
      const searchLower = q.toLowerCase()
      filteredPurchases = filteredPurchases.filter(purchase =>
        purchase.title?.toLowerCase().includes(searchLower) ||
        purchase.sku?.toLowerCase().includes(searchLower) ||
        purchase.platform?.toLowerCase().includes(searchLower)
      )
    }

    // Compute KPIs
    const totalSpent = filteredPurchases.reduce((sum, p) => sum + p.total + (p.fees || 0), 0)
    const totalItems = filteredPurchases.reduce((sum, p) => sum + p.qty, 0)
    const uniqueProducts = new Set(filteredPurchases.map(p => p.sku).filter(Boolean)).size

    // Recent 7d
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recent7d = filteredPurchases.filter(p => new Date(p.occurred_at) >= sevenDaysAgo).length

    // Map to TxRow format
    const rows: TxRow[] = filteredPurchases.map(purchase => ({
      id: purchase.id,
      title: purchase.title || 'Unknown Product',
      subtitle: [
        purchase.size_uk ? `Size: UK${purchase.size_uk}` : null,
        purchase.sku,
      ].filter(Boolean).join('  •  '),
      imageUrl: purchase.image_url || '/images/placeholders/product.svg',
      qty: purchase.qty,
      purchasePrice: purchase.unit_price,
      total: purchase.total,
      fees: purchase.fees || 0,
      occurredAt: purchase.occurred_at,
      platform: purchase.platform,
      // Additional fields for edit modal
      unit_price: purchase.unit_price,
      sku: purchase.sku,
      size_uk: purchase.size_uk,
      image_url: purchase.image_url,
      notes: purchase.notes,
      type: purchase.type,
      user_id: purchase.user_id,
      inventory_id: purchase.inventory_id,
    }))

    const response: TxHistoryResponse = {
      kpis: {
        totalSpent,
        totalItems,
        uniqueProducts,
        recent7d,
      },
      rows,
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('[Transactions Purchases History] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
