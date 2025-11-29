'use client'

import { Calculator, Camera, Search, Bell } from 'lucide-react'
import { AppLogoButton } from './AppLogoButton'
import { UserProfileMenu } from './UserProfileMenu'
import { cn } from '@/lib/utils/cn'

interface AppTopBarProps {
  onMenuClick?: () => void
}

export function AppTopBar({ onMenuClick }: AppTopBarProps) {
  const handleSearchClick = () => {
    // TODO: Wire up to existing command palette / product search
    console.log('TODO: open product search')
  }

  const handleCalculatorClick = () => {
    // TODO: Wire up profit calculator
    console.log('TODO: open profit calculator')
  }

  const handleCameraClick = () => {
    // TODO: Wire up barcode scanner
    console.log('TODO: open barcode scanner')
  }

  const handleNotificationsClick = () => {
    // TODO: Wire up notifications system
    console.log('TODO: open notifications')
  }

  return (
    <>
      {/* Mobile: Single-row header with logo, search, and utility icons */}
      <div
        className="block md:hidden sticky top-0 z-30 border-b border-border/50"
        style={{
          background: 'linear-gradient(135deg, #0E1A15 0%, #0B1510 50%, rgba(0, 255, 148, 0.03) 100%)',
          backdropFilter: 'blur(8px)'
        }}
      >
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Logo Button */}
            <AppLogoButton onClick={onMenuClick} />

            {/* Search Bar */}
            <button
              onClick={handleSearchClick}
              className={cn(
                "flex-1 h-10 rounded-lg px-3",
                "bg-elev-1/50 border border-border/30",
                "flex items-center gap-2",
                "text-muted hover:text-fg hover:bg-elev-2/80",
                "transition-all duration-200",
                "hover:border-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              )}
            >
              <Search className="h-4 w-4 flex-shrink-0" strokeWidth={1.75} />
              <span className="text-sm">Search products...</span>
            </button>

            {/* Utility Icons */}
            <button
              onClick={handleCalculatorClick}
              aria-label="Open profit calculator"
              className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                "bg-elev-1/50 border border-border/30",
                "text-muted hover:text-fg hover:bg-elev-2/80",
                "transition-all duration-200",
                "hover:shadow-[0_0_12px_rgba(0,255,148,0.2)]",
                "active:scale-95"
              )}
            >
              <Calculator className="h-5 w-5" strokeWidth={1.75} />
            </button>

            <button
              onClick={handleCameraClick}
              aria-label="Open barcode scanner"
              className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                "bg-elev-1/50 border border-border/30",
                "text-muted hover:text-fg hover:bg-elev-2/80",
                "transition-all duration-200",
                "hover:shadow-[0_0_12px_rgba(0,255,148,0.2)]",
                "active:scale-95"
              )}
            >
              <Camera className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop: Slim utility strip */}
      <div className="hidden md:block sticky top-0 z-30 bg-elev-1/95 border-b border-white/5">
        <div className="h-12 flex items-center justify-between gap-4">
          {/* Left Side: Search + Utility Icons (constrained width) */}
          <div className="flex items-center gap-3 px-4 lg:px-8">
            {/* Search Bar */}
            <button
              onClick={handleSearchClick}
              className={cn(
                "w-[400px] h-9 rounded-lg px-3",
                "bg-elev-1/50 border border-white/10",
                "flex items-center gap-2",
                "text-muted hover:text-fg hover:bg-white/5 hover:border-white/20",
                "transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              )}
            >
              <Search className="h-4 w-4 flex-shrink-0" strokeWidth={1.75} />
              <span className="text-sm flex-1">Search products...</span>
              <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border border-border/60 bg-elev-2 px-1.5 font-mono text-[10px] font-medium text-muted">
                <span className="text-xs">⌘</span>K
              </kbd>
            </button>

            {/* Utility Icons */}
            <button
              onClick={handleCalculatorClick}
              aria-label="Open profit calculator"
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full",
                "border border-white/10 text-muted",
                "hover:border-white/20 hover:bg-white/5 hover:text-fg",
                "transition-all duration-200",
                "active:scale-95"
              )}
            >
              <Calculator className="h-4 w-4" strokeWidth={1.75} />
            </button>

            <button
              onClick={handleCameraClick}
              aria-label="Open barcode scanner"
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full",
                "border border-white/10 text-muted",
                "hover:border-white/20 hover:bg-white/5 hover:text-fg",
                "transition-all duration-200",
                "active:scale-95"
              )}
            >
              <Camera className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>

          {/* Right Side: Notifications + Profile (at edge of screen) */}
          <div className="flex items-center gap-2 pr-4 lg:pr-8">
            {/* Notifications */}
            <button
              onClick={handleNotificationsClick}
              aria-label="Notifications"
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full",
                "border border-white/10 text-muted",
                "hover:border-white/20 hover:bg-white/5 hover:text-fg",
                "transition-all duration-200",
                "active:scale-95"
              )}
            >
              <Bell className="h-4 w-4" strokeWidth={1.75} />
            </button>

            {/* User Profile */}
            <UserProfileMenu />
          </div>
        </div>
      </div>
    </>
  )
}
