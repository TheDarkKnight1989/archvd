/**
 * V4 Unified Search Hook
 *
 * React hook for searching products across local DB, StockX, and Alias.
 *
 * Features:
 * - Debounced search (300ms default)
 * - Loading state
 * - Error handling
 * - Clear function
 * - Configurable options
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
// Import types from types module directly (not barrel) to avoid server-only danger
import type { SearchResultV4, SearchResponseV4, UseUnifiedSearchV4Return } from '@/lib/inventory-v4/types'

interface UseUnifiedSearchV4Options {
  debounceMs?: number
  limit?: number
  includeExternal?: boolean
  minQueryLength?: number
}

export function useUnifiedSearchV4(
  options: UseUnifiedSearchV4Options = {}
): UseUnifiedSearchV4Return {
  const {
    debounceMs = 300,
    limit = 10,
    includeExternal = true,
    minQueryLength = 2,
  } = options

  const [results, setResults] = useState<SearchResultV4[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Debounce timer ref (ReturnType for browser/node compatibility)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Abort controller for cancelling in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null)
  // Request ID for tracking latest request (prevents stale state from aborted requests)
  const requestIdRef = useRef(0)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  /**
   * Execute search with debouncing
   */
  const search = useCallback(
    async (query: string): Promise<SearchResponseV4> => {
      // Clear previous debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      const trimmedQuery = query.trim()

      // Handle empty or short queries
      if (trimmedQuery.length < minQueryLength) {
        setResults([])
        setIsSearching(false)
        setError(null)
        return {
          results: [],
          query: trimmedQuery,
          inputType: 'search_query',
          timing: { total: 0 },
        }
      }

      // Set loading state immediately
      setIsSearching(true)
      setError(null)

      // Increment request ID - only the latest request should update state
      const myRequestId = ++requestIdRef.current

      return new Promise((resolve, reject) => {
        debounceTimerRef.current = setTimeout(async () => {
          // Clear ref after timer fires
          debounceTimerRef.current = null

          try {
            // Create new abort controller for this request
            const abortController = new AbortController()
            abortControllerRef.current = abortController

            const response = await fetch('/api/v4/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: trimmedQuery,
                limit,
                includeExternal,
              }),
              signal: abortController.signal,
              cache: 'no-store',
            })

            if (!response.ok) {
              // Safely parse error - handle non-JSON responses (proxies, 500s)
              let errorMessage = `Search failed: ${response.status}`
              try {
                const errorData = await response.json()
                if (errorData?.error) errorMessage = errorData.error
              } catch {
                // Response wasn't JSON, use status-based message
              }
              throw new Error(errorMessage)
            }

            const data: SearchResponseV4 = await response.json()

            // Only update state if this is still the latest request
            if (requestIdRef.current === myRequestId) {
              setResults(data.results)
              setIsSearching(false)
              setError(null)
              resolve(data)
            } else {
              // Stale request - resolve without updating state
              resolve(data)
            }
          } catch (err) {
            // Handle abort errors - don't touch state, newer request owns it
            // Resolve with empty (not reject) to avoid unhandled rejection noise
            if (err instanceof Error && err.name === 'AbortError') {
              resolve({
                results: [],
                query: trimmedQuery,
                inputType: 'search_query',
                timing: { total: 0 },
              })
              return
            }

            // Only update error state if this is still the latest request
            if (requestIdRef.current === myRequestId) {
              const error = err instanceof Error ? err : new Error('Search failed')
              setError(error)
              setIsSearching(false)
              setResults([])
              reject(error)
            } else {
              // Stale request error - resolve (not reject) to avoid unhandled rejection noise
              resolve({
                results: [],
                query: trimmedQuery,
                inputType: 'search_query',
                timing: { total: 0 },
              })
            }
          }
        }, debounceMs)
      })
    },
    [debounceMs, limit, includeExternal, minQueryLength]
  )

  /**
   * Clear search results and state
   */
  const clear = useCallback(() => {
    // Cancel pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Cancel in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Invalidate any in-flight request so it can't update state later
    requestIdRef.current += 1

    setResults([])
    setIsSearching(false)
    setError(null)
  }, [])

  return {
    search,
    results,
    isSearching,
    error,
    clear,
  }
}

/**
 * Simpler version without debouncing (for immediate search on button click)
 */
export function useImmediateSearchV4(
  options: Omit<UseUnifiedSearchV4Options, 'debounceMs'> = {}
): UseUnifiedSearchV4Return {
  return useUnifiedSearchV4({ ...options, debounceMs: 0 })
}

export default useUnifiedSearchV4
