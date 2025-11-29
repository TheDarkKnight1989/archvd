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
  Package,
  Eye,
  FileText,
  ArrowLeftRight,
  List,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useSidebar } from '@/contexts/SidebarContext'
import { CurrencySwitcher } from '@/components/CurrencySwitcher'
import { MarketQuickAdd } from '@/components/MarketQuickAdd'
import { AddFromSearchModal } from '@/components/modals/AddFromSearchModal'
import { useSearchParams } from 'next/navigation'

// Navigation structure - Reorganized into logical groups
const manageNav = [
  { id: 'portfolio', icon: LayoutGrid, href: '/portfolio', label: 'Overview' },
  { id: 'inventory', icon: Boxes, href: '/portfolio/inventory', label: 'Inventory' },
  { id: 'transactions', icon: ArrowLeftRight, href: '/portfolio/transactions/history', label: 'Transactions' },
]

const sellNav = [
  { id: 'sales', icon: TrendingUp, href: '/portfolio/sales', label: 'Sales', badge: 'BETA' },
  { id: 'packages', icon: Package, href: '/portfolio/packages', label: 'Packages', badge: 'BETA' },
  { id: 'sell-lists', icon: List, href: '/sell-lists', label: 'Sell Lists' },
]

const financeNav = [
  { id: 'pnl', icon: FileText, href: '/portfolio/pnl', label: 'P&L' },
  { id: 'expenses', icon: ReceiptText, href: '/portfolio/expenses', label: 'Expenses' },
  { id: 'analytics', icon: BarChart3, href: '/portfolio/analytics', label: 'Analytics', badge: 'ALPHA' },
]

const marketNav = [
  { id: 'releases', icon: CalendarRange, href: '/portfolio/releases', label: 'Releases' },
  { id: 'watchlists', icon: Eye, href: '/portfolio/watchlists', label: 'Watchlists' },
]

// Footer utilities (Settings, Import, Profile, Theme)
const footerNav = [
  { id: 'settings', icon: Settings, href: '/settings', label: 'Settings' },
  { id: 'accounting', icon: ReceiptText, href: '/portfolio/settings/accounting', label: 'Accounting' },
  { id: 'import', icon: UploadCloud, href: '/portfolio/import', label: 'Import' },
  { id: 'profile', icon: User, href: '/profile', label: 'Profile' },
]

// Shared sidebar content component used by both desktop and mobile
interface SidebarContentProps {
  isExpanded: boolean
  onClose?: () => void // For mobile drawer close
  isMobile?: boolean
}

