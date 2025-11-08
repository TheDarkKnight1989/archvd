'use client'

import { cn } from '@/lib/utils/cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Link2, AlertCircle, CheckCircle2 } from 'lucide-react'

export type IntegrationProvider = 'stockx' | 'goat' | 'ebay'
export type IntegrationStatus = 'connected' | 'disconnected' | 'error'

export interface IntegrationCardProps {
  provider: IntegrationProvider
  status: IntegrationStatus
  accountLabel?: string
  onConnect?: () => void
  onDisconnect?: () => void
  onFix?: () => void
}

const getProviderInfo = (provider: IntegrationProvider) => {
  switch (provider) {
    case 'stockx':
      return {
        name: 'StockX',
        description: 'Sync pricing and sales data from StockX',
      }
    case 'goat':
      return {
        name: 'GOAT',
        description: 'Import inventory and market prices',
      }
    case 'ebay':
      return {
        name: 'eBay',
        description: 'Connect your eBay seller account',
      }
  }
}

const getStatusConfig = (status: IntegrationStatus) => {
  switch (status) {
    case 'connected':
      return {
        label: 'Connected',
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        className: 'bg-green-500/10 text-green-400 border-green-500/20',
      }
    case 'disconnected':
      return {
        label: 'Not Connected',
        icon: <Link2 className="h-3.5 w-3.5" />,
        className: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      }
    case 'error':
      return {
        label: 'Error',
        icon: <AlertCircle className="h-3.5 w-3.5" />,
        className: 'bg-red-500/10 text-red-400 border-red-500/20',
      }
  }
}

export function IntegrationCard({
  provider,
  status,
  accountLabel,
  onConnect,
  onDisconnect,
  onFix,
}: IntegrationCardProps) {
  const providerInfo = getProviderInfo(provider)
  const statusConfig = getStatusConfig(status)

  const handleAction = () => {
    if (status === 'error' && onFix) {
      onFix()
    } else if (status === 'connected' && onDisconnect) {
      onDisconnect()
    } else if (status === 'disconnected' && onConnect) {
      onConnect()
    }
  }

  const actionLabel =
    status === 'error' ? 'Fix' : status === 'connected' ? 'Disconnect' : 'Connect'

  const actionVariant = status === 'connected' ? 'outline' : 'default'

  return (
    <div className="bg-elev-2 gradient-elev rounded-2xl border border-border p-5 space-y-4 transition-all duration-120 hover:border-accent/40">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-elev-3 flex items-center justify-center">
              <Link2 className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-fg">
                {providerInfo.name}
              </h3>
              {accountLabel && status === 'connected' && (
                <p className="text-xs text-dim font-mono">{accountLabel}</p>
              )}
            </div>
          </div>

          <p className="text-sm text-dim">{providerInfo.description}</p>
        </div>

        <Badge
          variant="outline"
          className={cn('text-xs inline-flex items-center gap-1', statusConfig.className)}
        >
          {statusConfig.icon}
          {statusConfig.label}
        </Badge>
      </div>

      {/* Action */}
      <div className="pt-2 border-t border-border/40">
        {status === 'error' && (
          <p className="text-sm text-red-400 mb-3">
            Connection error. Please check your credentials and try again.
          </p>
        )}

        <Button
          onClick={handleAction}
          variant={actionVariant}
          className={cn(
            'w-full transition-all duration-120',
            actionVariant === 'default' &&
              'bg-accent text-black hover:bg-accent-600 glow-accent-hover',
            actionVariant === 'outline' && 'border-border hover:border-accent/60'
          )}
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  )
}

// Skeleton component
export function IntegrationCardSkeleton() {
  return (
    <div className="bg-elev-2 rounded-2xl border border-border p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
        </div>
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="pt-2 border-t border-border/40">
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}
