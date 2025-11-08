'use client'

import { cn } from '@/lib/utils/cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Package, Truck, CheckCircle, AlertTriangle } from 'lucide-react'

export type ShippingCarrier = 'RoyalMail' | 'DPD' | 'UPS' | 'Evri' | 'Other'
export type ShippingStatus = 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception'

export interface PackageRowProps {
  carrier: ShippingCarrier
  trackingId: string
  status: ShippingStatus
  etaISO?: string
  lastUpdateISO?: string
  onTrack?: () => void
}

const formatDate = (isoString: string): string => {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffHours < 24) {
    return `${diffHours}h ago`
  }

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const getCarrierInfo = (carrier: ShippingCarrier) => {
  switch (carrier) {
    case 'RoyalMail':
      return { name: 'Royal Mail', color: 'text-red-500' }
    case 'DPD':
      return { name: 'DPD', color: 'text-red-600' }
    case 'UPS':
      return { name: 'UPS', color: 'text-amber-600' }
    case 'Evri':
      return { name: 'Evri', color: 'text-pink-500' }
    case 'Other':
      return { name: 'Other', color: 'text-dim' }
  }
}

const getStatusConfig = (status: ShippingStatus) => {
  switch (status) {
    case 'in_transit':
      return {
        label: 'In Transit',
        icon: <Package className="h-3.5 w-3.5" />,
        className: 'bg-accent/10 text-accent border-accent/20',
      }
    case 'out_for_delivery':
      return {
        label: 'Out for Delivery',
        icon: <Truck className="h-3.5 w-3.5" />,
        className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      }
    case 'delivered':
      return {
        label: 'Delivered',
        icon: <CheckCircle className="h-3.5 w-3.5" />,
        className: 'bg-green-500/10 text-green-400 border-green-500/20',
      }
    case 'exception':
      return {
        label: 'Exception',
        icon: <AlertTriangle className="h-3.5 w-3.5" />,
        className: 'bg-red-500/10 text-red-400 border-red-500/20',
      }
  }
}

export function PackageRow({
  carrier,
  trackingId,
  status,
  etaISO,
  lastUpdateISO,
  onTrack,
}: PackageRowProps) {
  const carrierInfo = getCarrierInfo(carrier)
  const statusConfig = getStatusConfig(status)

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3 p-4 bg-elev-1 rounded-xl border border-border transition-all duration-120 hover:bg-elev-2">
      {/* Left: Carrier & Tracking ID */}
      <div className="flex items-center gap-3 md:min-w-[240px]">
        <div className="h-10 w-10 rounded-lg bg-elev-3 flex items-center justify-center shrink-0">
          <Package className={cn('h-5 w-5', carrierInfo.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-dim">{carrierInfo.name}</div>
          <div className="text-sm font-mono font-medium text-fg truncate">
            {trackingId}
          </div>
        </div>
      </div>

      {/* Middle: Status & Details */}
      <div className="flex-1 space-y-2">
        <Badge variant="outline" className={cn('text-xs inline-flex items-center gap-1', statusConfig.className)}>
          {statusConfig.icon}
          {statusConfig.label}
        </Badge>

        <div className="flex flex-col md:flex-row md:items-center gap-2 text-xs text-dim">
          {etaISO && status !== 'delivered' && (
            <div>
              ETA: <span className="text-fg">{formatDate(etaISO)}</span>
            </div>
          )}
          {lastUpdateISO && (
            <>
              {etaISO && status !== 'delivered' && <span className="hidden md:inline">•</span>}
              <div>
                Updated: <span className="text-fg">{formatDate(lastUpdateISO)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: Action */}
      {onTrack && (
        <div className="shrink-0">
          <Button
            onClick={onTrack}
            variant="outline"
            size="sm"
            className="w-full md:w-auto border-border hover:border-accent/60 transition-all duration-120"
          >
            Track
          </Button>
        </div>
      )}
    </div>
  )
}

// Skeleton component
export function PackageRowSkeleton() {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3 p-4 bg-elev-1 rounded-xl border border-border">
      <div className="flex items-center gap-3 md:min-w-[240px]">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-3 w-40" />
      </div>
      <Skeleton className="h-9 w-full md:w-20" />
    </div>
  )
}
