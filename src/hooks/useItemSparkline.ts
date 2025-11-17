import { useState, useEffect } from 'react'
import { useCurrency } from './useCurrency'

interface SparklinePoint {
  date: string
  value: number
}

/**
 * Fetch sparkline data for a specific item
 */
export function useItemSparkline(sku: string, size: string, days: number = 30) {
  const { currency } = useCurrency()
  const [points, setPoints] = useState<SparklinePoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSparkline() {
      if (!sku || !size) {
        setPoints([])
        setLoading(false)
        return
      }

      try {
        const params = new URLSearchParams({
          sku,
          size,
          currency,
          days: days.toString(),
        })

        const response = await fetch(`/api/portfolio/movers/sparkline?${params}`)

        if (!response.ok) {
          console.error(`[useItemSparkline] Failed to fetch sparkline for ${sku}:${size}`)
          setPoints([])
          setLoading(false)
          return
        }

        const data = await response.json()
        setPoints(data.points || [])
      } catch (error) {
        console.error(`[useItemSparkline] Error:`, error)
        setPoints([])
      } finally {
        setLoading(false)
      }
    }

    setLoading(true)
    fetchSparkline()
  }, [sku, size, currency, days])

  return { points, loading }
}
