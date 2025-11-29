'use client'

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
  tax?: number | null
  shipping?: number | null
  place_of_purchase?: string | null
  order_number?: string | null
  sold_price?: number | null
  sold_date?: string | null
  sale_date?: string | null
  sale_price?: number | null
  platform?: string | null
  sales_fee?: number | null
  location?: string | null
  image_url?: string | null
  tags?: string[] | null
  custom_market_value?: number | null
  notes?: string | null
  status: 'sold'
  created_at: string
  updated_at?: string | null
  margin_gbp?: number | null
  margin_percent?: number | null
  // StockX fields
  commission?: number | null
  net_payout?: number | null
  stockx_order_id?: string | null
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

export function useSalesTable(params: SalesTableParams = {}) {
  const [items, setItems] = useState<SalesItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  const fetchSales = async () => {
    try {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('Inventory')
        .select(`
          id,
          user_id,
          sku,
          brand,
          model,
          colorway,
          size_uk,
          category,
          condition,
          image_url,
          purchase_price,
          tax,
          shipping,
          purchase_total,
          purchase_date,
          place_of_purchase,
          order_number,
          sold_price,
          sold_date,
          platform,
          sales_fee,
          notes,
          location,
          tags,
          custom_market_value,
          status,
          created_at,
          updated_at
        `, { count: 'exact' })
        .eq('status', 'sold')

      if (params.search) {
        query = query.or(`sku.ilike.%${params.search}%,brand.ilike.%${params.search}%,model.ilike.%${params.search}%`)
      }

      if (params.brand) query = query.eq('brand', params.brand)
      if (params.size_uk) query = query.eq('size_uk', params.size_uk)
      if (params.category) query = query.eq('category', params.category)
      if (params.platform) {
        // Handle 'alias' filter to also match 'goat' (database value for Alias)
        if (params.platform.toLowerCase() === 'alias') {
          query = query.or('platform.ilike.alias,platform.ilike.goat')
        } else {
          query = query.ilike('platform', params.platform)
        }
      }
      if (params.date_from) query = query.gte('sold_date', params.date_from)
      if (params.date_to) query = query.lte('sold_date', params.date_to)

      const sortBy = params.sort_by || 'sold_date'
      const sortOrder = params.sort_order || 'desc'
      query = query.order(sortBy, { ascending: sortOrder === 'asc' })

      if (params.limit) {
        query = query.range(params.offset || 0, (params.offset || 0) + params.limit - 1)
      }

      const { data, error: fetchError, count } = await query

      if (fetchError) throw fetchError

      const enrichedData = (data || []).map((item: any) => {
        const costBasis = item.purchase_total || (item.purchase_price + (item.tax || 0) + (item.shipping || 0))
        const salePrice = item.sold_price || item.sale_price || 0
        const fees = item.sales_fee || 0
        const margin_gbp = salePrice - costBasis - fees
        const margin_percent = costBasis > 0 ? (margin_gbp / costBasis) * 100 : null

        const isStockX = item.platform?.toLowerCase() === 'stockx'

        return {
          ...item,
          size: item.size_uk,
          margin_gbp,
          margin_percent,
          commission: isStockX ? fees : null,
          net_payout: isStockX ? (salePrice - fees) : null,
        } as SalesItem
      })

      setItems(enrichedData)
      setTotal(count || 0)
    } catch (err: any) {
      console.error('Sales fetch error:', err)
      const errorMessage = err?.message || err?.toString() || 'Failed to load sales'
      console.error('Error details:', { message: errorMessage, code: err?.code, details: err?.details })
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSales()
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
    refetch: fetchSales,
  }
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
    item.purchase_date || '',
    item.sold_price?.toFixed(2) || '0.00',
    item.sold_date || '',
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
