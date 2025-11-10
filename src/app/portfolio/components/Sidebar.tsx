'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid,
  Boxes,
  TrendingUp,
  BarChart3,
  Settings,
  User,
  ReceiptText,
  CalendarRange,
  Pin,
  PinOff,
  UploadCloud,
  Search,
  Moon,
  Sun,
  Package,
  CreditCard,
  Activity,
  Eye,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useSidebar } from '@/contexts/SidebarContext'
import { CurrencySwitcher } from '@/components/CurrencySwitcher'
import { MarketQuickAdd } from '@/components/MarketQuickAdd'
import { AddFromSearchModal } from '@/components/modals/AddFromSearchModal'
import { useSearchParams } from 'next/navigation'

// Navigation structure
const primaryNav = [
  { id: 'portfolio', icon: LayoutGrid, href: '/portfolio', label: 'Portfolio' },
  { id: 'inventory', icon: Boxes, href: '/portfolio/inventory', label: 'Items' },
  { id: 'sales', icon: TrendingUp, href: '/portfolio/sales', label: 'Sales', badge: 'BETA' },
  { id: 'pnl', icon: FileText, href: '/portfolio/pnl', label: 'P&L' },
  { id: 'analytics', icon: BarChart3, href: '/portfolio/analytics', label: 'Analytics', badge: 'ALPHA' },
]

const secondaryNav = [
  { id: 'releases', icon: CalendarRange, href: '/portfolio/releases', label: 'Releases' },
  { id: 'watchlists', icon: Eye, href: '/portfolio/watchlists', label: 'Watchlists' },
  { id: 'expenses', icon: ReceiptText, href: '/portfolio/expenses', label: 'Expenses' },
  { id: 'subscriptions', icon: CreditCard, href: '/portfolio/subscriptions', label: 'Subscriptions' },
  { id: 'activity', icon: Activity, href: '/portfolio/activity', label: 'Activity' },
  { id: 'packages', icon: Package, href: '/portfolio/packages', label: 'Packages', badge: 'BETA' },
]

// Footer utilities (Settings, Import, Profile, Theme)
const footerNav = [
  { id: 'settings', icon: Settings, href: '/settings', label: 'Settings' },
  { id: 'accounting', icon: ReceiptText, href: '/portfolio/settings/accounting', label: 'Accounting' },
  { id: 'import', icon: UploadCloud, href: '/portfolio/import', label: 'Import' },
  { id: 'profile', icon: User, href: '/profile', label: 'Profile' },
]

