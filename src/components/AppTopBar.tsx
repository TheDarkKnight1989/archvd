'use client'

import { Calculator, Camera, Search } from 'lucide-react'
import { AppLogoButton } from './AppLogoButton'
import { cn } from '@/lib/utils/cn'
import { useState } from 'react'

interface AppTopBarProps {
  onMenuClick?: () => void
}

export function AppTopBar({ onMenuClick }: AppTopBarProps) {
  const [searchQuery, setSearchQuery] = useState('')

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

  return (
    <div
      className="sticky top-0 z-30 border-b border-border/50"
      style={{
        background: 'linear-gradient(135deg, #0E1A15 0%, #0B1510 50%, rgba(0, 255, 148, 0.03) 100%)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <div className="px-4 sm:px-8 py-3">
        {/* Mobile: Two-row layout */}
        <div className="flex flex-col gap-2 sm:hidden">
          {/* Row 1: Logo + Icons */}
          <div className="flex items-center justify-between">
            <AppLogoButton onClick={onMenuClick} />

            <div className="flex items-center gap-2">
              <button
                onClick={handleCalculatorClick}
                aria-label="Open profit calculator"
                className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center",
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
                  "h-9 w-9 rounded-lg flex items-center justify-center",
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

          {/* Row 2: Search Bar */}
          <button
            onClick={handleSearchClick}
            className={cn(
              "w-full h-10 rounded-lg px-3",
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
        </div>

        {/* Desktop: Single-row layout */}
        <div className="hidden sm:flex items-center gap-4">
          {/* Logo */}
          <AppLogoButton onClick={onMenuClick} />

          {/* Search Bar (flex-grow) */}
          <button
            onClick={handleSearchClick}
            className={cn(
              "flex-1 max-w-2xl h-10 rounded-lg px-3",
              "bg-elev-1/50 border border-border/30",
              "flex items-center gap-2",
              "text-muted hover:text-fg hover:bg-elev-2/80",
              "transition-all duration-200",
              "hover:border-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            )}
          >
            <Search className="h-4 w-4 flex-shrink-0" strokeWidth={1.75} />
            <span className="text-sm flex-1">Search products...</span>
            <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border border-border/60 bg-elev-2 px-1.5 font-mono text-[10px] font-medium text-muted">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>

          {/* Icon Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCalculatorClick}
              aria-label="Open profit calculator"
              className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center",
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
                "h-9 w-9 rounded-lg flex items-center justify-center",
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
    </div>
  )
}
