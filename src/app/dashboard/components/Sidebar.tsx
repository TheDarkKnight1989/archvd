'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Boxes,
  TrendingUp,
  BarChart3,
  Settings,
  User,
  CandlestickChart,
  ReceiptText,
  Calendar,
  Pin,
  PinOff,
  Upload,
  MessageCircle,
  Search,
  Moon,
  Sun,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useSidebar } from '@/contexts/SidebarContext'

// Navigation structure
const primaryNav = [
  { id: 'dashboard', icon: LayoutDashboard, href: '/dashboard', label: 'Dashboard' },
  { id: 'inventory', icon: Boxes, href: '/dashboard/inventory', label: 'Inventory' },
  { id: 'sales', icon: TrendingUp, href: '/dashboard/sales', label: 'Sales', badge: 'BETA' },
  { id: 'analytics', icon: BarChart3, href: '/dashboard/analytics', label: 'Analytics', badge: 'ALPHA' },
]

const secondaryNav = [
  { id: 'market', icon: CandlestickChart, href: '/dashboard/market', label: 'Market' },
  { id: 'releases', icon: Calendar, href: '/dashboard/releases', label: 'Releases' },
  { id: 'expenses', icon: ReceiptText, href: '/dashboard/expenses', label: 'Expenses' },
  { id: 'packages', icon: Boxes, href: '/dashboard/packages', label: 'Packages', badge: 'BETA' },
]

