'use client'

/**
 * Ledger Hook - V4 ONLY
 * Fetches unified BUY + SELL transactions from /api/v4/ledger
 */

import { useState, useEffect, useCallback } from 'react'

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
  item_status: string | null
  original_item_id: string | null
  sold_price: number | null
  purchase_price: number | null
  sales_fee: number | null
}

export interface LedgerParams {
  type?: 'ALL' | 'BUY' | 'SELL'
  year?: number
  platform?: string
  search?: string
  limit?: number
  offset?: number
}

export interface LedgerResponse {
  rows: LedgerRow[]
  total: number
  offset: number
  limit: number
}

export function useLedger(params: LedgerParams = {}) {
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  const loadLedger = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const searchParams = new URLSearchParams()
      if (params.type) searchParams.set('type', params.type)
      if (params.year) searchParams.set('year', String(params.year))
      if (params.platform) searchParams.set('platform', params.platform)
      if (params.search) searchParams.set('search', params.search)
      if (params.limit) searchParams.set('limit', String(params.limit))
      if (params.offset) searchParams.set('offset', String(params.offset))

      const url = `/api/v4/ledger${searchParams.toString() ? `?${searchParams}` : ''}`
      const response = await fetch(url)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch ledger')
      }

      const data: LedgerResponse = await response.json()
      setRows(data.rows)
      setTotal(data.total)
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to load ledger'
      console.error('[useLedger] Fetch error:', errorMessage)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [params.type, params.year, params.platform, params.search, params.limit, params.offset])

  useEffect(() => {
    loadLedger()
  }, [loadLedger])

  return {
    rows,
    loading,
    error,
    total,
    refetch: loadLedger,
  }
}

// Format date to YYYY-MM-DD (date only, no time/timezone)
function formatDateForCSV(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  return dateStr.split('T')[0]
}

// Export ledger to CSV - includes Type column
export function exportLedgerToCSV(rows: LedgerRow[], filename = 'ledger-export.csv') {
  const headers = [
    'Type',
    'Date',
    'SKU',
    'Brand',
    'Model',
    'Colorway',
    'Size (UK)',
    'Condition',
    'Amount',
    'Profit',
    'Platform',
    'Purchase Price',
    'Sold Price',
    'Fees',
  ]

  const csvRows = rows.map(row => {
    return [
      row.type,
      formatDateForCSV(row.date),
      row.sku || '',
      row.brand || '',
      row.model || '',
      row.colorway || '',
      row.size_uk || '',
      row.condition || '',
      row.amount.toFixed(2),
      row.profit !== null ? row.profit.toFixed(2) : '',
      row.platform || '',
      row.purchase_price !== null ? row.purchase_price.toFixed(2) : '',
      row.sold_price !== null ? row.sold_price.toFixed(2) : '',
      row.sales_fee !== null ? row.sales_fee.toFixed(2) : '',
    ]
  })

  const csvContent = [
    headers.join(','),
    ...csvRows.map(row => row.map(cell => `"${cell}"`).join(',')),
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
