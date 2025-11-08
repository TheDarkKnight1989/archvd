'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SortingState } from '@tanstack/react-table'

const STORAGE_KEY = 'archvd_inventory_views_v1'

export interface SavedView {
  id: string
  name: string
  filters: {
    status?: string
    category?: string
    size?: string
    search?: string
  }
  sorting: SortingState
  createdAt: string
}

export interface SavedViewsState {
  views: SavedView[]
  activeViewId: string | null
}

export function useSavedViews() {
  const [state, setState] = useState<SavedViewsState>({
    views: [],
    activeViewId: null,
  })

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setState(parsed)
      }
    } catch (error) {
      console.error('Failed to load saved views:', error)
    }
  }, [])

  // Save to localStorage whenever state changes
  const persist = useCallback((newState: SavedViewsState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
      setState(newState)
    } catch (error) {
      console.error('Failed to save views:', error)
    }
  }, [])

  // Create a new saved view
  const createView = useCallback(
    (
      name: string,
      filters: SavedView['filters'],
      sorting: SortingState
    ) => {
      const newView: SavedView = {
        id: `view_${Date.now()}`,
        name,
        filters,
        sorting,
        createdAt: new Date().toISOString(),
      }

      const newState: SavedViewsState = {
        views: [...state.views, newView],
        activeViewId: newView.id,
      }

      persist(newState)
      return newView
    },
    [state.views, persist]
  )

  // Update an existing view
  const updateView = useCallback(
    (
      viewId: string,
      updates: Partial<Omit<SavedView, 'id' | 'createdAt'>>
    ) => {
      const newState: SavedViewsState = {
        ...state,
        views: state.views.map((view) =>
          view.id === viewId ? { ...view, ...updates } : view
        ),
      }

      persist(newState)
    },
    [state, persist]
  )

  // Delete a view
  const deleteView = useCallback(
    (viewId: string) => {
      const newState: SavedViewsState = {
        views: state.views.filter((view) => view.id !== viewId),
        activeViewId: state.activeViewId === viewId ? null : state.activeViewId,
      }

      persist(newState)
    },
    [state, persist]
  )

  // Set active view
  const setActiveView = useCallback(
    (viewId: string | null) => {
      const newState: SavedViewsState = {
        ...state,
        activeViewId: viewId,
      }

      persist(newState)
    },
    [state, persist]
  )

  // Get active view
  const activeView = state.views.find((v) => v.id === state.activeViewId)

  return {
    views: state.views,
    activeView,
    activeViewId: state.activeViewId,
    createView,
    updateView,
    deleteView,
    setActiveView,
  }
}
