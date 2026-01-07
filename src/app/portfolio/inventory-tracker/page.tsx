'use client'

/**
 * Inventory Tracker - DEPRECATED
 * This page has been replaced by /portfolio/inventory (V4-native).
 * Redirects to the main inventory page.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function InventoryTrackerPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/portfolio/inventory')
  }, [router])

  return (
    <div className="container mx-auto py-8">
      <div className="text-center text-muted">
        Redirecting to inventory...
      </div>
    </div>
  )
}
