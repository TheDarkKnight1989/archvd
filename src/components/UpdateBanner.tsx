/**
 * Update Banner
 * Shows a dismissible notification when app version changes
 * Uses localStorage to track last seen version
 */

'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const APP_VERSION = '1.1.0' // Update this when you deploy
const VERSION_KEY = 'archvd_last_seen_version'

export function UpdateBanner() {
  const [show, setShow] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)

    // Check if user has seen this version
    const lastSeenVersion = localStorage.getItem(VERSION_KEY)

    if (lastSeenVersion !== APP_VERSION) {
      setShow(true)
    }
  }, [])

  const handleDismiss = () => {
    localStorage.setItem(VERSION_KEY, APP_VERSION)
    setShow(false)
  }

  if (!isClient || !show) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-accent/90 to-[#00E085]/90 backdrop-blur-sm border-b border-accent/20 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap">
          <div className="flex items-center flex-1">
            <span className="flex p-2 rounded-lg bg-white/10">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </span>
            <p className="ml-3 font-medium text-white">
              <span className="inline">
                🎉 New update available! StockX search now works for all users + Alias connection added.
              </span>
              <a
                href="/portfolio/settings/integrations"
                className="ml-2 underline text-white/90 hover:text-white"
              >
                Check it out →
              </a>
            </p>
          </div>
          <div className="flex-shrink-0 sm:ml-3">
            <button
              type="button"
              onClick={handleDismiss}
              className="-mr-1 flex p-2 rounded-md hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white transition-colors"
            >
              <span className="sr-only">Dismiss</span>
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
