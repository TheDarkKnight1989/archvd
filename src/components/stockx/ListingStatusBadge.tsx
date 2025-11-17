'use client'

import { cn } from '@/lib/utils/cn'

interface ListingStatusBadgeProps {
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'MATCHED' | 'COMPLETED' | 'DELETED' | 'EXPIRED'
  showIcon?: boolean
  className?: string
}

export function ListingStatusBadge({ status, showIcon = false, className }: ListingStatusBadgeProps) {
  const config = {
    ACTIVE: {
      label: 'Listed on StockX',
      color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      icon: '●',
    },
    PENDING: {
      label: 'StockX: Pending',
      color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      icon: '○',
    },
    INACTIVE: {
      label: 'StockX: Inactive',
      color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
      icon: '◐',
    },
    MATCHED: {
      label: 'StockX: Matched',
      color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      icon: '◆',
    },
    COMPLETED: {
      label: 'StockX: Sold',
      color: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
      icon: '✓',
    },
    EXPIRED: {
      label: 'StockX: Expired',
      color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
      icon: '⏱',
    },
    DELETED: {
      label: 'StockX: Deleted',
      color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
      icon: '✕',
    },
  }

  const { label, color, icon } = config[status]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
        color,
        className
      )}
    >
      {showIcon && <span className="text-[10px]">{icon}</span>}
      {label}
    </span>
  )
}
