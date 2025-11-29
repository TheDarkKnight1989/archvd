'use client'

import { cn } from '@/lib/utils/cn'

interface AppLogoButtonProps {
  onClick?: () => void
  className?: string
}

export function AppLogoButton({ onClick, className }: AppLogoButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label="Open navigation"
      className={cn(
        "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0",
        "transition-all duration-200",
        "hover:scale-105 active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        className
      )}
      style={{
        background: '#00FF94',
        boxShadow: '0 0 20px rgba(0, 255, 148, 0.4), 0 0 40px rgba(0, 255, 148, 0.2)'
      }}
    >
      <span className="font-cinzel text-xl font-bold text-[#050608]">
        A
      </span>
    </button>
  )
}
