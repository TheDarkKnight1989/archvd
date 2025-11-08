'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'

export type InventoryItem = {
  id: string
  user_id: string
  sku: string
  style_id?: string | null
  brand?: string | null
  model?: string | null
  colorway?: string | null
  size?: string | null
  size_uk?: string | null
  size_alt?: string | null
  category?: string | null
  condition?: string | null
  purchase_price: number
  tax?: number | null
  shipping?: number | null
  purchase_total?: number | null // Generated column in DB
  place_of_purchase?: string | null
  purchase_date?: string | null
  order_number?: string | null
  sold_price?: number | null
  sold_date?: string | null
  platform?: string | null
  sales_fee?: number | null
  market_value?: number | null
  market_updated_at?: string | null
  market_meta?: {
    sources_used?: string[]
    confidence?: string
  } | null
  status?: string | null
  location?: string | null
  tags?: string[] | null
  watchlist_id?: string | null
  custom_market_value?: number | null
  notes?: string | null
  created_at: string
  updated_at?: string | null
}

export function useInventory() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('Inventory')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setItems(data || [])
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch items')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  return {
    items,
    loading,
    error,
    refetch: fetchItems,
  }
}