export function SidebarContent({ isExpanded, onClose, isMobile = false }: SidebarContentProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { pinned, setPinned } = useSidebar()
  const [commandSearchOpen, setCommandSearchOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)

  // Auto-open search from URL parameter
  useEffect(() => {
    if (searchParams?.get('openSearch') === 'true') {
      setCommandSearchOpen(true)
    }
  }, [searchParams])

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
    setSelectedProduct(null)
  }

  return (
    <>
      {/* Wrapper */}
      <div className="flex h-full flex-col overflow-y-auto">
        {/* Top Block: Logo + Wordmark + Search */}
        <div className="px-3 sm:px-4 py-3 sm:py-4">
          {/* Logo + App Name */}
          <div className="mb-4 flex items-center gap-3 px-2">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200"
              style={{
                background: '#00FF94',
                boxShadow: '0 0 20px rgba(0, 255, 148, 0.4), 0 0 40px rgba(0, 255, 148, 0.2)'
              }}
            >
              <span className="font-bold text-sm" style={{ color: '#0E1A15' }}>A</span>
            </div>
            <span
              className={cn(
                "font-semibold text-base transition-all duration-200",
                isExpanded ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2 pointer-events-none"
              )}
              style={{
                transitionDelay: isExpanded ? '60ms' : '0ms',
                color: '#E8F6EE',
                textShadow: isExpanded ? '0 0 20px rgba(0, 255, 148, 0.15)' : 'none'
              }}
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
              "h-8 pl-7 pr-2 rounded-lg border",
              "text-sm focus:outline-none focus:ring-2",
              "text-left items-center gap-2"
            )}
            style={{
              background: 'linear-gradient(135deg, #0B1510 0%, rgba(0, 255, 148, 0.05) 100%)',
              borderColor: 'rgba(0, 255, 148, 0.2)',
              color: '#7FA08F'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#00FF94'
              e.currentTarget.style.borderColor = '#00FF94'
              e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 255, 148, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#7FA08F'
              e.currentTarget.style.borderColor = 'rgba(0, 255, 148, 0.2)'
              e.currentTarget.style.boxShadow = 'none'
            }}
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
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 pb-3">
          <div className="flex flex-col gap-2 sm:gap-3 pt-3.5">
            {/* 📦 Manage */}
            <div>
              <h3
                className={cn(
                  "text-[10px] font-bold tracking-widest uppercase px-3 pt-2 pb-1.5 transition-boutique flex items-center gap-1.5",
                  isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                style={{
                  color: '#00FF94',
                  textShadow: '0 0 15px rgba(0, 255, 148, 0.3)'
                }}
              >
                <span className="text-xs">📦</span>
                Manage
              </h3>
              <ul className="flex flex-col gap-0.5">
                {manageNav.map((item, index) => (
                  <NavItem
                    key={item.id}
                    item={item}
                    pathname={pathname}
                    isExpanded={isExpanded}
                    index={index}
                    onClick={isMobile ? onClose : undefined}
                  />
                ))}
              </ul>
            </div>

            {/* 💸 Sell */}
            <div className="mt-1">
              <h3
                className={cn(
                  "text-[10px] font-bold tracking-widest uppercase px-3 pt-2 pb-1.5 transition-boutique flex items-center gap-1.5",
                  isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                style={{
                  color: '#00FF94',
                  textShadow: '0 0 15px rgba(0, 255, 148, 0.3)'
                }}
              >
                <span className="text-xs">💸</span>
                Sell
              </h3>
              <ul className="flex flex-col gap-0.5">
                {sellNav.map((item, index) => (
                  <NavItem
                    key={item.id}
                    item={item}
                    pathname={pathname}
                    isExpanded={isExpanded}
                    index={index}
                    onClick={isMobile ? onClose : undefined}
                  />
                ))}
              </ul>
            </div>

            {/* 📊 Finance */}
            <div className="mt-1">
              <h3
                className={cn(
                  "text-[10px] font-bold tracking-widest uppercase px-3 pt-2 pb-1.5 transition-boutique flex items-center gap-1.5",
                  isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                style={{
                  color: '#00FF94',
                  textShadow: '0 0 15px rgba(0, 255, 148, 0.3)'
                }}
              >
                <span className="text-xs">📊</span>
                Finance
              </h3>
              <ul className="flex flex-col gap-0.5">
                {financeNav.map((item, index) => (
                  <NavItem
                    key={item.id}
                    item={item}
                    pathname={pathname}
                    isExpanded={isExpanded}
                    index={index}
                    onClick={isMobile ? onClose : undefined}
                  />
                ))}
              </ul>
            </div>

            {/* 🔍 Market */}
            <div className="mt-1">
              <h3
                className={cn(
                  "text-[10px] font-bold tracking-widest uppercase px-3 pt-2 pb-1.5 transition-boutique flex items-center gap-1.5",
                  isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                style={{
                  color: '#00FF94',
                  textShadow: '0 0 15px rgba(0, 255, 148, 0.3)'
                }}
              >
                <span className="text-xs">🔍</span>
                Market
              </h3>
              <ul className="flex flex-col gap-0.5">
                {marketNav.map((item, index) => (
                  <NavItem
                    key={item.id}
                    item={item}
                    pathname={pathname}
                    isExpanded={isExpanded}
                    index={index}
                    onClick={isMobile ? onClose : undefined}
                  />
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Footer - Two-section layout */}
        <div
          className="border-t-2 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]"
          style={{
            borderColor: 'rgba(0, 255, 148, 0.15)',
            background: 'linear-gradient(to top, rgba(0, 255, 148, 0.05), transparent)'
          }}
        >
          {/* Quick Actions - Vertical stack when expanded, horizontal when collapsed */}
          <div
            className={cn(
              "px-3 pt-3",
              isExpanded ? "space-y-1" : "flex flex-col items-center justify-center gap-1 py-2"
            )}
          >
            {/* Settings */}
            <Link
              href="/settings"
              onClick={isMobile ? onClose : undefined}
              className={cn(
                "group rounded-lg flex items-center transition-all duration-200",
                "hover:bg-elev-2/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                "active:scale-[0.96] active:shadow-[0_0_15px_rgba(var(--archvd-accent-rgb),0.3),0_0_30px_rgba(var(--archvd-accent-rgb),0.15)]",
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
              onClick={isMobile ? onClose : undefined}
              className={cn(
                "group rounded-lg flex items-center transition-all duration-200",
                "hover:bg-elev-2/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                "active:scale-[0.96] active:shadow-[0_0_15px_rgba(var(--archvd-accent-rgb),0.3),0_0_30px_rgba(var(--archvd-accent-rgb),0.15)]",
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
              onClick={isMobile ? onClose : undefined}
              className={cn(
                "group rounded-lg flex items-center transition-all duration-200",
                "hover:bg-elev-2/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                "active:scale-[0.96] active:shadow-[0_0_15px_rgba(var(--archvd-accent-rgb),0.3),0_0_30px_rgba(var(--archvd-accent-rgb),0.15)]",
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

            {/* Pin Toggle - Only when expanded and not mobile */}
            {isExpanded && !isMobile && (
              <button
                onClick={() => setPinned(!pinned)}
                className={cn(
                  "h-9 w-full rounded-lg flex items-center gap-2 px-2 transition-all duration-200",
                  "hover:bg-elev-2/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                  "active:scale-[0.96] active:shadow-[0_0_15px_rgba(var(--archvd-accent-rgb),0.3),0_0_30px_rgba(var(--archvd-accent-rgb),0.15)]",
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

          {/* Bottom Section: Currency (only when expanded) */}
          {isExpanded && (
            <div className="px-3 pb-3 pt-3 border-t-2 space-y-2" style={{ borderColor: 'rgba(0, 255, 148, 0.1)' }}>
              <h3
                className="label-uppercase px-1 pb-1"
                style={{
                  color: '#00FF94',
                  textShadow: '0 0 15px rgba(0, 255, 148, 0.3)'
                }}
              >
                Preferences
              </h3>

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

// Desktop sidebar component
export function Sidebar() {
  const { pinned } = useSidebar()
  const [expanded, setExpanded] = useState(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const leaveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const navRef = useRef<HTMLElement>(null)

  // Force dark mode
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
    document.documentElement.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  }, [])

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
        'border-r-2 transition-[width,background,box-shadow,border] duration-120 ease-terminal',
        isExpanded ? 'w-[320px]' : 'w-16'
      )}
      style={{
        background: isExpanded
          ? 'linear-gradient(135deg, #0E1A15 0%, #0B1510 50%, rgba(0, 255, 148, 0.03) 100%)'
          : '#0E1A15',
        borderColor: isExpanded ? 'rgba(0, 255, 148, 0.15)' : '#15251B',
        boxShadow: isExpanded
          ? 'inset 2px 0 0 0 rgba(0, 255, 148, 0.25), 4px 0 24px -8px rgba(0,0,0,0.4), 0 0 60px -15px rgba(0, 255, 148, 0.1)'
          : 'none',
      }}
    >
      <SidebarContent isExpanded={isExpanded} isMobile={false} />
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
  onClick?: () => void
}

function NavItem({ item, pathname, isExpanded, index = 0, onClick }: NavItemProps) {
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
        onClick={onClick}
        aria-current={isActive ? 'page' : undefined}
        title={!isExpanded ? item.label : undefined}
        onMouseEnter={(e) => {
          setIsHovered(true)
          if (!isActive) {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0, 255, 148, 0.1) 0%, rgba(0, 255, 148, 0.05) 100%)'
            e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 255, 148, 0.2)'
          }
        }}
        onMouseLeave={(e) => {
          setIsHovered(false)
          if (!isActive) {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.boxShadow = 'none'
          }
        }}
        className={cn(
          'group relative h-11 px-3 rounded-xl',
          'flex items-center gap-3',
          'whitespace-nowrap overflow-hidden',
          'transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2',
          isActive ? 'font-semibold border' : ''
        )}
        style={isActive ? {
          background: 'linear-gradient(135deg, #00FF94 0%, #00E085 100%)',
          borderColor: '#00FF94',
          color: '#0E1A15',
          boxShadow: '0 0 20px rgba(0, 255, 148, 0.5), 0 0 40px rgba(0, 255, 148, 0.2)'
        } : {
          color: '#E8F6EE',
        }}
      >
        {/* Active indicator bar with hover animation */}
        {(isActive || isHovered) && (
          <span
            className={cn(
              "absolute left-0 top-1.5 w-[3px] bg-accent rounded-r transition-all duration-200 ease-out",
              isActive ? (isHovered ? "h-[calc(100%-12px)]" : "h-[calc(60%)]") : "h-[calc(60%)]"
            )}
            style={isActive ? {
              boxShadow: `
                0 0 8px rgba(var(--archvd-accent-rgb), 0.6),
                0 0 16px rgba(var(--archvd-accent-rgb), 0.3)
              `
            } : undefined}
          />
        )}

        {/* Icon */}
        <Icon
          className={cn(
            'h-5 w-5 flex-shrink-0 transition-all duration-200',
            isActive ? 'text-accent' : 'text-muted group-hover:text-accent'
          )}
          strokeWidth={isActive ? 2 : 1.75}
        />

        {/* Label - opacity transition with translateX */}
        <span
          className={cn(
            "flex-1 min-w-0 text-sm truncate transition-all duration-120",
            isActive ? "font-semibold" : "font-medium",
            isExpanded
              ? "opacity-100 translate-x-0"
              : "opacity-0 translate-x-1 pointer-events-none"
          )}
          style={{
            transitionDelay: isExpanded ? `${staggerDelay}ms` : '0ms',
            textShadow: isActive ? '0 0 12px rgba(var(--archvd-accent-rgb), 0.3)' : undefined,
          }}
          title={item.label}
        >
          {item.label}
        </span>

        {/* Badge - hidden when collapsed, enhanced styling */}
        {item.badge && (
          <span
            className={cn(
              "flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider",
              "transition-all duration-120 border",
              isExpanded
                ? "opacity-100 translate-x-0"
                : "opacity-0 translate-x-1 pointer-events-none",
              // Badge color variants
              item.badge === 'BETA' && "bg-blue-500/10 text-blue-400 border-blue-500/30",
              item.badge === 'ALPHA' && "bg-purple-500/10 text-purple-400 border-purple-500/30",
              item.badge === 'NEW' && "bg-green-500/10 text-green-400 border-green-500/30"
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
