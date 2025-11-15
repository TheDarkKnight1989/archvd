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
  TrendingUp,
  Settings,
  CandlestickChart,
  Package,
  ReceiptText,
  CalendarRange,
  UploadCloud,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useSidebar } from '@/contexts/SidebarContext'

const dockItems = [
  { icon: LayoutGrid, href: '/portfolio', label: 'Overview' },
  { icon: Boxes, href: '/portfolio/inventory', label: 'Portfolio' },
  { icon: BarChart3, href: '/portfolio/expenses', label: 'Analytics' },
  { icon: User, href: '/profile', label: 'Profile' },
]

// Full nav for drawer (same as sidebar)
const primaryNav = [
  { id: 'portfolio', icon: LayoutGrid, href: '/portfolio', label: 'Overview' },
  { id: 'inventory', icon: Boxes, href: '/portfolio/inventory', label: 'Portfolio' },
  { id: 'sales', icon: TrendingUp, href: '/portfolio/sales', label: 'Sales', badge: 'BETA' },
  { id: 'analytics', icon: BarChart3, href: '/portfolio/analytics', label: 'Analytics', badge: 'ALPHA' },
]

const secondaryNav = [
  { id: 'market', icon: CandlestickChart, href: '/portfolio/market', label: 'Market' },
  { id: 'releases', icon: CalendarRange, href: '/portfolio/releases', label: 'Releases' },
  { id: 'expenses', icon: ReceiptText, href: '/portfolio/expenses', label: 'Expenses' },
  { id: 'packages', icon: Package, href: '/portfolio/packages', label: 'Packages', badge: 'BETA' },
]

const footerNav = [
  { id: 'settings', icon: Settings, href: '/settings', label: 'Settings' },
  { id: 'import', icon: UploadCloud, href: '/portfolio/import', label: 'Import' },
  { id: 'profile', icon: User, href: '/profile', label: 'Profile' },
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 left-0 h-full w-[280px] bg-elev-2 gradient-elev border-r border-border z-50 md:hidden',
          'transition-transform duration-300 ease-terminal',
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/40">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-accent-200 flex items-center justify-center flex-shrink-0">
                <span className="text-fg font-bold text-sm">A</span>
              </div>
              <span className="text-fg font-semibold text-base">Archvd</span>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              className="h-8 w-8 rounded-lg hover:bg-elev-1/80 flex items-center justify-center text-fg transition-colors"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Nav Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Primary Group */}
            <div className="mb-4">
              <h3 className="text-dim uppercase tracking-wider text-[11px] px-3 mb-2">Main</h3>
              <ul className="space-y-0.5">
                {primaryNav.map((item) => (
                  <DrawerNavItem key={item.id} item={item} pathname={pathname} />
                ))}
              </ul>
            </div>

            {/* Secondary Group */}
            <div className="mb-4">
              <h3 className="text-dim uppercase tracking-wider text-[11px] px-3 mb-2">Tools</h3>
              <ul className="space-y-0.5">
                {secondaryNav.map((item) => (
                  <DrawerNavItem key={item.id} item={item} pathname={pathname} />
                ))}
              </ul>
            </div>

            {/* Footer Nav */}
            <div className="border-t border-border/40 pt-3">
              <ul className="space-y-0.5">
                {footerNav.map((item) => (
                  <DrawerNavItem key={item.id} item={item} pathname={pathname} />
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// Drawer Nav Item
interface DrawerNavItemProps {
  item: {
    id: string
    icon: React.ComponentType<{ className?: string }>
    href: string
    label: string
    badge?: string
  }
  pathname: string | null
}

function DrawerNavItem({ item, pathname }: DrawerNavItemProps) {
  const Icon = item.icon
  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')

  return (
    <li>
      <Link
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg',
          'transition-all duration-120 ease-terminal',
          isActive ? 'bg-elev-2 border border-border/60 shadow-soft text-fg' : 'text-fg/90 hover:bg-elev-2/80'
        )}
      >
        {/* Active indicator bar */}
        {isActive && <span className="absolute left-0 top-1.5 h-[calc(100%-12px)] w-[2px] bg-accent rounded-r" />}

        <Icon className={cn('h-5 w-5 flex-shrink-0', isActive ? 'text-accent' : 'text-muted')} />
        <span className="flex-1 text-sm font-medium">{item.label}</span>

        {item.badge && (
          <span className="bg-accent-200 text-fg text-[11px] px-1.5 py-0.5 rounded font-medium">{item.badge}</span>
        )}
      </Link>
    </li>
  )
}
