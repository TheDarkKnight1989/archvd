'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Redirect from old Market page to new global search flow
export default function MarketRedirect() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to portfolio and trigger command search via URL param
    router.replace('/portfolio?openSearch=true')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-elev-1">
      <div className="text-center">
        <div className="h-8 w-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted text-sm">Redirecting to search...</p>
      </div>
    </div>
  )
}
