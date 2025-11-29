/**
 * PWA Update Prompt
 * Detects when a new service worker is available and prompts user to update
 * Shows a persistent banner with "Refresh" button
 */

'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'

export function PWAUpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    // Check for waiting service worker on mount
    navigator.serviceWorker.ready.then((registration) => {
      if (registration.waiting) {
        setWaitingWorker(registration.waiting)
        setShowPrompt(true)
      }
    })

    // Listen for new service worker
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (isRefreshing) return
      setIsRefreshing(true)
      window.location.reload()
    })

    // Listen for updates
    const onUpdateFound = () => {
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.waiting) {
          setWaitingWorker(registration.waiting)
          setShowPrompt(true)
        }

        if (registration.installing) {
          const newWorker = registration.installing
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker installed and ready
              setWaitingWorker(newWorker)
              setShowPrompt(true)
            }
          })
        }
      })
    }

    // Check for updates every 30 seconds when tab is active
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.ready.then((registration) => {
          registration.update().catch((err) => {
            console.error('[PWA] Update check failed:', err)
          })
        })
      }
    }, 30000)

    // Initial update check
    navigator.serviceWorker.ready.then((registration) => {
      registration.update().catch(() => {})
    })

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_UPDATED') {
        onUpdateFound()
      }
    })

    return () => {
      clearInterval(interval)
    }
  }, [isRefreshing])

  const handleRefresh = () => {
    if (!waitingWorker) return

    // Send skip waiting message to service worker
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })

    setIsRefreshing(true)

    // Give SW time to activate, then reload
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
  }

  if (!showPrompt) {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto">
        <div className="bg-gradient-to-r from-accent to-[#00E085] rounded-2xl shadow-2xl border border-accent/20 overflow-hidden animate-slide-up">
          <div className="p-4 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
                  <RefreshCw className="w-6 h-6 text-white" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white mb-1">
                  Update Available! 🎉
                </h3>
                <p className="text-sm text-white/90 mb-4">
                  A new version of Archvd is ready. Refresh to get the latest features and fixes.
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="px-4 py-2 bg-white text-black font-semibold rounded-lg hover:bg-white/90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isRefreshing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Refresh Now
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleDismiss}
                    className="px-3 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    Later
                  </button>
                </div>
              </div>

              <button
                onClick={handleDismiss}
                className="flex-shrink-0 text-white/60 hover:text-white transition-colors p-1 -mr-1 -mt-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