export function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { pinned, setPinned } = useSidebar()
  const [expanded, setExpanded] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    // Initialize from localStorage or system preference
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme')
      if (saved === 'light' || saved === 'dark') return saved
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'light'
  })
  const [commandSearchOpen, setCommandSearchOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const leaveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const navRef = useRef<HTMLElement>(null)

  // Apply theme to document root
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark')
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

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
    }
  }

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      clearTimeout(hoverTimeoutRef.current)
      clearTimeout(leaveTimeoutRef.current)
    }
  }, [])

  // Auto-open search from URL parameter
  useEffect(() => {
    if (searchParams?.get('openSearch') === 'true') {
      setCommandSearchOpen(true)
    }
  }, [searchParams])

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandSearchOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Market Quick-Add handlers
  const handleSelectProduct = (product: any) => {
    setSelectedProduct({
      sku: product.sku,
      brand: 'Pokémon',
      model: product.name,
      colorway: product.subtitle,
      imageUrl: product.imageUrl,
      latestPrice: product.median ? {
        price: product.median,
        currency: product.currency,
        asOf: new Date().toISOString(),
        source: 'market',
      } : null,
    })
    setAddModalOpen(true)
  }

  const handleAddSuccess = () => {
    // Optionally refresh inventory or show notification
    setSelectedProduct(null)
  }

  return (
    <>
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
        'bg-elev-1 border-r border-keyline',
        'transition-[width,background,box-shadow] duration-120 ease-terminal',
        isExpanded ? 'w-[320px]' : 'w-16'
      )}
      style={{
        background: `
          linear-gradient(135deg, rgba(var(--archvd-accent-400-rgb), 0.05) 0%, transparent 28%, transparent 72%, rgba(var(--archvd-accent-400-rgb), 0.04) 100%),
          linear-gradient(to bottom, var(--archvd-bg-elev-1) 0%, var(--archvd-bg-elev-1) 40%, var(--archvd-bg-elev-2) 100%)
        `,
        boxShadow: isExpanded
          ? 'inset 2px 0 0 0 rgba(var(--archvd-accent-400-rgb), 0.35), 4px 0 24px -8px rgba(0,0,0,0.3)'
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

          {/* Command Search Trigger */}
          <button
            onClick={() => setCommandSearchOpen(true)}
            className={cn(
              "relative transition-boutique w-full",
              isExpanded ? "flex" : "hidden",
              "h-8 pl-7 pr-2 rounded-lg bg-elev-1/80 border border-border/40",
              "text-sm text-dim hover:text-fg hover:border-accent/50",
              "focus:outline-none focus:ring-2 focus:ring-focus",
              "text-left items-center gap-2"
            )}
            tabIndex={isExpanded ? 0 : -1}
          >
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" />
            <span className="flex-1">Search products...</span>
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border/60 bg-elev-2 px-1.5 font-mono text-[10px] font-medium text-muted">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <div className="flex flex-col gap-1.5 pt-3.5">
            {/* Primary Group */}
            <div>
              <h3
                className={cn(
                  "label-uppercase px-3 pt-2 pb-1 transition-boutique",
                  isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                style={{ color: '#8B857B' }}
              >
                Main
              </h3>
              <ul className="flex flex-col gap-0.5">
                {primaryNav.map((item, index) => (
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

            {/* Secondary Group */}
            <div className="mt-2">
              <h3
                className={cn(
                  "label-uppercase px-3 pt-2 pb-1 transition-boutique",
                  isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                style={{ color: '#8B857B' }}
              >
                Tools
              </h3>
              <ul className="flex flex-col gap-0.5">
                {secondaryNav.map((item, index) => (
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
          </div>
        </div>

        {/* Footer - Two-section layout */}
        <div className="border-t border-border/30 bg-elev-1/90 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
          {/* Quick Actions - Vertical stack when expanded, horizontal when collapsed */}
          <div
            className={cn(
              "px-3 pt-3",
              isExpanded ? "space-y-1" : "flex items-center justify-center gap-1 py-2"
            )}
          >
            {/* Settings */}
            <Link
              href="/settings"
              className={cn(
                "group rounded-lg flex items-center transition-boutique",
                "hover:bg-elev-2/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                pathname === '/settings' ? 'text-accent' : 'text-muted hover:text-fg',
                isExpanded ? "h-9 gap-2 px-2 w-full" : "h-9 w-9 justify-center"
              )}
              title={!isExpanded ? 'Settings' : undefined}
            >
              <Settings className="h-5 w-5 flex-shrink-0" strokeWidth={1.75} />
              {isExpanded && (
                <span className="text-xs font-medium truncate">Settings</span>
              )}
            </Link>

            {/* Accounting */}
            <Link
              href="/portfolio/settings/accounting"
              className={cn(
                "group rounded-lg flex items-center transition-boutique",
                "hover:bg-elev-2/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                pathname === '/portfolio/settings/accounting' ? 'text-accent' : 'text-muted hover:text-fg',
                isExpanded ? "h-9 gap-2 px-2 w-full" : "h-9 w-9 justify-center"
              )}
              title={!isExpanded ? 'Accounting' : undefined}
            >
              <ReceiptText className="h-5 w-5 flex-shrink-0" strokeWidth={1.75} />
              {isExpanded && (
                <span className="text-xs font-medium truncate">Accounting</span>
              )}
            </Link>

            {/* Import */}
            <Link
              href="/portfolio/import"
              className={cn(
                "group rounded-lg flex items-center transition-boutique",
                "hover:bg-elev-2/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                pathname === '/portfolio/import' ? 'text-accent' : 'text-muted hover:text-fg',
                isExpanded ? "h-9 gap-2 px-2 w-full" : "h-9 w-9 justify-center"
              )}
              title={!isExpanded ? 'Import' : undefined}
            >
              <UploadCloud className="h-5 w-5 flex-shrink-0" strokeWidth={1.75} />
              {isExpanded && (
                <span className="text-xs font-medium truncate">Import</span>
              )}
            </Link>

            {/* Profile */}
            <Link
              href="/profile"
              className={cn(
                "group rounded-lg flex items-center transition-boutique",
                "hover:bg-elev-2/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                pathname === '/profile' ? 'text-accent' : 'text-muted hover:text-fg',
                isExpanded ? "h-9 gap-2 px-2 w-full" : "h-9 w-9 justify-center"
              )}
              title={!isExpanded ? 'Profile' : undefined}
            >
              <User className="h-5 w-5 flex-shrink-0" strokeWidth={1.75} />
              {isExpanded && (
                <span className="text-xs font-medium truncate">Profile</span>
              )}
            </Link>

            {/* Pin Toggle - Only when expanded */}
            {isExpanded && (
              <button
                onClick={() => setPinned(!pinned)}
                className={cn(
                  "h-9 w-full rounded-lg flex items-center gap-2 px-2 transition-boutique",
                  "hover:bg-elev-2/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                  pinned ? 'text-accent' : 'text-muted hover:text-fg'
                )}
                title={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
                aria-label={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
              >
                {pinned ? (
                  <Pin className="h-5 w-5 flex-shrink-0" strokeWidth={1.75} />
                ) : (
                  <PinOff className="h-5 w-5 flex-shrink-0" strokeWidth={1.75} />
                )}
                <span className="text-xs font-medium flex-1 text-left">
                  {pinned ? 'Unpin Sidebar' : 'Pin Sidebar'}
                </span>
              </button>
            )}
          </div>

          {/* Bottom Section: Preferences (only when expanded) */}
          {isExpanded && (
            <div className="px-3 pb-3 pt-3 border-t border-border/20 space-y-2">
              <h3 className="label-uppercase text-muted/60 px-1 pb-1">
                Preferences
              </h3>

              {/* Theme Toggle */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={cn(
                  "w-full h-9 rounded-lg flex items-center gap-2 px-2 transition-boutique",
                  "hover:bg-elev-2/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                  theme === 'dark' ? 'text-accent' : 'text-muted hover:text-fg'
                )}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <Moon className="h-5 w-5 flex-shrink-0" strokeWidth={1.75} />
                ) : (
                  <Sun className="h-5 w-5 flex-shrink-0" strokeWidth={1.75} />
                )}
                <span className="text-xs font-medium flex-1 text-left">
                  {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </span>
              </button>

              {/* Currency Switcher */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted flex-shrink-0 w-16">Currency</span>
                <div className="flex-1 min-w-0">
                  <CurrencySwitcher />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>

    {/* Market Quick-Add Modal */}
    <MarketQuickAdd
      open={commandSearchOpen}
      onOpenChange={setCommandSearchOpen}
      onSelectProduct={handleSelectProduct}
    />

    {/* Add From Search Modal */}
    <AddFromSearchModal
      open={addModalOpen}
      onOpenChange={setAddModalOpen}
      product={selectedProduct}
      onSuccess={handleAddSuccess}
    />
    </>
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
  // Portfolio should only be active on exact match, other routes can match sub-paths
  const isActive = item.href === '/portfolio'
    ? pathname === '/portfolio'
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
          'flex items-center gap-3',
          'whitespace-nowrap overflow-hidden',
          'transition-boutique',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
          isActive
            ? 'bg-[#F3EFE8] text-ink font-medium shadow-soft'
            : 'text-fg/90 hover:bg-elev-2/80'
        )}
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
            'h-5 w-5 flex-shrink-0',
            isActive ? 'text-accent' : 'text-muted group-hover:text-accent'
          )}
          strokeWidth={1.75}
        />

        {/* Label - opacity transition with translateX */}
        <span
          className={cn(
            "flex-1 min-w-0 text-sm font-medium truncate transition-all duration-120",
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
              "flex-shrink-0 bg-accent-200 text-fg text-[10px] px-1.5 py-0.5 rounded font-medium",
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
