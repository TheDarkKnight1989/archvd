'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface SidebarContextType {
  pinned: boolean
  setPinned: (pinned: boolean) => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

const STORAGE_KEY_PINNED = 'archvd_sidebar_pinned_v1'

export function SidebarStateProvider({ children }: { children: ReactNode }) {
  const [pinned, setPinnedState] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Hydration-safe initialization
  useEffect(() => {
    setMounted(true)

    // Load pinned state
    const savedPinned = localStorage.getItem(STORAGE_KEY_PINNED)
    if (savedPinned !== null) {
      const isPinned = savedPinned === 'true'
      setPinnedState(isPinned)

      // Update body attribute
      if (isPinned) {
        document.body.setAttribute('data-sidebar', 'pinned')
      }
    }
  }, [])

  const setPinned = (newPinned: boolean) => {
    setPinnedState(newPinned)
    localStorage.setItem(STORAGE_KEY_PINNED, String(newPinned))

    // Update body attribute
    if (newPinned) {
      document.body.setAttribute('data-sidebar', 'pinned')
    } else {
      document.body.removeAttribute('data-sidebar')
    }
  }

  // Don't render children until mounted to avoid hydration mismatch
  if (!mounted) {
    return null
  }

  return (
    <SidebarContext.Provider value={{ pinned, setPinned }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within SidebarStateProvider')
  }
  return context
}
