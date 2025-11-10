// Hooks for P&L and VAT data fetching

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { PnLItemRow, PnLMonthRow, VATMonthRow } from '@/lib/types/pnl'

export type PnLKPIs = {
  revenue: number
  cogs: number
  grossProfit: number
  expenses: number
  netProfit: number
  numSales: number
}

export type PnLItem = {
  id: string
  date: string // sold_date from view
  sku: string
  brand: string
  model: string
  size: string
  buyPrice: number // buy_price from view
  salePrice: number // sale_price from view
  margin: number // margin_gbp from view
  vatDue: number // vat_due_gbp from view
  platform: string | null
}

export type ExpenseItem = {
  id: string
  date: string
  description: string
  amount: number
  category: string
}

/**
 * Hook for fetching P&L KPIs (all months, no date filter)
 */
export function usePnLKPIs(userId: string | undefined) {
  const [data, setData] = useState<PnLMonthRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const fetchKPIs = async () => {
      setLoading(true)
      try {
        const { data: pnlData, error: fetchError } = await supabase
          .from('profit_loss_monthly_view')
          .select('*')
          .eq('user_id', userId)
          .order('month', { ascending: false })

        if (fetchError) {
          throw fetchError
        }

        console.log('[usePnLKPIs] Raw data from view:', pnlData)
        setData(pnlData || [])
        setError(null)
      } catch (err: any) {
        console.error('Failed to fetch P&L KPIs:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchKPIs()
  }, [userId])

  return { data, loading, error }
}

/**
 * Hook for fetching sold items with VAT details (all items, no date filter)
 */
export function usePnLItems(userId: string | undefined) {
  const [data, setData] = useState<PnLItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const fetchItems = async () => {
      setLoading(true)
      try {
        const { data: items, error: fetchError } = await supabase
          .from('vat_margin_detail_view')
          .select('*')
          .eq('user_id', userId)
          .order('sold_date', { ascending: false })

        if (fetchError) throw fetchError

        console.log('[usePnLItems] Raw data from view:', {
          count: items?.length,
          firstRow: items?.[0],
          columns: items?.[0] ? Object.keys(items[0]) : []
        })

        // Map from view columns to PnLItem interface
        const pnlItems: PnLItem[] = (items || []).map((item: PnLItemRow) => ({
          id: item.item_id,
          date: item.sold_date, // Use sold_date from view
          sku: item.sku || '',
          brand: item.brand || '',
          model: item.model || '',
          size: item.size || '',
          buyPrice: item.buy_price, // Use buy_price from view
          salePrice: item.sale_price, // Use sale_price from view
          margin: item.margin_gbp, // Use margin_gbp from view
          vatDue: item.vat_due_gbp, // Use vat_due_gbp from view
          platform: item.platform,
        }))

        console.log('[usePnLItems] Mapped items (first row):', pnlItems?.[0])
        setData(pnlItems)
        setError(null)
      } catch (err: any) {
        console.error('Failed to fetch P&L items:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchItems()
  }, [userId])

  return { data, loading, error }
}

/**
 * Hook for fetching expenses
 * @param month - Optional month in YYYY-MM format. If null/undefined, fetches all expenses.
 */
export function usePnLExpenses(userId: string | undefined, month: string | null | undefined) {
  const [data, setData] = useState<ExpenseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const fetchExpenses = async () => {
      setLoading(true)
      try {
        let query = supabase
          .from('expenses')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })

        // Apply month filter only if month is provided
        if (month) {
          const monthStart = new Date(month + '-01')
          const monthEnd = new Date(monthStart)
          monthEnd.setMonth(monthEnd.getMonth() + 1)

          query = query
            .gte('date', monthStart.toISOString().split('T')[0])
            .lt('date', monthEnd.toISOString().split('T')[0])
        }

        const { data: expenses, error: fetchError } = await query

        if (fetchError) throw fetchError

        const expenseItems: ExpenseItem[] = (expenses || []).map((expense: any) => ({
          id: expense.id,
          date: expense.date,
          description: expense.description || '',
          amount: expense.amount || 0,
          category: expense.category || 'Other',
        }))

        setData(expenseItems)
        setError(null)
      } catch (err: any) {
        console.error('Failed to fetch expenses:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchExpenses()
  }, [userId, month])

  return { data, loading, error }
}

/**
 * Hook for fetching VAT summary (all months, no date filter)
 */
export function useVATSummary(userId: string | undefined) {
  const [data, setData] = useState<VATMonthRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const fetchSummary = async () => {
      setLoading(true)
      try {
        const { data: vatData, error: fetchError } = await supabase
          .from('vat_margin_monthly_view')
          .select('*')
          .eq('user_id', userId)
          .order('month', { ascending: false })

        if (fetchError) {
          throw fetchError
        }

        console.log('[useVATSummary] Raw data from view (first row):', vatData?.[0])
        setData(vatData || [])
        setError(null)
      } catch (err: any) {
        console.error('Failed to fetch VAT summary:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()
  }, [userId])

  return { data, loading, error }
}
