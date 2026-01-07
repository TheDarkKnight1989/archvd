'use client'

/**
 * Sales Table Hook - V4 ONLY
 * Reads exclusively from inventory_v4_sales table.
 * V3 tables are frozen and no longer read.
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'

export interface SalesItem {
  id: string
  user_id: string
  sku: string
  brand?: string | null
  model?: string | null
  colorway?: string | null
  size_uk?: string | null
  size?: string | null
  condition?: 'New' | 'Used' | 'Worn' | 'Defect' | null
  category?: string | null
  purchase_price: number
  purchase_total?: number | null
  purchase_date?: string | null
  sold_price?: number | null
  sold_date?: string | null
  platform?: string | null
  sales_fee?: number | null
  location?: string | null
  image_url?: string | null
  tags?: string[] | null
  notes?: string | null
  status: 'sold'
  created_at: string
  updated_at?: string | null
  margin_gbp?: number | null
  margin_percent?: number | null
  // StockX fields
  commission?: number | null
  net_payout?: number | null
  // V4 fields
  original_item_id?: string | null
}

export interface SalesTableParams {
  search?: string
  brand?: string
  size_uk?: string
  category?: string
  platform?: string
  sort_by?: 'sold_date' | 'sold_price' | 'margin_gbp' | 'margin_percent'
  sort_order?: 'asc' | 'desc'
  date_from?: string
  date_to?: string
  limit?: number
  offset?: number
}

// Fetch from V4 sales table ONLY
async function fetchSales(params: SalesTableParams): Promise<{ data: SalesItem[], count: number }> {
  let query = supabase
    .from('inventory_v4_sales')
    .select(`
      id,
      user_id,
      style_id,
      sku,
      brand,
      model,
      colorway,
      size,
      size_unit,
      category,
      condition,
      image_url,
      purchase_price,
      purchase_total,
      purchase_date,
      purchase_currency,
      sold_price,
      sold_date,
      sale_currency,
      platform,
      sales_fee,
      shipping_cost,
      notes,
      location,
      tags,
      original_item_id,
      base_currency,
      fx_rate_to_base,
      sold_price_base,
      created_at,
      updated_at
    `, { count: 'exact' })

  if (params.search) {
    query = query.or(`sku.ilike.%${params.search}%,brand.ilike.%${params.search}%,model.ilike.%${params.search}%,style_id.ilike.%${params.search}%`)
  }

  if (params.brand) query = query.eq('brand', params.brand)
  if (params.size_uk) query = query.eq('size', params.size_uk)
  if (params.category) query = query.eq('category', params.category)
  if (params.platform) {
    if (params.platform.toLowerCase() === 'alias') {
      query = query.or('platform.ilike.alias,platform.ilike.goat')
    } else {
      query = query.ilike('platform', params.platform)
    }
  }
  if (params.date_from) query = query.gte('sold_date', params.date_from)
  if (params.date_to) query = query.lte('sold_date', params.date_to)

  // Only sort by actual DB columns - margin_gbp/margin_percent are computed client-side
  const dbSortableColumns = ['sold_date', 'sold_price', 'purchase_price']
  const sortBy = dbSortableColumns.includes(params.sort_by || '') ? params.sort_by : 'sold_date'
  const sortOrder = params.sort_order || 'desc'
  query = query.order(sortBy!, { ascending: sortOrder === 'asc' })

  if (params.limit) {
    query = query.limit(params.limit)
  }
  if (params.offset) {
    query = query.range(params.offset, params.offset + (params.limit || 50) - 1)
  }

  const { data, error, count } = await query

  if (error) {
    // If table doesn't exist yet, return empty
    if (error.code === '42P01') {
      console.warn('[useSalesTable] V4 sales table not found')
      return { data: [], count: 0 }
    }
    throw error
  }

  // Transform V4 data to SalesItem format
  const transformedData = (data || []).map((item: any) => {
    const costBasis = item.purchase_total || (item.purchase_price || 0)
    const salePrice = item.sold_price || 0
    const fees = item.sales_fee || 0
    const margin_gbp = salePrice - costBasis - fees
    const margin_percent = costBasis > 0 ? (margin_gbp / costBasis) * 100 : null

    const isStockX = item.platform?.toLowerCase() === 'stockx'

    return {
      id: item.id,
      user_id: item.user_id,
      sku: item.sku || item.style_id,
      brand: item.brand,
      model: item.model,
      colorway: item.colorway,
      size_uk: item.size,
      size: item.size,
      category: item.category,
      condition: item.condition,
      image_url: item.image_url,
      purchase_price: item.purchase_price || 0,
      purchase_total: item.purchase_total,
      purchase_date: item.purchase_date,
      sold_price: item.sold_price,
      sold_date: item.sold_date,
      platform: item.platform,
      sales_fee: item.sales_fee,
      notes: item.notes,
      location: item.location,
      tags: item.tags,
      status: 'sold' as const,
      created_at: item.created_at,
      updated_at: item.updated_at,
      margin_gbp,
      margin_percent,
      commission: isStockX ? fees : null,
      net_payout: isStockX ? (salePrice - fees) : null,
      original_item_id: item.original_item_id,
    } as SalesItem
  })

  return { data: transformedData, count: count || 0 }
}

export function useSalesTable(params: SalesTableParams = {}) {
  const [items, setItems] = useState<SalesItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  const loadSales = async () => {
    try {
      setLoading(true)
      setError(null)

      // V4 ONLY - no V3 fallback
      const result = await fetchSales(params)

      setItems(result.data)
      setTotal(result.count)
    } catch (err: any) {
      // Supabase errors have .message and .code, regular errors have .message
      const errorMessage = err?.message || err?.code || (typeof err === 'string' ? err : 'Failed to load sales')
      console.error('[useSalesTable] Fetch error:', errorMessage, err?.code, err?.details)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSales()
  }, [
    params.search,
    params.brand,
    params.size_uk,
    params.category,
    params.platform,
    params.sort_by,
    params.sort_order,
    params.date_from,
    params.date_to,
    params.limit,
    params.offset,
  ])

  return {
    items,
    loading,
    error,
    total,
    refetch: loadSales,
  }
}

// Format date to YYYY-MM-DD (date only, no time/timezone)
function formatDateForCSV(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  return dateStr.split('T')[0]
}

// Export CSV helper
export function exportSalesToCSV(items: SalesItem[], filename = 'sales-export.csv') {
  const headers = [
    'SKU',
    'Brand',
    'Model',
    'Colorway',
    'Size (UK)',
    'Condition',
    'Purchase Price',
    'Purchase Date',
    'Sold Price',
    'Sold Date',
    'Platform',
    'Fees',
    'Margin (£)',
    'Margin (%)',
    'Location',
    'Tags',
    'Notes',
  ]

  const rows = items.map(item => [
    item.sku || '',
    item.brand || '',
    item.model || '',
    item.colorway || '',
    item.size_uk || '',
    item.condition || '',
    item.purchase_price?.toFixed(2) || '0.00',
    formatDateForCSV(item.purchase_date),
    item.sold_price?.toFixed(2) || '0.00',
    formatDateForCSV(item.sold_date),
    item.platform || '',
    item.sales_fee?.toFixed(2) || '0.00',
    item.margin_gbp?.toFixed(2) || '0.00',
    item.margin_percent?.toFixed(2) || '0.00',
    item.location || '',
    item.tags?.join('; ') || '',
    item.notes || '',
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
