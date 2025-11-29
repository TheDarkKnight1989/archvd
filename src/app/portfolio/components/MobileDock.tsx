'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid,
  Boxes,
  BarChart3,
  User,
  Plus,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { SidebarContent } from './Sidebar'

const dockItems = [
  { icon: LayoutGrid, href: '/portfolio', label: 'Overview' },
  { icon: Boxes, href: '/portfolio/inventory', label: 'Portfolio' },
  { icon: BarChart3, href: '/portfolio/expenses', label: 'Analytics' },
  { icon: User, href: '/settings', label: 'Settings' },
]

interface MobileDockProps {
  onQuickAdd?: () => void
}

export function MobileDock({ onQuickAdd }: MobileDockProps) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

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
  }, [drawerOpen])

  return (
    <>
      {/* Burger Menu Button */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="fixed top-4 left-4 z-50 h-10 w-10 rounded-lg bg-elev-1 border border-border flex items-center justify-center text-fg hover:bg-elev-2 transition-colors duration-120 md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Bottom Navigation */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 bg-bg/90 backdrop-blur border-t border-border md:hidden"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="relative">
          <ul className="grid grid-cols-4 px-2">
            {dockItems.map(({ icon: Icon, href, label }) => {
              const isActive = pathname === href
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      'flex flex-col items-center justify-center h-14 text-muted hover:text-fg transition-colors duration-fast',
                      isActive && 'text-fg'
                    )}
                  >
                    <Icon className="h-5 w-5 mb-1" />
                    <span className="text-[10px] font-medium">{label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </nav>

      {/* Quick Add FAB */}
      {onQuickAdd && (
        <button
          onClick={onQuickAdd}
          className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full bg-accent text-black shadow-glow flex items-center justify-center hover:bg-accent-600 transition-colors duration-fast md:hidden active:scale-95"
          style={{ bottom: 'max(5rem, calc(env(safe-area-inset-bottom) + 5rem))' }}
          aria-label="Quick Add"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

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
