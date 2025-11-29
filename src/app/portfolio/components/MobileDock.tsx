'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { SidebarContent } from './Sidebar'

interface MobileDockProps {
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
}

export function MobileDock({ drawerOpen, setDrawerOpen }: MobileDockProps) {
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  // Close drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerOpen) {
        setDrawerOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [drawerOpen, setDrawerOpen])

  return (
    <>
      {/* Drawer Overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 left-0 h-full w-[320px] border-r-2 z-[70] md:hidden',
          'transition-transform duration-300 ease-terminal',
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          background: 'linear-gradient(135deg, #0E1A15 0%, #0B1510 50%, rgba(0, 255, 148, 0.03) 100%)',
          borderColor: 'rgba(0, 255, 148, 0.15)',
          boxShadow: 'inset 2px 0 0 0 rgba(0, 255, 148, 0.25), 4px 0 24px -8px rgba(0,0,0,0.4), 0 0 60px -15px rgba(0, 255, 148, 0.1)',
        }}
      >
        {/* Close button - top right */}
        <button
          onClick={() => setDrawerOpen(false)}
          className="absolute top-4 right-4 z-10 h-8 w-8 rounded-lg bg-elev-2/80 hover:bg-elev-2 flex items-center justify-center text-fg transition-colors border border-border/40"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Reuse the same sidebar content */}
        <SidebarContent
          isExpanded={true}
          onClose={() => setDrawerOpen(false)}
          isMobile={true}
        />
      </div>
    </>
  )
}
