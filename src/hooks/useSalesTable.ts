'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'

export interface SalesItem {
  id: string
  user_id: string
  sku: string
  brand?: string | null
  model?: string | null
  variant?: string | null
  colorway?: string | null
  size_uk?: string | null
  size_alt?: string | null
  condition?: 'New' | 'Used' | 'Worn' | 'Defect' | null
  category?: string | null
  purchase_price: number
  purchase_date?: string | null
  tax?: number | null
  shipping?: number | null
  place_of_purchase?: string | null
  order_number?: string | null
  sold_price?: number | null
  sold_date?: string | null
  sold_platform?: string | null
  sold_fees?: number | null
  market_value?: number | null
  market_updated_at?: string | null
  market_meta?: {
    sources_used?: string[]
    confidence?: string
  } | null
  location?: string | null
  image_url?: string | null
  tags?: string[] | null
  watchlist_id?: string | null
  custom_market_value?: number | null
  notes?: string | null
  status: 'sold'
  created_at: string
  updated_at?: string | null
  margin_gbp?: number | null
  margin_percent?: number | null
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

      let query = supabase.from('sales_view').select('*', { count: 'exact' })

      // Search filter (SKU, brand, model)
      if (params.search) {
        query = query.or(`sku.ilike.%${params.search}%,brand.ilike.%${params.search}%,model.ilike.%${params.search}%`)
      }

      // Brand filter
      if (params.brand) {
        query = query.eq('brand', params.brand)
      }

      // Size filter
      if (params.size_uk) {
        query = query.eq('size_uk', params.size_uk)
      }

      // Category filter
      if (params.category) {
        query = query.eq('category', params.category)
      }

      // Platform filter
      if (params.platform) {
        query = query.eq('sold_platform', params.platform)
      }

      // Date range filter
      if (params.date_from) {
        query = query.gte('sold_date', params.date_from)
      }
      if (params.date_to) {
        query = query.lte('sold_date', params.date_to)
      }

      // Sorting
      const sortBy = params.sort_by || 'sold_date'
      const sortOrder = params.sort_order || 'desc'
      query = query.order(sortBy, { ascending: sortOrder === 'asc' })

      // Pagination
      if (params.limit) {
        query = query.range(params.offset || 0, (params.offset || 0) + params.limit - 1)
      }

      const { data, error: fetchError, count } = await query

      if (fetchError) throw fetchError

      setItems((data as SalesItem[]) || [])
      setTotal(count || 0)
    } catch (err: any) {
      console.error('Sales fetch error:', err)
      setError(err.message || 'Failed to load sales')
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
    item.size_uk || item.size_alt || '',
    item.condition || '',
    item.purchase_price?.toFixed(2) || '0.00',
    item.purchase_date || '',
    item.sold_price?.toFixed(2) || '0.00',
    item.sold_date || '',
    item.sold_platform || '',
    item.sold_fees?.toFixed(2) || '0.00',
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
