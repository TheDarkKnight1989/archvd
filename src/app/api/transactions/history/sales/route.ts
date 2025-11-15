/**
 * GET /api/transactions/history/sales
 * WHY: Fetch sales history with KPIs (Total Sales, Realized Gains, Avg Gain %)
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

    // Fetch sales transactions
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'sale')
      .order('occurred_at', { ascending: false })

    if (timeFilter) {
      query = query.gte('occurred_at', timeFilter.toISOString())
    }

    const { data: sales, error } = await query

    if (error) throw error

    // Filter by search query if provided
    let filteredSales = sales || []
    if (q) {
      const searchLower = q.toLowerCase()
      filteredSales = filteredSales.filter(sale =>
        sale.title?.toLowerCase().includes(searchLower) ||
        sale.sku?.toLowerCase().includes(searchLower) ||
        sale.platform?.toLowerCase().includes(searchLower)
      )
    }

    // For each sale, fetch linked inventory to get cost basis
    const salesWithInventory = await Promise.all(
      filteredSales.map(async (sale) => {
        let costBasis = 0

        if (sale.inventory_id) {
          const { data: inv } = await supabase
            .from('Inventory')
            .select('purchase_price, tax, shipping')
            .eq('id', sale.inventory_id)
            .single()

          if (inv) {
            costBasis = (inv.purchase_price || 0) + (inv.tax || 0) + (inv.shipping || 0)
          }
        }

        return { ...sale, costBasis }
      })
    )

    // Compute KPIs
    const totalSales = salesWithInventory.reduce((sum, s) => sum + s.total, 0)
    const realizedGains = salesWithInventory.reduce((sum, s) => {
      const pl = s.total - s.costBasis - (s.fees || 0)
      return sum + pl
    }, 0)
    const transactions = salesWithInventory.length
    const avgGainPct = salesWithInventory.length > 0
      ? salesWithInventory.reduce((sum, s) => {
          const pl = s.total - s.costBasis - (s.fees || 0)
          const pct = s.costBasis > 0 ? (pl / s.costBasis) * 100 : 0
          return sum + pct
        }, 0) / salesWithInventory.length
      : 0

    // Map to TxRow format
    const rows: TxRow[] = salesWithInventory.map(sale => {
      const pl = sale.total - sale.costBasis - (sale.fees || 0)
      const performancePct = sale.costBasis > 0 ? (pl / sale.costBasis) * 100 : 0

      return {
        id: sale.id,
        title: sale.title || 'Unknown Product',
        subtitle: [
          sale.size_uk ? `Size: UK${sale.size_uk}` : null,
          sale.sku,
        ].filter(Boolean).join('  •  '),
        imageUrl: sale.image_url || '/images/placeholders/product.svg',
        qty: sale.qty,
        salePrice: sale.unit_price,
        total: sale.total,
        fees: sale.fees || 0,
        realizedPL: pl,
        performancePct,
        occurredAt: sale.occurred_at,
        platform: sale.platform,
        // Additional fields for edit modal
        unit_price: sale.unit_price,
        sku: sale.sku,
        size_uk: sale.size_uk,
        image_url: sale.image_url,
        notes: sale.notes,
        type: sale.type,
        user_id: sale.user_id,
        inventory_id: sale.inventory_id,
      }
    })

    const response: TxHistoryResponse = {
      kpis: {
        totalSales,
        realizedGains,
        transactions,
        avgGainPct,
      },
      rows,
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('[Transactions Sales History] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
