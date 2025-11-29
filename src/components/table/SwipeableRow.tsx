/**
 * Swipeable Row Component
 * Mobile-optimized row with swipe-to-reveal actions
 */

'use client'

import { useState, useRef, TouchEvent, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { Copy, Eye, Trash2 } from 'lucide-react'

export interface SwipeAction {
  id: string
  label: string
  icon: ReactNode
  color: 'green' | 'blue' | 'red' | 'gray'
  onAction: () => void
}

interface SwipeableRowProps {
  children: ReactNode
  actions?: SwipeAction[]
  className?: string
}

const colorClasses = {
  green: 'bg-[#00FF94] text-black',
  blue: 'bg-blue-500 text-white',
  red: 'bg-red-500 text-white',
  gray: 'bg-gray-500 text-white',
}

export function SwipeableRow({
  children,
  actions = [],
  className,
}: SwipeableRowProps) {
  const [translateX, setTranslateX] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const startX = useRef(0)
  const currentX = useRef(0)

  // Only enable on mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  if (!isMobile || actions.length === 0) {
    return <div className={className}>{children}</div>
  }

  const handleTouchStart = (e: TouchEvent) => {
    startX.current = e.touches[0].clientX
    setIsSwiping(true)
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isSwiping) return

    currentX.current = e.touches[0].clientX
    const diff = currentX.current - startX.current

    // Only allow left swipe (reveal actions on right)
    if (diff < 0) {
      const maxSwipe = Math.min(actions.length * 80, 240) // Max 3 actions visible
      setTranslateX(Math.max(diff, -maxSwipe))
    } else {
      setTranslateX(0)
    }
  }

  const handleTouchEnd = () => {
    setIsSwiping(false)

    // Snap to actions or reset
    if (translateX < -40) {
      const snapTo = Math.min(actions.length * 80, 240)
      setTranslateX(-snapTo)
    } else {
      setTranslateX(0)
    }
  }

  const handleActionClick = (action: SwipeAction) => {
    action.onAction()
    setTranslateX(0) // Close after action
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Action buttons (revealed on swipe) */}
      <div className="absolute right-0 top-0 bottom-0 flex">
        {actions.slice(0, 3).map((action) => (
          <button
            key={action.id}
            onClick={() => handleActionClick(action)}
            className={cn(
              'w-20 flex flex-col items-center justify-center gap-1 text-xs font-semibold',
              colorClasses[action.color]
            )}
            aria-label={action.label}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {/* Main content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
        }}
        className="bg-elev-0"
      >
        {children}
      </div>
    </div>
  )
}
