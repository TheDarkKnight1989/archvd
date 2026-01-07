/**
 * V4 Sync Status Hook
 *
 * React hook for checking and polling sync status for styles.
 *
 * Features:
 * - Check sync status for a single style
 * - Poll for sync completion (with overlap prevention)
 * - Retry failed syncs
 * - Batch status checks for multiple styles
 */

'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { SyncStatusV4, SyncProvider } from '@/lib/inventory-v4/types'

// =============================================================================
// TYPES
// =============================================================================

interface UseSyncStatusV4Options {
  /** Auto-start polling when status is 'syncing' (default: true) */
  autoPoll?: boolean
  /** Polling interval in ms (default: 3000) */
  pollIntervalMs?: number
  /** Max polling attempts before stopping (default: 20 = 1 minute at 3s interval) */
  maxPollAttempts?: number
}

interface UseSyncStatusV4Return {
  /** Current sync status */
  status: SyncStatusV4 | null
  /** Whether we're fetching status (manual fetch only, not polling) */
  isLoading: boolean
  /** Whether we're currently polling */
  isPolling: boolean
  /** Error from last fetch/retry */
  error: Error | null
  /** Non-fatal warnings (e.g., one provider failed but other succeeded) */
  warnings: string[]
  /** Manually fetch status */
  fetchStatus: () => Promise<SyncStatusV4 | null>
  /** Start polling (if not already) */
  startPolling: () => void
  /** Stop polling */
  stopPolling: () => void
  /** Retry failed sync jobs */
  retrySyncs: (provider?: SyncProvider) => Promise<void>
}

interface RetrySyncResponse {
  styleId: string
  jobsCreated: Array<{ id: string; provider: SyncProvider }>
  errors: string[]
}

// =============================================================================
// HELPERS
// =============================================================================

/** Normalize styleId for consistent behavior */
function normalizeStyleId(styleId: string): string {
  return styleId.trim().toUpperCase()
}

// =============================================================================
// HOOK
// =============================================================================

