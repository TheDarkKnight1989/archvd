import { useState, useEffect, useCallback } from 'react'
import type { TxHistoryResponse } from '@/lib/transactions/types'

interface UseTransactionsOptions {
  type: 'sales' | 'purchases'
  q?: string
  timeRange?: 'all' | '7d' | '30d' | '90d'
}

interface UseTransactionsResult {
  data: TxHistoryResponse | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useTransactions(options: UseTransactionsOptions): UseTransactionsResult {
  const [data, setData] = useState<TxHistoryResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        ...(options.q && { q: options.q }),
        ...(options.timeRange && options.timeRange !== 'all' && { timeRange: options.timeRange }),
      })

      const endpoint =
        options.type === 'sales'
          ? `/api/transactions/history/sales?${params.toString()}`
          : `/api/transactions/history/purchases?${params.toString()}`

      const response = await fetch(endpoint)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch transactions')
      }

      const result = await response.json()
      setData(result)
    } catch (err: any) {
      console.error('[useTransactions] Error:', err)
      setError(err.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [options.type, options.q, options.timeRange])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  return {
    data,
    loading,
    error,
    refetch: fetchTransactions,
  }
}
