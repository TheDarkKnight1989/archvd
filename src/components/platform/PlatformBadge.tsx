/**
 * PlatformBadge Component
 * Reusable platform badge extracted from SalesTable
 * Used across Sales, Inventory, and Product Market pages
 */

import { cn } from '@/lib/utils/cn'

export type PlatformType = 'stockx' | 'alias' | 'ebay' | 'private' | 'other'

interface PlatformBadgeProps {
  platform: string | null | undefined
  className?: string
}

interface PlatformConfig {
  label: string
  bg: string
  text: string
  border: string
  icon: string
}

const PLATFORM_CONFIGS: Record<PlatformType, PlatformConfig> = {
  stockx: {
    label: 'StockX',
    bg: 'bg-[#00B050]/10',
    text: 'text-[#00B050]',
    border: 'border-[#00B050]/30',
    icon: 'Sx',
  },
  alias: {
    label: 'Alias',
    bg: 'bg-[#A855F7]/10',
    text: 'text-[#A855F7]',
    border: 'border-[#A855F7]/30',
    icon: 'AL',
  },
  ebay: {
    label: 'eBay',
    bg: 'bg-[#E53238]/10',
    text: 'text-[#E53238]',
    border: 'border-[#E53238]/30',
    icon: 'eB',
  },
  private: {
    label: 'Private',
    bg: 'bg-muted/10',
    text: 'text-muted',
    border: 'border-muted/30',
    icon: 'Pv',
  },
  other: {
    label: 'Other',
    bg: 'bg-muted/10',
    text: 'text-muted',
    border: 'border-muted/30',
    icon: 'Ot',
  },
}

function normalizePlatform(platform: string | null | undefined): PlatformType {
  if (!platform) return 'other'
  const platformLower = platform.toLowerCase()

  if (platformLower === 'stockx') return 'stockx'
  if (platformLower === 'alias') return 'alias'
  if (platformLower === 'ebay') return 'ebay'
  if (platformLower === 'private') return 'private'

  return 'other'
}

export function PlatformBadge({ platform, className }: PlatformBadgeProps) {
  const platformType = normalizePlatform(platform)
  const config = PLATFORM_CONFIGS[platformType]

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium mono',
        config.bg,
        config.text,
        config.border,
        className
      )}
    >
      <span className="opacity-70 font-bold">{config.icon}</span>
      <span>{config.label}</span>
    </div>
  )
}
