/**
 * Unified Ledger API - V4 ONLY
 *
 * Returns combined BUY and SELL transactions:
 * - SELL rows from inventory_v4_sales
 * - BUY rows for items still owned from inventory_v4_items
 * - BUY rows for sold items (derived from inventory_v4_sales)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export type LedgerRowType = 'BUY' | 'SELL'

export interface LedgerRow {
  id: string
  type: LedgerRowType
  date: string | null
  amount: number
  currency: string
  profit: number | null
  platform: string | null
  sku: string
  brand: string | null
  model: string | null
  colorway: string | null
  size_uk: string | null
  image_url: string | null
  category: string | null
  condition: string | null
  // For BUY rows: status of the item
  item_status: string | null
  // For linking back to original item (sold items)
  original_item_id: string | null
  // Sale-specific fields
  sold_price: number | null
  purchase_price: number | null
  sales_fee: number | null
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'ALL' // ALL | BUY | SELL
    const year = searchParams.get('year')
    const platform = searchParams.get('platform')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const rows: LedgerRow[] = []

    // Calculate date range for year filter
    const yearStart = year ? `${year}-01-01` : null
    const yearEnd = year ? `${year}-12-31` : null

    // =========================================================================
    // STREAM 1: SELL rows from inventory_v4_sales
    // =========================================================================
    if (type === 'ALL' || type === 'SELL') {
      let sellQuery = supabase
        .from('inventory_v4_sales')
        .select(`
          id,
          sku,
          brand,
          model,
          colorway,
          size,
          category,
          condition,
          image_url,
          purchase_price,
          purchase_currency,
          purchase_date,
          sold_price,
          sold_date,
          sale_currency,
          platform,
          sales_fee,
          original_item_id
        `)
        .eq('user_id', user.id)

      if (yearStart) sellQuery = sellQuery.gte('sold_date', yearStart)
      if (yearEnd) sellQuery = sellQuery.lte('sold_date', yearEnd)
      if (platform) {
        if (platform.toLowerCase() === 'alias') {
          sellQuery = sellQuery.or('platform.ilike.alias,platform.ilike.goat')
        } else {
          sellQuery = sellQuery.ilike('platform', platform)
        }
      }
      if (search) {
        sellQuery = sellQuery.or(`sku.ilike.%${search}%,brand.ilike.%${search}%,model.ilike.%${search}%`)
      }

      const { data: sellData, error: sellError } = await sellQuery

      if (sellError) {
        console.error('[Ledger API] SELL query error:', sellError)
      } else if (sellData) {
        for (const row of sellData) {
          // Calculate profit
          const costBasis = row.purchase_price || 0
          const salePrice = row.sold_price || 0
          const fees = row.sales_fee || 0
          const profit = salePrice - costBasis - fees

          rows.push({
            id: `sell-${row.id}`,
            type: 'SELL',
            date: row.sold_date,
            amount: row.sold_price || 0,
            currency: row.sale_currency || 'GBP',
            profit,
            platform: row.platform,
            sku: row.sku,
            brand: row.brand,
            model: row.model,
            colorway: row.colorway,
            size_uk: row.size,
            image_url: row.image_url,
            category: row.category,
            condition: row.condition,
            item_status: 'sold',
            original_item_id: row.original_item_id,
            sold_price: row.sold_price,
            purchase_price: row.purchase_price,
            sales_fee: row.sales_fee,
          })
        }
      }
    }

    // =========================================================================
    // STREAM 2: BUY rows for items still owned (from inventory_v4_items)
    // =========================================================================
    if (type === 'ALL' || type === 'BUY') {
      let buyOwnedQuery = supabase
        .from('inventory_v4_items')
        .select(`
          id,
          style_id,
          size,
          size_unit,
          purchase_price,
          purchase_currency,
          purchase_date,
          condition,
          status,
          inventory_v4_style_catalog (
            brand,
            name,
            colorway,
            primary_image_url,
            product_category
          )
        `)
        .eq('user_id', user.id)
        .in('status', ['in_stock', 'consigned', 'listed'])

      if (yearStart) buyOwnedQuery = buyOwnedQuery.gte('purchase_date', yearStart)
      if (yearEnd) buyOwnedQuery = buyOwnedQuery.lte('purchase_date', yearEnd)
      if (search) {
        buyOwnedQuery = buyOwnedQuery.or(`style_id.ilike.%${search}%`)
      }

      const { data: buyOwnedData, error: buyOwnedError } = await buyOwnedQuery

      if (buyOwnedError) {
        console.error('[Ledger API] BUY owned query error:', buyOwnedError)
      } else if (buyOwnedData) {
        for (const row of buyOwnedData) {
          const style = row.inventory_v4_style_catalog as any
          rows.push({
            id: `buy-owned-${row.id}`,
            type: 'BUY',
            date: row.purchase_date,
            amount: -(row.purchase_price || 0), // Negative for BUY
            currency: row.purchase_currency || 'GBP',
            profit: null, // No profit for BUY
            platform: null, // No platform for BUY
            sku: row.style_id,
            brand: style?.brand || null,
            model: style?.name || null,
            colorway: style?.colorway || null,
            size_uk: row.size,
            image_url: style?.primary_image_url || null,
            category: style?.product_category || null,
            condition: row.condition,
            item_status: row.status,
            original_item_id: row.id,
            sold_price: null,
            purchase_price: row.purchase_price,
            sales_fee: null,
          })
        }
      }
    }

    // =========================================================================
    // STREAM 3: BUY rows for sold items (derived from inventory_v4_sales)
    // =========================================================================
    if (type === 'ALL' || type === 'BUY') {
      let buySoldQuery = supabase
        .from('inventory_v4_sales')
        .select(`
          id,
          sku,
          brand,
          model,
          colorway,
          size,
          category,
          condition,
          image_url,
          purchase_price,
          purchase_currency,
          purchase_date,
          original_item_id
        `)
        .eq('user_id', user.id)

      if (yearStart) buySoldQuery = buySoldQuery.gte('purchase_date', yearStart)
      if (yearEnd) buySoldQuery = buySoldQuery.lte('purchase_date', yearEnd)
      if (search) {
        buySoldQuery = buySoldQuery.or(`sku.ilike.%${search}%,brand.ilike.%${search}%,model.ilike.%${search}%`)
      }

      const { data: buySoldData, error: buySoldError } = await buySoldQuery

      if (buySoldError) {
        console.error('[Ledger API] BUY sold query error:', buySoldError)
      } else if (buySoldData) {
        for (const row of buySoldData) {
          rows.push({
            id: `buy-sold-${row.id}`,
            type: 'BUY',
            date: row.purchase_date,
            amount: -(row.purchase_price || 0), // Negative for BUY
            currency: row.purchase_currency || 'GBP',
            profit: null, // No profit for BUY
            platform: null, // No platform for BUY
            sku: row.sku,
            brand: row.brand,
            model: row.model,
            colorway: row.colorway,
            size_uk: row.size,
            image_url: row.image_url,
            category: row.category,
            condition: row.condition,
            item_status: 'sold',
            original_item_id: row.original_item_id,
            sold_price: null,
            purchase_price: row.purchase_price,
            sales_fee: null,
          })
        }
      }
    }

    // Sort by date descending
    rows.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0
      const dateB = b.date ? new Date(b.date).getTime() : 0
      return dateB - dateA
    })

    // Apply pagination
    const total = rows.length
    const paginatedRows = rows.slice(offset, offset + limit)

    return NextResponse.json({
      rows: paginatedRows,
      total,
      offset,
      limit,
    })
  } catch (error) {
    console.error('[Ledger API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