export function useSyncStatusV4(
  styleId: string | null,
  options: UseSyncStatusV4Options = {}
): UseSyncStatusV4Return {
  const {
    autoPoll = true,
    pollIntervalMs = 3000,
    maxPollAttempts = 20,
  } = options

  const [status, setStatus] = useState<SyncStatusV4 | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  // Refs for polling state
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollAttemptsRef = useRef(0)
  const mountedRef = useRef(true)
  const inFlightRef = useRef(false) // Prevent overlapping polls

  // Normalize styleId once
  const normalizedStyleId = styleId ? normalizeStyleId(styleId) : null

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [])

  // Fetch status from API
  // silent: true prevents isLoading from being set (used during polling)
  const fetchStatus = useCallback(async (opts?: { silent?: boolean }): Promise<SyncStatusV4 | null> => {
    if (!normalizedStyleId) {
      setStatus(null)
      return null
    }

    if (!opts?.silent) {
      setIsLoading(true)
    }
    setError(null)

    try {
      const response = await fetch(
        `/api/v4/sync/retry?styleId=${encodeURIComponent(normalizedStyleId)}`,
        { method: 'GET', cache: 'no-store' }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json() as SyncStatusV4

      if (mountedRef.current) {
        setStatus(data)
      }

      return data
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      if (mountedRef.current) {
        setError(error)
      }
      return null
    } finally {
      if (mountedRef.current && !opts?.silent) {
        setIsLoading(false)
      }
    }
  }, [normalizedStyleId])

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    pollAttemptsRef.current = 0
    inFlightRef.current = false
    if (mountedRef.current) {
      setIsPolling(false)
    }
  }, [])

  // Start polling
  const startPolling = useCallback(() => {
    // Don't start if already polling
    if (pollIntervalRef.current) return
    // Don't start if no styleId
    if (!normalizedStyleId) return

    setIsPolling(true)
    pollAttemptsRef.current = 0

    pollIntervalRef.current = setInterval(async () => {
      // Prevent overlapping requests (if previous request is still in-flight)
      if (inFlightRef.current) return
      inFlightRef.current = true

      try {
        pollAttemptsRef.current++

        // Stop if max attempts reached
        if (pollAttemptsRef.current >= maxPollAttempts) {
          stopPolling()
          return
        }

        // Use silent: true to prevent loading spinner spam
        const newStatus = await fetchStatus({ silent: true })

        // Stop polling if sync is complete
        if (newStatus && newStatus.overall !== 'syncing') {
          stopPolling()
        }
      } finally {
        inFlightRef.current = false
      }
    }, pollIntervalMs)
  }, [normalizedStyleId, fetchStatus, stopPolling, maxPollAttempts, pollIntervalMs])

  // Retry failed syncs
  const retrySyncs = useCallback(async (provider?: SyncProvider): Promise<void> => {
    if (!normalizedStyleId) return

    setIsLoading(true)
    setError(null)
    setWarnings([])

    try {
      const response = await fetch('/api/v4/sync/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ styleId: normalizedStyleId, provider }),
        cache: 'no-store',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json() as RetrySyncResponse

      // If any jobs were created, start polling
      if (data.jobsCreated.length > 0 && autoPoll) {
        // Immediately fetch new status
        const newStatus = await fetchStatus()
        if (newStatus?.overall === 'syncing') {
          startPolling()
        }
      }

      // Handle errors: only throw if NO jobs were created AND there are errors
      // If some jobs were created, treat errors as non-fatal warnings
      if (data.errors.length > 0) {
        if (data.jobsCreated.length === 0) {
          // Complete failure - throw
          throw new Error(data.errors.join('; '))
        } else {
          // Partial success - store as warnings
          if (mountedRef.current) {
            setWarnings(data.errors)
          }
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      if (mountedRef.current) {
        setError(error)
      }
      throw error
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [normalizedStyleId, autoPoll, fetchStatus, startPolling])

  // Initial fetch when styleId changes
  useEffect(() => {
    if (!normalizedStyleId) {
      setStatus(null)
      setWarnings([])
      stopPolling()
      return
    }

    fetchStatus().then((initialStatus) => {
      // Auto-start polling if status is syncing
      if (autoPoll && initialStatus?.overall === 'syncing') {
        startPolling()
      }
    })

    // Cleanup polling on styleId change
    return () => {
      stopPolling()
    }
  }, [normalizedStyleId, autoPoll, fetchStatus, startPolling, stopPolling])

  return {
    status,
    isLoading,
    isPolling,
    error,
    warnings,
    fetchStatus: () => fetchStatus(), // Wrap to hide internal opts
    startPolling,
    stopPolling,
    retrySyncs,
  }
}

// =============================================================================
// BATCH HOOK
// =============================================================================

interface UseBatchSyncStatusV4Return {
  /** Map of styleId -> SyncStatusV4 */
  statusMap: Map<string, SyncStatusV4>
  /** Whether we're fetching */
  isLoading: boolean
  /** Error from last fetch */
  error: Error | null
  /** Manually fetch statuses */
  fetchStatuses: () => Promise<void>
}

/**
 * Hook for batch checking sync status for multiple styles
 *
 * Note: This calls the status endpoint for each style (no batch endpoint yet).
 * For very large lists, consider implementing a batch API endpoint.
 */
export function useBatchSyncStatusV4(
  styleIds: string[]
): UseBatchSyncStatusV4Return {
  const [statusMap, setStatusMap] = useState<Map<string, SyncStatusV4>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const mountedRef = useRef(true)

  // Memoize normalized styleIds to prevent render loops
  // Using join('|') handles array reference changes with same contents
  const normalizedStyleIds = useMemo(() => {
    const normalized = styleIds.map(normalizeStyleId)
    // Dedupe for efficiency
    return Array.from(new Set(normalized))
  }, [styleIds.join('|')])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const fetchStatuses = useCallback(async (): Promise<void> => {
    if (normalizedStyleIds.length === 0) {
      setStatusMap(new Map())
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Fetch all statuses in parallel (with some concurrency limit)
      const BATCH_SIZE = 10
      const results = new Map<string, SyncStatusV4>()

      for (let i = 0; i < normalizedStyleIds.length; i += BATCH_SIZE) {
        const batch = normalizedStyleIds.slice(i, i + BATCH_SIZE)

        const batchResults = await Promise.allSettled(
          batch.map(async (styleId) => {
            const response = await fetch(
              `/api/v4/sync/retry?styleId=${encodeURIComponent(styleId)}`,
              { method: 'GET', cache: 'no-store' }
            )

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`)
            }

            const data = await response.json() as SyncStatusV4
            return { styleId, status: data }
          })
        )

        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.set(result.value.styleId, result.value.status)
          }
        }
      }

      if (mountedRef.current) {
        setStatusMap(results)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      if (mountedRef.current) {
        setError(error)
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [normalizedStyleIds])

  // Fetch on mount and when styleIds change
  useEffect(() => {
    fetchStatuses()
  }, [fetchStatuses])

  return {
    statusMap,
    isLoading,
    error,
    fetchStatuses,
  }
}
