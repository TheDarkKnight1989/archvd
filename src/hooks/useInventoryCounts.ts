'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

type Counts = {
  status: Record<string, number>
  category: Record<string, number>
  size: Record<string, number>
}

export function useInventoryCounts(userId?: string) {
  const [data, setData] = useState<Counts>({
    status: {},
    category: {},
    size: {},
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userId) return

    setLoading(true)
    ;(async () => {
      try {
        // Fetch all inventory items for the user
        const { data: items, error } = await supabase
          .from('Inventory')
          .select('status, category, size_uk')
          .eq('user_id', userId)

        if (error) throw error

        // Count by status
        const status: Record<string, number> = {}
        const category: Record<string, number> = {}
        const size: Record<string, number> = {}

        items?.forEach((item) => {
          // Status counts
          const statusKey = item.status ?? 'unknown'
          status[statusKey] = (status[statusKey] ?? 0) + 1

          // Category counts
          const categoryKey = item.category ?? 'other'
          category[categoryKey] = (category[categoryKey] ?? 0) + 1

          // Size counts
          const sizeKey = item.size_uk ?? '—'
          size[sizeKey] = (size[sizeKey] ?? 0) + 1
        })

        setData({ status, category, size })
      } catch (error) {
        console.error('Failed to fetch inventory counts:', error)
      } finally {
        setLoading(false)
      }
    })()
  }, [userId])

  return { data, loading }
}
