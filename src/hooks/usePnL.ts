// Hooks for P&L and VAT data fetching

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'

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
  date: string
  sku: string
  brand: string
  model: string
  size: string
  buyPrice: number
  salePrice: number
  margin: number
  vatDue: number
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
 * Hook for fetching P&L KPIs for a specific month
 */
export function usePnLKPIs(userId: string | undefined, month: string) {
  const [data, setData] = useState<PnLKPIs>({
    revenue: 0,
    cogs: 0,
    grossProfit: 0,
    expenses: 0,
    netProfit: 0,
    numSales: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId || !month) {
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
          .eq('month', month)
          .single()

        if (fetchError && fetchError.code !== 'PGRST116') {
          // PGRST116 = no rows, which is fine
          throw fetchError
        }

        if (pnlData) {
          setData({
            revenue: pnlData.revenue || 0,
            cogs: pnlData.cogs || 0,
            grossProfit: pnlData.gross_profit || 0,
            expenses: pnlData.expenses || 0,
            netProfit: pnlData.net_profit || 0,
            numSales: pnlData.num_sales || 0,
          })
        } else {
          // No data for this month
          setData({
            revenue: 0,
            cogs: 0,
            grossProfit: 0,
            expenses: 0,
            netProfit: 0,
            numSales: 0,
          })
        }
        setError(null)
      } catch (err: any) {
        console.error('Failed to fetch P&L KPIs:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchKPIs()
  }, [userId, month])

  return { data, loading, error }
}

/**
 * Hook for fetching sold items with VAT details for a specific month
 */
export function usePnLItems(userId: string | undefined, month: string) {
  const [data, setData] = useState<PnLItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId || !month) {
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
          .eq('month', month)
          .order('sold_date', { ascending: false })

        if (fetchError) throw fetchError

        const pnlItems: PnLItem[] = (items || []).map((item: any) => ({
          id: item.item_id,
          date: item.sold_date,
          sku: item.sku || '',
          brand: item.brand || '',
          model: item.model || '',
          size: item.size || '',
          buyPrice: item.purchase_price || 0,
          salePrice: item.sold_price || 0,
          margin: item.margin || 0,
          vatDue: item.vat_due || 0,
          platform: item.platform,
        }))

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
  }, [userId, month])

  return { data, loading, error }
}

/**
 * Hook for fetching expenses for a specific month
 */
export function usePnLExpenses(userId: string | undefined, month: string) {
  const [data, setData] = useState<ExpenseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId || !month) {
      setLoading(false)
      return
    }

    const fetchExpenses = async () => {
      setLoading(true)
      try {
        // Calculate month start and end dates
        const monthStart = new Date(month + '-01')
        const monthEnd = new Date(monthStart)
        monthEnd.setMonth(monthEnd.getMonth() + 1)

        const { data: expenses, error: fetchError } = await supabase
          .from('expenses')
          .select('*')
          .eq('user_id', userId)
          .gte('date', monthStart.toISOString().split('T')[0])
          .lt('date', monthEnd.toISOString().split('T')[0])
          .order('date', { ascending: false })

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
 * Hook for fetching VAT summary for a specific month
 */
export function useVATSummary(userId: string | undefined, month: string) {
  const [data, setData] = useState({
    totalSales: 0,
    totalMargin: 0,
    taxableMargin: 0,
    vatDue: 0,
    numSales: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId || !month) {
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
          .eq('month', month)
          .single()

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError
        }

        if (vatData) {
          setData({
            totalSales: vatData.total_sales || 0,
            totalMargin: vatData.total_margin || 0,
            taxableMargin: vatData.taxable_margin || 0,
            vatDue: vatData.vat_due || 0,
            numSales: vatData.num_sales || 0,
          })
        } else {
          setData({
            totalSales: 0,
            totalMargin: 0,
            taxableMargin: 0,
            vatDue: 0,
            numSales: 0,
          })
        }
        setError(null)
      } catch (err: any) {
        console.error('Failed to fetch VAT summary:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()
  }, [userId, month])

  return { data, loading, error }
}
