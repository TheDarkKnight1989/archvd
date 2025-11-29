/**
 * Hook for managing user settings
 */

'use client'

import { useState, useEffect, useCallback } from 'react'

export interface UserSettings {
  id: string
  user_id: string
  stockx_seller_level: number
  stockx_shipping_fee: number
  currency_preference: string
  timezone: string
  created_at: string
  updated_at: string
}

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/user/settings')

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch settings')
      }

      const data = await response.json()
      setSettings(data)
    } catch (err: any) {
      console.error('[useUserSettings] Error fetching settings:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const updateSettings = useCallback(async (updates: Partial<UserSettings>) => {
    try {
      setError(null)

      const response = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update settings')
      }

      const data = await response.json()
      setSettings(data)
      return data
    } catch (err: any) {
      console.error('[useUserSettings] Error updating settings:', err)
      setError(err.message)
      throw err
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  return {
    settings,
    loading,
    error,
    updateSettings,
    refetch: fetchSettings,
  }
}