const utilityNav = [
  { id: 'import', icon: Upload, href: '/dashboard/import', label: 'Import' },
  { id: 'help', icon: MessageCircle, href: '/help', label: 'Help' },
  { id: 'settings', icon: Settings, href: '/settings', label: 'Settings' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { pinned, setPinned } = useSidebar()
  const [flyoutOpen, setFlyoutOpen] = useState(false)
  const [focusWithin, setFocusWithin] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [theme, setTheme] = useState<'matrix' | 'system'>('matrix')
  const hoverTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const leaveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const railRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Show flyout when pinned, hovering, or focused
  const showFlyout = pinned || flyoutOpen || focusWithin

  // Hover handlers with debounce
  const handleMouseEnter = () => {
    if (pinned) return

    clearTimeout(leaveTimeoutRef.current)
    hoverTimeoutRef.current = setTimeout(() => {
      setFlyoutOpen(true)
    }, 80)
  }

  const handleMouseLeave = () => {
    if (pinned) return

    clearTimeout(hoverTimeoutRef.current)
    leaveTimeoutRef.current = setTimeout(() => {
      setFlyoutOpen(false)
      setSearchQuery('')
    }, 250)
  }

  // Focus handlers
  const handleFocusIn = (e: React.FocusEvent) => {
    if (railRef.current?.contains(e.target as Node)) {
      setFocusWithin(true)
      if (!pinned) {
        setFlyoutOpen(true)
      }
    }
  }

  const handleFocusOut = (e: React.FocusEvent) => {
    if (!railRef.current?.contains(e.relatedTarget as Node)) {
      setFocusWithin(false)
      if (!pinned) {
        setFlyoutOpen(false)
        setSearchQuery('')
      }
    }
  }

  // Focus search on flyout open
  useEffect(() => {
    if (showFlyout && searchInputRef.current) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus()
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [showFlyout])

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      clearTimeout(hoverTimeoutRef.current)
      clearTimeout(leaveTimeoutRef.current)
    }
  }, [])

  // Filter nav items by search
  const filterItems = (items: typeof primaryNav) => {
    if (!searchQuery) return items
    const query = searchQuery.toLowerCase()
    return items.filter(item =>
      item.label.toLowerCase().includes(query) ||
      item.id.toLowerCase().includes(query)
    )
  }

  const filteredPrimaryNav = filterItems(primaryNav)
  const filteredSecondaryNav = filterItems(secondaryNav)
  const filteredUtilityNav = filterItems(utilityNav)

  return (
    <div
      ref={railRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocusCapture={handleFocusIn}
      onBlurCapture={handleFocusOut}
      className="fixed left-0 top-0 h-dvh w-16 bg-elev-1 border-r border-border z-40 max-md:hidden"
      style={{
        background: 'linear-gradient(to bottom, var(--archvd-elev-1), var(--archvd-elev-2) 100%)',
      }}
    >
      {/* Collapsed Rail Content */}
      <nav aria-label="Primary" className="flex flex-col h-full py-4">
        {/* Logo */}
        <div className="px-3 mb-6 flex items-center justify-center">
          <div className="h-8 w-8 rounded-lg bg-accent-200 flex items-center justify-center">
            <span className="text-fg font-bold text-sm">A</span>
          </div>
        </div>

        {/* Primary Nav */}
        <ul className="space-y-1 px-2">
          {primaryNav.map((item) => (
            <NavItem key={item.id} item={item} pathname={pathname} showLabel={false} />
          ))}
        </ul>

        {/* Divider */}
        <div className="border-t border-border/40 my-3 mx-2" />

        {/* Secondary Nav */}
        <ul className="space-y-1 px-2">
          {secondaryNav.map((item) => (
            <NavItem key={item.id} item={item} pathname={pathname} showLabel={false} />
          ))}
        </ul>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer Nav */}
        <ul className="space-y-1 px-2">
          {utilityNav.map((item) => (
            <NavItem key={item.id} item={item} pathname={pathname} showLabel={false} />
          ))}
        </ul>
      </nav>

      {/* Flyout Panel */}
      <div
        className={cn(
          'fixed left-16 top-0 h-dvh w-[280px] bg-elev-2 border-r border-border overflow-hidden',
          'transition-all duration-120 ease-terminal',
          showFlyout ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 -translate-x-4 pointer-events-none'
        )}
        style={{
          background: `
            linear-gradient(135deg, rgba(var(--archvd-accent-400-rgb, 15, 141, 101), 0.04) 0%, transparent 50%),
            linear-gradient(to bottom, var(--archvd-elev-2), var(--archvd-elev-3) 100%)
          `,
          boxShadow: showFlyout
            ? 'inset 2px 0 0 0 rgba(var(--archvd-accent-400-rgb, 15, 141, 101), 0.35), 4px 0 24px -8px rgba(0,0,0,0.3)'
            : 'none',
        }}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-3 py-4">
            {/* Logo + App Name */}
            <div className="mb-4 flex items-center gap-3 px-2">
              <div className="h-8 w-8 rounded-lg bg-accent-200 flex items-center justify-center flex-shrink-0">
                <span className="text-fg font-bold text-sm">A</span>
              </div>
              <span
                className={cn(
                  "text-fg font-semibold text-base transition-all duration-200",
                  showFlyout ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2"
                )}
                style={{ transitionDelay: '60ms' }}
              >
                Archvd
              </span>
            </div>

            {/* QuickSearch */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-dim pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search…"
                className={cn(
                  "w-full h-8 pl-7 pr-2 rounded-lg bg-elev-1 border border-border/40",
                  "text-sm text-fg placeholder:text-dim",
                  "focus:outline-none focus:border-accent/50 focus:glow-accent-hover",
                  "transition-all duration-120"
                )}
                tabIndex={showFlyout ? 0 : -1}
              />
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            <div className="flex flex-col gap-1.5">
              {/* Primary Group */}
              {filteredPrimaryNav.length > 0 && (
                <div>
                  <h3 className="px-3 pt-2 pb-1 text-dim uppercase tracking-wider text-[11px]">
                    Main
                  </h3>
                  <ul className="flex flex-col gap-0.5">
                    {filteredPrimaryNav.map((item, index) => (
                      <NavItem
                        key={item.id}
                        item={item}
                        pathname={pathname}
                        showLabel={true}
                        index={index}
                        showFlyout={showFlyout}
                      />
                    ))}
                  </ul>
                </div>
              )}

              {/* Secondary Group */}
              {filteredSecondaryNav.length > 0 && (
                <div className="mt-2">
                  <h3 className="px-3 pt-2 pb-1 text-dim uppercase tracking-wider text-[11px]">
                    Tools
                  </h3>
                  <ul className="flex flex-col gap-0.5">
                    {filteredSecondaryNav.map((item, index) => (
                      <NavItem
                        key={item.id}
                        item={item}
                        pathname={pathname}
                        showLabel={true}
                        index={index}
                        showFlyout={showFlyout}
                      />
                    ))}
                  </ul>
                </div>
              )}

              {/* Utility Group */}
              {filteredUtilityNav.length > 0 && (
                <div className="mt-2">
                  <h3 className="px-3 pt-2 pb-1 text-dim uppercase tracking-wider text-[11px]">
                    Utilities
                  </h3>
                  <ul className="flex flex-col gap-0.5">
                    {filteredUtilityNav.map((item, index) => (
                      <NavItem
                        key={item.id}
                        item={item}
                        pathname={pathname}
                        showLabel={true}
                        index={index}
                        showFlyout={showFlyout}
                      />
                    ))}
                  </ul>
                </div>
              )}

              {/* No Results */}
              {searchQuery && filteredPrimaryNav.length === 0 && filteredSecondaryNav.length === 0 && filteredUtilityNav.length === 0 && (
                <div className="px-3 py-8 text-center text-sm text-dim">
                  No results for "{searchQuery}"
                </div>
              )}
            </div>
          </div>

          {/* Footer Utility Strip */}
          <div
            className="h-14 px-3 border-t border-border/40 bg-elev-1/80 backdrop-blur-sm flex items-center justify-between gap-3"
            style={{
              background: 'linear-gradient(to top, var(--archvd-elev-1), transparent)',
            }}
          >
            {/* Profile */}
            <Link
              href="/profile"
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-lg flex-1",
                "hover:bg-elev-2/80 transition-all duration-120",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/25"
              )}
              title="Profile"
            >
              <div className="h-6 w-6 rounded-full bg-accent-200 flex items-center justify-center flex-shrink-0">
                <User className="h-3.5 w-3.5 text-fg" strokeWidth={1.75} />
              </div>
              <span className="text-xs font-medium text-fg/90 truncate">Profile</span>
            </Link>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'matrix' ? 'system' : 'matrix')}
              className={cn(
                "h-7 w-7 rounded-lg flex items-center justify-center",
                "hover:bg-elev-2/80 transition-all duration-120",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/25",
                theme === 'matrix' ? 'text-accent' : 'text-muted'
              )}
              title={theme === 'matrix' ? 'Matrix Theme' : 'System Theme'}
              aria-label="Toggle theme"
            >
              {theme === 'matrix' ? (
                <Moon className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <Sun className="h-4 w-4" strokeWidth={1.75} />
              )}
            </button>

            {/* Pin Toggle */}
            <button
              onClick={() => setPinned(!pinned)}
              className={cn(
                "h-7 w-7 rounded-lg flex items-center justify-center",
                "hover:bg-elev-2/80 transition-all duration-120",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/25",
                pinned ? 'text-accent' : 'text-muted'
              )}
              title={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
              aria-label={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
            >
              {pinned ? (
                <Pin className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <PinOff className="h-4 w-4" strokeWidth={1.75} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// NavItem Component
interface NavItemProps {
  item: {
    id: string
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
    href: string
    label: string
    badge?: string
  }
  pathname: string | null
  showLabel: boolean
  index?: number
  showFlyout?: boolean
}

function NavItem({ item, pathname, showLabel, index = 0, showFlyout = false }: NavItemProps) {
  const Icon = item.icon
  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
  const [isHovered, setIsHovered] = useState(false)

  // Calculate stagger delay for animations
  const staggerDelay = showLabel ? index * 20 : 0

  if (showLabel) {
    // Flyout item with label (vertical stack, grid layout)
    return (
      <li
        style={{
          animationDelay: `${staggerDelay}ms`,
          transitionDelay: showFlyout ? `${staggerDelay}ms` : '0ms',
        }}
        className={cn(
          "transition-all duration-200",
          showFlyout
            ? "opacity-100 translate-x-0"
            : "opacity-0 translate-x-1"
        )}
      >
        <Link
          href={item.href}
          aria-current={isActive ? 'page' : undefined}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={cn(
            'group relative h-11 px-3 rounded-xl',
            'grid grid-cols-[24px,1fr,auto] items-center gap-3',
            'transition-all duration-120 ease-terminal',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/25',
            isActive
              ? 'bg-elev-2 border border-border/60 shadow-soft text-fg'
              : 'text-fg/90 hover:bg-elev-2/80 hover:glow-accent-hover'
          )}
          style={{
            background: isActive
              ? 'radial-gradient(circle at center, rgba(var(--archvd-accent-400-rgb, 15, 141, 101), 0.08) 0%, transparent 80%), var(--archvd-elev-2)'
              : undefined,
          }}
        >
          {/* Active indicator bar with hover animation */}
          {(isActive || isHovered) && (
            <span
              className={cn(
                "absolute left-0 top-1.5 w-[2px] bg-accent rounded-r transition-all duration-120 ease-in-out",
                isActive ? "h-[calc(100%-12px)]" : "h-[calc(60%)]"
              )}
            />
          )}

          {/* Icon */}
          <Icon
            className={cn(
              'h-5 w-5 flex-shrink-0 justify-self-start',
              isActive ? 'text-accent' : 'text-muted group-hover:text-accent'
            )}
            strokeWidth={1.75}
          />

          {/* Label */}
          <span
            className="text-sm font-medium truncate"
            title={item.label}
          >
            {item.label}
          </span>

          {/* Badge */}
          {item.badge && (
            <span className="bg-accent-200 text-fg text-[10px] px-1.5 py-0.5 rounded font-medium justify-self-end">
              {item.badge}
            </span>
          )}
        </Link>
      </li>
    )
  }

  // Rail item (icon only with tooltip)
  return (
    <li>
      <Link
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        title={item.label}
        className={cn(
          'group relative h-10 flex items-center justify-center rounded-lg',
          'transition-all duration-120 ease-terminal',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/25',
          isActive
            ? 'bg-elev-2 shadow-soft text-accent'
            : 'text-muted hover:bg-elev-2/80 hover:text-fg hover:glow-accent-hover'
        )}
      >
        {isActive && <span className="absolute left-0 w-0.5 h-6 bg-accent rounded-r" />}
        <Icon className="h-5 w-5" strokeWidth={1.75} />
        <span className="sr-only">{item.label}</span>
      </Link>
    </li>
  )
}
