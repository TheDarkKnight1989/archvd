'use client'

import { cn } from '@/lib/utils/cn'
import { gbp2 } from '@/lib/utils/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CreditCard, Users } from 'lucide-react'

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trial'
export type BillingInterval = 'mo' | 'yr'

export interface SubscriptionRowProps {
  planName: string
  priceGBP: number
  interval: BillingInterval
  status: SubscriptionStatus
  renewalDateISO?: string
  seats?: number
  onManage?: () => void
  onUpgrade?: () => void
}

const formatRenewalDate = (isoString: string): string => {
  const date = new Date(isoString)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const getStatusConfig = (status: SubscriptionStatus) => {
  switch (status) {
    case 'active':
      return {
        label: 'Active',
        variant: 'default' as const,
        className: 'bg-green-500/10 text-green-400 border-green-500/20',
      }
    case 'past_due':
      return {
        label: 'Past Due',
        variant: 'destructive' as const,
        className: 'bg-red-500/10 text-red-400 border-red-500/20',
      }
    case 'canceled':
      return {
        label: 'Canceled',
        variant: 'secondary' as const,
        className: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      }
    case 'trial':
      return {
        label: 'Trial',
        variant: 'outline' as const,
        className: 'bg-accent/10 text-accent border-accent/20',
      }
  }
}

export function SubscriptionRow({
  planName,
  priceGBP,
  interval,
  status,
  renewalDateISO,
  seats,
  onManage,
  onUpgrade,
}: SubscriptionRowProps) {
  const statusConfig = getStatusConfig(status)
  const intervalLabel = interval === 'mo' ? 'month' : 'year'

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-elev-1 rounded-xl border border-border transition-all duration-120 hover:bg-elev-2">
      {/* Left: Plan Badge & Status */}
      <div className="flex items-center gap-3 md:min-w-[240px]">
        <div className="h-10 w-10 rounded-lg bg-elev-3 flex items-center justify-center shrink-0">
          <CreditCard className="h-5 w-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-fg">{planName}</div>
          <Badge variant="outline" className={cn('text-xs mt-1', statusConfig.className)}>
            {statusConfig.label}
          </Badge>
        </div>
      </div>

      {/* Middle: Details */}
      <div className="flex-1 space-y-1 text-sm">
        {renewalDateISO && status !== 'canceled' && (
          <div className="text-dim">
            {status === 'trial' ? 'Trial ends' : 'Renews'}{' '}
            <span className="text-fg font-medium">
              {formatRenewalDate(renewalDateISO)}
            </span>
          </div>
        )}
        {seats && (
          <div className="flex items-center gap-1.5 text-dim">
            <Users className="h-3.5 w-3.5" />
            <span>
              {seats} {seats === 1 ? 'seat' : 'seats'}
            </span>
          </div>
        )}
      </div>

      {/* Right: Price & Actions */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        <div className="text-right">
          <div className="text-lg font-mono font-bold text-fg">
            {gbp2.format(priceGBP)}
          </div>
          <div className="text-xs text-dim">per {intervalLabel}</div>
        </div>

        <div className="flex gap-2">
          {onManage && (
            <Button
              onClick={onManage}
              variant="outline"
              size="sm"
              className="border-border hover:border-accent/60 transition-all duration-120"
            >
              Manage
            </Button>
          )}
          {onUpgrade && (
            <Button
              onClick={onUpgrade}
              size="sm"
              className="bg-accent text-black hover:bg-accent-600 glow-accent-hover transition-all duration-120"
            >
              Upgrade
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// Skeleton component
export function SubscriptionRowSkeleton() {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-elev-1 rounded-xl border border-border">
      <div className="flex items-center gap-3 md:min-w-[240px]">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-16" />
        </div>
      </div>
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="text-right space-y-1">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
    </div>
  )
}
