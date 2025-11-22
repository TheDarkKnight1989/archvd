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

  // Enriched fields (added during data fetching/hydration)
  image_url?: string | null
  market_source?: string | null
  market_currency?: 'GBP' | 'EUR' | 'USD' | null
  alias_mapping_status?: 'mapped' | 'unmatched' | 'unmapped' | null
  alias_product_sku?: string | null
  alias_product_id?: string | null
  // PHASE 3.11: StockX mapping status from inventory_market_links.mapping_status
  stockx_mapping_status?: 'ok' | 'stockx_404' | 'invalid' | 'unmapped' | null
  stockx_last_sync_success_at?: string | null
  stockx_last_sync_error?: string | null
  stockx_product_sku?: string | null
  stockx_lowest_ask?: number | null
  stockx_highest_bid?: number | null
  stockx_price_as_of?: string | null
  stockx_listing_id?: string | null
  stockx_listing_status?: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'MATCHED' | 'COMPLETED' | 'DELETED' | 'EXPIRED' | null
  stockx_ask_price?: number | null
  stockx_listing_expires_at?: string | null
  stockx_listing_pending_operation?: { job_id: string; status: string; job_type: string } | null
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
