/**
 * useTablePreferences Hook
 * Manages table column visibility, order, and width preferences
 * Persists to localStorage for user customization
 */

import { useState, useEffect, useCallback } from 'react'

export interface ColumnPreference {
  id: string
  visible: boolean
  order: number
  width?: number
}

interface TablePreferences {
  columns: Record<string, ColumnPreference>
}

const STORAGE_KEY_PREFIX = 'table-prefs-'

export function useTablePreferences(tableId: string, defaultColumns: string[]) {
  const storageKey = `${STORAGE_KEY_PREFIX}${tableId}`

  // Initialize with default preferences
  const getDefaultPreferences = useCallback((): TablePreferences => {
    return {
      columns: defaultColumns.reduce((acc, colId, index) => {
        acc[colId] = {
          id: colId,
          visible: true,
          order: index,
        }
        return acc
      }, {} as Record<string, ColumnPreference>),
    }
  }, [defaultColumns])

  // Load preferences from localStorage
  const loadPreferences = useCallback((): TablePreferences => {
    if (typeof window === 'undefined') return getDefaultPreferences()

    try {
      const stored = localStorage.getItem(storageKey)
      if (!stored) return getDefaultPreferences()

      const parsed = JSON.parse(stored) as TablePreferences

      // Merge with defaults to handle new columns
      const defaults = getDefaultPreferences()
      const merged = { ...defaults }

      // Update with stored preferences
      Object.keys(parsed.columns).forEach((colId) => {
        if (merged.columns[colId]) {
          merged.columns[colId] = { ...merged.columns[colId], ...parsed.columns[colId] }
        }
      })

      return merged
    } catch (error) {
      console.error('[Table Preferences] Failed to load:', error)
      return getDefaultPreferences()
    }
  }, [storageKey, getDefaultPreferences])

  const [preferences, setPreferences] = useState<TablePreferences>(loadPreferences)

  // Save preferences to localStorage
  const savePreferences = useCallback((prefs: TablePreferences) => {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem(storageKey, JSON.stringify(prefs))
      setPreferences(prefs)
    } catch (error) {
      console.error('[Table Preferences] Failed to save:', error)
    }
  }, [storageKey])

  // Toggle column visibility
  const toggleColumnVisibility = useCallback((columnId: string) => {
    setPreferences((prev) => {
      const updated = {
        ...prev,
        columns: {
          ...prev.columns,
          [columnId]: {
            ...prev.columns[columnId],
            visible: !prev.columns[columnId]?.visible,
          },
        },
      }
      savePreferences(updated)
      return updated
    })
  }, [savePreferences])

  // Set column visibility
  const setColumnVisibility = useCallback((columnId: string, visible: boolean) => {
    setPreferences((prev) => {
      const updated = {
        ...prev,
        columns: {
          ...prev.columns,
          [columnId]: {
            ...prev.columns[columnId],
            visible,
          },
        },
      }
      savePreferences(updated)
      return updated
    })
  }, [savePreferences])

  // Reorder columns
  const reorderColumns = useCallback((columnIds: string[]) => {
    setPreferences((prev) => {
      const updated = {
        ...prev,
        columns: {
          ...prev.columns,
        },
      }

      // Update order
      columnIds.forEach((colId, index) => {
        if (updated.columns[colId]) {
          updated.columns[colId].order = index
        }
      })

      savePreferences(updated)
      return updated
    })
  }, [savePreferences])

  // Set column width
  const setColumnWidth = useCallback((columnId: string, width: number) => {
    setPreferences((prev) => {
      const updated = {
        ...prev,
        columns: {
          ...prev.columns,
          [columnId]: {
            ...prev.columns[columnId],
            width,
          },
        },
      }
      savePreferences(updated)
      return updated
    })
  }, [savePreferences])

  // Reset to defaults
  const resetPreferences = useCallback(() => {
    const defaults = getDefaultPreferences()
    savePreferences(defaults)
  }, [getDefaultPreferences, savePreferences])

  // Get ordered and filtered columns
  const getVisibleColumns = useCallback(() => {
    return Object.values(preferences.columns)
      .filter((col) => col.visible)
      .sort((a, b) => a.order - b.order)
      .map((col) => col.id)
  }, [preferences])

  // Get all columns in order
  const getOrderedColumns = useCallback(() => {
    return Object.values(preferences.columns)
      .sort((a, b) => a.order - b.order)
      .map((col) => col.id)
  }, [preferences])

  return {
    preferences,
    toggleColumnVisibility,
    setColumnVisibility,
    reorderColumns,
    setColumnWidth,
    resetPreferences,
    getVisibleColumns,
    getOrderedColumns,
  }
}
