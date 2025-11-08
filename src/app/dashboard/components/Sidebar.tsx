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

// Navigation structure (trimmed - removed Browse, Sets, Products)
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
  { id: 'profile', icon: User, href: '/profile', label: 'Profile' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { pinned, setPinned } = useSidebar()
  const [expanded, setExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [theme, setTheme] = useState<'matrix' | 'system'>('matrix')
  const hoverTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const leaveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const navRef = useRef<HTMLElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Determine if sidebar should be expanded
  const isExpanded = pinned || expanded

  // Hover handlers with debounce
  const handleMouseEnter = () => {
    if (pinned) return

    clearTimeout(leaveTimeoutRef.current)
    hoverTimeoutRef.current = setTimeout(() => {
      setExpanded(true)
    }, 80)
  }

  const handleMouseLeave = () => {
    if (pinned) return

    clearTimeout(hoverTimeoutRef.current)
    leaveTimeoutRef.current = setTimeout(() => {
      setExpanded(false)
      setSearchQuery('')
    }, 250)
  }

  // Focus handlers
  const handleFocusIn = (e: React.FocusEvent) => {
    if (navRef.current?.contains(e.target as Node) && !pinned) {
      setExpanded(true)
    }
  }

  const handleFocusOut = (e: React.FocusEvent) => {
    if (!navRef.current?.contains(e.relatedTarget as Node) && !pinned) {
      setExpanded(false)
      setSearchQuery('')
    }
  }

  // Focus search on expand
  useEffect(() => {
    if (isExpanded && searchInputRef.current) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus()
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [isExpanded])

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
    <nav
      ref={navRef}
      aria-label="Primary"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocusCapture={handleFocusIn}
      onBlurCapture={handleFocusOut}
      data-expanded={isExpanded || undefined}
      data-pinned={pinned || undefined}
      className={cn(
        'fixed left-0 top-0 h-dvh z-40 max-md:hidden',
        'bg-elev-1 border-r border-border',
        'transition-[width,background,box-shadow] duration-120 ease-terminal',
        isExpanded ? 'w-[320px]' : 'w-16'
      )}
      style={{
        background: isExpanded
          ? `
            linear-gradient(135deg, rgba(var(--archvd-accent-400-rgb, 15, 141, 101), 0.06) 0%, transparent 28%, transparent 72%, rgba(var(--archvd-accent-400-rgb, 15, 141, 101), 0.05) 100%),
            linear-gradient(to bottom, var(--archvd-elev-2), var(--archvd-elev-3) 100%)
          `
          : 'linear-gradient(to bottom, var(--archvd-elev-1), var(--archvd-elev-2) 100%)',
        boxShadow: isExpanded
          ? 'inset 2px 0 0 0 rgba(var(--archvd-accent-400-rgb, 15, 141, 101), 0.35), 4px 0 24px -8px rgba(0,0,0,0.3)'
          : 'none',
      }}
    >
      {/* Wrapper */}
      <div className="flex h-full flex-col">
        {/* Top Block: Logo + Wordmark + Search */}
        <div className="px-3 py-4">
          {/* Logo + App Name */}
          <div className="mb-4 flex items-center gap-3 px-2">
            <div className="h-8 w-8 rounded-lg bg-accent-200 flex items-center justify-center flex-shrink-0">
              <span className="text-fg font-bold text-sm">A</span>
            </div>
            <span
              className={cn(
                "text-fg font-semibold text-base transition-all duration-200",
                isExpanded ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2 pointer-events-none"
              )}
              style={{ transitionDelay: isExpanded ? '60ms' : '0ms' }}
            >
              Archvd
            </span>
          </div>

          {/* QuickSearch */}
          <div className={cn(
            "relative transition-all duration-120",
            isExpanded ? "block" : "hidden"
          )}>
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-dim pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search…"
              className={cn(
                "w-full h-8 pl-7 pr-2 rounded-lg bg-elev-1/80 border border-border/40",
                "text-sm text-fg placeholder:text-dim",
                "focus:outline-none focus:border-accent/50 focus:glow-accent-hover",
                "transition-all duration-120"
              )}
              tabIndex={isExpanded ? 0 : -1}
            />
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <div className="flex flex-col gap-1.5">
            {/* Primary Group */}
            {filteredPrimaryNav.length > 0 && (
              <div>
                <h3
                  className={cn(
                    "px-3 pt-2 pb-1 text-[10px] tracking-widest uppercase transition-all duration-120",
                    isExpanded ? "text-accent-200/60 opacity-100" : "opacity-0 pointer-events-none"
                  )}
                >
                  Main
                </h3>
                <ul className="flex flex-col gap-0.5">
                  {filteredPrimaryNav.map((item, index) => (
                    <NavItem
                      key={item.id}
                      item={item}
                      pathname={pathname}
                      isExpanded={isExpanded}
                      index={index}
                    />
                  ))}
                </ul>
              </div>
            )}

            {/* Secondary Group */}
            {filteredSecondaryNav.length > 0 && (
              <div className="mt-2">
                <h3
                  className={cn(
                    "px-3 pt-2 pb-1 text-[10px] tracking-widest uppercase transition-all duration-120",
                    isExpanded ? "text-accent-200/60 opacity-100" : "opacity-0 pointer-events-none"
                  )}
                >
                  Tools
                </h3>
                <ul className="flex flex-col gap-0.5">
                  {filteredSecondaryNav.map((item, index) => (
                    <NavItem
                      key={item.id}
                      item={item}
                      pathname={pathname}
                      isExpanded={isExpanded}
                      index={index}
                    />
                  ))}
                </ul>
              </div>
            )}

            {/* Utility Group */}
            {filteredUtilityNav.length > 0 && (
              <div className="mt-2">
                <h3
                  className={cn(
                    "px-3 pt-2 pb-1 text-[10px] tracking-widest uppercase transition-all duration-120",
                    isExpanded ? "text-accent-200/60 opacity-100" : "opacity-0 pointer-events-none"
                  )}
                >
                  Utilities
                </h3>
                <ul className="flex flex-col gap-0.5">
                  {filteredUtilityNav.map((item, index) => (
                    <NavItem
                      key={item.id}
                      item={item}
                      pathname={pathname}
                      isExpanded={isExpanded}
                      index={index}
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
          className={cn(
            "h-14 px-3 border-t border-border/40 bg-elev-1/80 backdrop-blur-sm gap-3",
            "transition-all duration-120",
            isExpanded ? "flex items-center justify-between" : "hidden"
          )}
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
    </nav>
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
  isExpanded: boolean
  index?: number
}

function NavItem({ item, pathname, isExpanded, index = 0 }: NavItemProps) {
  const Icon = item.icon
  // Dashboard should only be active on exact match, other routes can match sub-paths
  const isActive = item.href === '/dashboard'
    ? pathname === '/dashboard'
    : pathname === item.href || pathname?.startsWith(item.href + '/')
  const [isHovered, setIsHovered] = useState(false)

  // Calculate stagger delay for label animations
  const staggerDelay = isExpanded ? index * 20 : 0

  return (
    <li>
      <Link
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        title={!isExpanded ? item.label : undefined}
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
            ? 'radial-gradient(circle at center, rgba(var(--archvd-accent-400-rgb, 15, 141, 101), 0.08) 0%, rgba(var(--archvd-accent-400-rgb, 15, 141, 101), 0.02) 80%), var(--archvd-elev-2)'
            : undefined,
        }}
      >
        {/* Active indicator bar with hover animation */}
        {(isActive || isHovered) && (
          <span
            className={cn(
              "absolute left-0 top-1.5 w-[3px] bg-accent rounded-r transition-all duration-120 ease-in-out",
              isActive ? (isHovered ? "h-[calc(100%-12px)]" : "h-[calc(60%)]") : "h-[calc(60%)]"
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

        {/* Label - opacity transition with translateX */}
        <span
          className={cn(
            "text-sm font-medium truncate transition-all duration-120",
            isExpanded
              ? "opacity-100 translate-x-0"
              : "opacity-0 translate-x-1 pointer-events-none"
          )}
          style={{
            transitionDelay: isExpanded ? `${staggerDelay}ms` : '0ms',
          }}
          title={item.label}
        >
          {item.label}
        </span>

        {/* Badge - hidden when collapsed */}
        {item.badge && (
          <span
            className={cn(
              "bg-accent-200 text-fg text-[10px] px-1.5 py-0.5 rounded font-medium justify-self-end",
              "transition-all duration-120",
              isExpanded
                ? "opacity-100 translate-x-0"
                : "opacity-0 translate-x-1 pointer-events-none"
            )}
            style={{
              transitionDelay: isExpanded ? `${staggerDelay + 40}ms` : '0ms',
            }}
          >
            {item.badge}
          </span>
        )}
      </Link>
    </li>
  )
}
