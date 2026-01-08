'use client'

import { useState, useMemo } from 'react'
import { useStockxOrders } from '@/hooks/useStockxOrders'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import {
  RefreshCw,
  Download,
  Truck,
  Package,
  CheckCircle,
  Clock,
  Copy,
  ExternalLink,
  AlertCircle,
  Zap,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'
import type { Order, OrderTab } from '@/lib/services/stockx/orders'

const formatCurrency = (amount: string | number, currency: string) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'GBP',
  }).format(num)
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const formatRelativeTime = (dateStr: string) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { text: `${Math.abs(diffDays)}d overdue`, isUrgent: true }
  } else if (diffDays === 0) {
    return { text: 'Today', isUrgent: true }
  } else if (diffDays === 1) {
    return { text: 'Tomorrow', isUrgent: true }
  } else if (diffDays <= 3) {
    return { text: `${diffDays} days`, isUrgent: true }
  }
  return { text: `${diffDays} days`, isUrgent: false }
}

// Status badge component
function OrderStatusBadge({ status }: { status: Order['status'] }) {
  const config: Record<string, { label: string; className: string }> = {
    // Needs shipping
    CREATED: { label: 'Created', className: 'bg-amber-500/20 text-amber-400 border-amber-500/50' },
    PENDING: { label: 'Pending', className: 'bg-amber-500/20 text-amber-400 border-amber-500/50' },
    CCAUTHORIZATIONFAILED: { label: 'Payment Issue', className: 'bg-red-500/20 text-red-400 border-red-500/50' },
    // In progress
    SHIPPED: { label: 'Shipped', className: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
    RECEIVED: { label: 'Received', className: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
    AUTHENTICATING: { label: 'Authenticating', className: 'bg-purple-500/20 text-purple-400 border-purple-500/50' },
    AUTHENTICATED: { label: 'Authenticated', className: 'bg-purple-500/20 text-purple-400 border-purple-500/50' },
    PAYOUTPENDING: { label: 'Payout Pending', className: 'bg-purple-500/20 text-purple-400 border-purple-500/50' },
    // Completed
    PAYOUTCOMPLETED: { label: 'Paid Out', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' },
    SYSTEMFULFILLED: { label: 'Fulfilled', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' },
    COMPLETED: { label: 'Completed', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' },
    DELIVERED: { label: 'Delivered', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' },
    // Failed
    CANCELLED: { label: 'Cancelled', className: 'bg-red-500/20 text-red-400 border-red-500/50' },
    PAYOUTFAILED: { label: 'Payout Failed', className: 'bg-red-500/20 text-red-400 border-red-500/50' },
    SUSPENDED: { label: 'Suspended', className: 'bg-red-500/20 text-red-400 border-red-500/50' },
  }

  const { label, className } = config[status] || { label: status, className: 'bg-muted/20 text-muted border-muted/50' }

  return (
    <Badge variant="outline" className={cn('text-xs font-medium', className)}>
      {label}
    </Badge>
  )
}

// Tab component
function OrderTabs({
  activeTab,
  onTabChange,
  counts,
}: {
  activeTab: OrderTab
  onTabChange: (tab: OrderTab) => void
  counts: { needs_shipping: number; in_progress: number; completed: number }
}) {
  const tabs = [
    { id: 'needs_shipping' as OrderTab, label: 'Needs Shipping', icon: Package, count: counts.needs_shipping },
    { id: 'in_progress' as OrderTab, label: 'In Progress', icon: Truck, count: counts.in_progress },
    { id: 'completed' as OrderTab, label: 'Completed', icon: CheckCircle, count: counts.completed },
  ]

  return (
    <div className="flex gap-1 p-1 rounded-lg bg-elev-1 border border-border/50">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
              isActive
                ? 'bg-accent text-accent-foreground shadow-sm'
                : 'text-muted hover:text-fg hover:bg-elev-2'
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span
                className={cn(
                  'text-xs px-1.5 py-0.5 rounded-full',
                  isActive
                    ? 'bg-accent-foreground/20 text-accent-foreground'
                    : 'bg-muted/30 text-muted'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// Order row actions
function OrderActions({
  order,
  onDownloadLabel,
  onCopyOrderId,
}: {
  order: Order
  onDownloadLabel: () => void
  onCopyOrderId: () => void
}) {
  const canDownloadLabel = order.status === 'CREATED' || order.status === 'PENDING'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canDownloadLabel && (
          <DropdownMenuItem onClick={onDownloadLabel}>
            <Download className="mr-2 h-4 w-4" />
            Download Label
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onCopyOrderId}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Order ID
        </DropdownMenuItem>
        {order.shipment?.trackingNumber && (
          <DropdownMenuItem
            onClick={() => {
              navigator.clipboard.writeText(order.shipment!.trackingNumber!)
            }}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy Tracking #
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <a
            href={`https://stockx.com/selling/orders/${order.orderNumber}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            View on StockX
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Desktop table row
function OrderRow({
  order,
  onDownloadLabel,
}: {
  order: Order
  onDownloadLabel: (orderNumber: string) => void
}) {
  const handleCopyOrderId = () => {
    navigator.clipboard.writeText(order.orderNumber)
  }

  const shipByInfo = order.shipment?.shipByDate ? formatRelativeTime(order.shipment.shipByDate) : null
  const styleId = order.product?.styleId || ''

  return (
    <tr className="hover:bg-muted/50 border-b border-border/50">
      {/* Product */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">
              {order.product?.productName || styleId}
            </p>
            <p className="text-xs text-muted truncate">{styleId}</p>
          </div>
        </div>
      </td>

      {/* Size */}
      <td className="px-4 py-3 text-sm">{order.variant?.variantValue || order.variant?.variantName}</td>

      {/* Sale Price */}
      <td className="px-4 py-3 text-right">
        <div className="text-sm font-medium">
          {formatCurrency(order.amount, order.currencyCode || 'USD')}
        </div>
      </td>

      {/* Payout */}
      <td className="px-4 py-3 text-right">
        {order.payout ? (
          <>
            <div className="text-sm text-emerald-500 font-medium">
              {formatCurrency(order.payout.totalPayout, order.payout.currencyCode)}
            </div>
            {order.payout.adjustments?.length > 0 && (
              <div className="text-xs text-muted">
                {order.payout.totalAdjustments !== '0' && (
                  <>{formatCurrency(order.payout.totalAdjustments, order.payout.currencyCode)} fees</>
                )}
              </div>
            )}
          </>
        ) : (
          <span className="text-sm text-muted">—</span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <OrderStatusBadge status={order.status} />
      </td>

      {/* Ship By */}
      <td className="px-4 py-3 text-sm">
        {shipByInfo ? (
          <span className={cn(shipByInfo.isUrgent && 'text-amber-400 font-medium')}>
            {shipByInfo.text}
          </span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>

      {/* Created */}
      <td className="px-4 py-3 text-sm text-muted">
        {order.createdAt ? formatDate(order.createdAt) : '—'}
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <OrderActions
          order={order}
          onDownloadLabel={() => onDownloadLabel(order.orderNumber)}
          onCopyOrderId={handleCopyOrderId}
        />
      </td>
    </tr>
  )
}

// Mobile card
function OrderCard({
  order,
  onDownloadLabel,
}: {
  order: Order
  onDownloadLabel: (orderNumber: string) => void
}) {
  const handleCopyOrderId = () => {
    navigator.clipboard.writeText(order.orderNumber)
  }

  const shipByInfo = order.shipment?.shipByDate ? formatRelativeTime(order.shipment.shipByDate) : null
  const canDownloadLabel = order.status === 'CREATED' || order.status === 'PENDING'
  const styleId = order.product?.styleId || ''

  return (
    <div className="bg-elev-1 rounded-xl border border-border/50 p-4">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm line-clamp-2 mb-1">
            {order.product?.productName || styleId}
          </h3>
          <p className="text-xs text-muted">{styleId}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted">Size: {order.variant?.variantValue || order.variant?.variantName}</span>
            <OrderStatusBadge status={order.status} />
          </div>
        </div>
      </div>

      {/* Financial Info */}
      <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b border-border/30">
        <div>
          <div className="text-[11px] text-muted mb-0.5">Sale Price</div>
          <div className="text-sm font-medium">
            {formatCurrency(order.amount, order.currencyCode || 'USD')}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-muted mb-0.5">Your Payout</div>
          <div className="text-sm font-medium text-emerald-500">
            {order.payout
              ? formatCurrency(order.payout.totalPayout, order.payout.currencyCode)
              : '—'}
          </div>
        </div>
      </div>

      {/* Ship By Warning */}
      {shipByInfo && shipByInfo.isUrgent && (
        <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <Clock className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <span className="text-xs text-amber-400 font-medium">
            Ship by: {shipByInfo.text}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {canDownloadLabel && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onDownloadLabel(order.orderNumber)}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Download Label
          </Button>
        )}
        <OrderActions
          order={order}
          onDownloadLabel={() => onDownloadLabel(order.orderNumber)}
          onCopyOrderId={handleCopyOrderId}
        />
      </div>
    </div>
  )
}

// Empty state
function EmptyState({ tab }: { tab: OrderTab }) {
  const config = {
    needs_shipping: {
      icon: Package,
      title: 'No orders to ship',
      description: 'When a buyer purchases your listing, it will appear here.',
    },
    in_progress: {
      icon: Truck,
      title: 'No orders in transit',
      description: 'Orders you\'ve shipped will appear here until delivered.',
    },
    completed: {
      icon: CheckCircle,
      title: 'No completed orders',
      description: 'Your delivered orders will appear here.',
    },
  }

  const { icon: Icon, title, description } = config[tab]

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-16 w-16 rounded-full bg-elev-2 flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-muted" />
      </div>
      <h3 className="text-lg font-medium mb-1">{title}</h3>
      <p className="text-sm text-muted max-w-sm">{description}</p>
    </div>
  )
}

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<OrderTab>('needs_shipping')
  const [autoSelling, setAutoSelling] = useState(false)
  const [autoSellResult, setAutoSellResult] = useState<{
    auto_sold: number
    needs_match: number
  } | null>(null)
  const {
    orders,
    loading,
    error,
    errorCode,
    syncing,
    lastSyncedAt,
    counts,
    refetch,
    syncOrders,
    downloadLabel,
    autoMarkSold,
  } = useStockxOrders({ tab: activeTab })

  const handleDownloadLabel = async (orderId: string) => {
    try {
      await downloadLabel(orderId)
    } catch (err) {
      console.error('Failed to download label:', err)
      // TODO: Show toast error
    }
  }

  const handleSync = async () => {
    try {
      await syncOrders()
    } catch (err) {
      console.error('Failed to sync orders:', err)
      // TODO: Show toast error
    }
  }

  const handleAutoSell = async () => {
    setAutoSelling(true)
    setAutoSellResult(null)
    try {
      const result = await autoMarkSold()
      setAutoSellResult({
        auto_sold: result.auto_sold,
        needs_match: result.needs_match,
      })
    } catch (err) {
      console.error('Failed to auto mark sold:', err)
      // TODO: Show toast error
    } finally {
      setAutoSelling(false)
    }
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">StockX Orders</h1>
          <p className="text-sm text-muted">
            Manage your StockX orders and shipping labels
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastSyncedAt && (
            <span className="text-xs text-muted hidden sm:inline">
              Last synced: {formatDate(lastSyncedAt)}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw className={cn('h-4 w-4 mr-1.5', syncing && 'animate-spin')} />
            {syncing ? 'Syncing...' : 'Sync'}
          </Button>
          {counts.completed > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={handleAutoSell}
              disabled={autoSelling}
            >
              <Zap className={cn('h-4 w-4 mr-1.5', autoSelling && 'animate-pulse')} />
              {autoSelling ? 'Processing...' : 'Auto Mark Sold'}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <OrderTabs activeTab={activeTab} onTabChange={setActiveTab} counts={counts} />
      </div>

      {/* Auto-Sell Result */}
      {autoSellResult && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-emerald-400">
              {autoSellResult.auto_sold > 0 ? (
                <>
                  <span className="font-medium">{autoSellResult.auto_sold}</span> item{autoSellResult.auto_sold !== 1 ? 's' : ''} automatically marked as sold.
                </>
              ) : (
                'No items to auto-sell.'
              )}
              {autoSellResult.needs_match > 0 && (
                <span className="text-amber-400 ml-2">
                  ({autoSellResult.needs_match} need{autoSellResult.needs_match !== 1 ? '' : 's'} manual matching)
                </span>
              )}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setAutoSellResult(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Not Connected State */}
      {errorCode === 'not_connected' && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-elev-2 flex items-center justify-center mb-4">
            <ExternalLink className="h-8 w-8 text-muted" />
          </div>
          <h3 className="text-lg font-medium mb-1">Connect Your StockX Account</h3>
          <p className="text-sm text-muted max-w-sm mb-4">
            Link your StockX account to sync orders and manage shipping labels.
          </p>
          <Button asChild>
            <a href="/portfolio/settings/integrations">Connect StockX</a>
          </Button>
        </div>
      )}

      {/* Mock Mode State */}
      {errorCode === 'mock_mode' && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-amber-400" />
          </div>
          <h3 className="text-lg font-medium mb-1">StockX API in Mock Mode</h3>
          <p className="text-sm text-muted max-w-sm mb-4">
            The StockX integration is currently running in mock mode.
            Configure API credentials to enable live orders.
          </p>
          <Button variant="outline" asChild>
            <a href="/portfolio/settings/integrations">View Settings</a>
          </Button>
        </div>
      )}

      {/* Generic API Error State */}
      {error && errorCode === 'api_error' && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-400">{error}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={refetch}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 text-muted animate-spin" />
        </div>
      )}

      {/* Content */}
      {!loading && !errorCode && (
        <>
          {orders.length === 0 ? (
            <EmptyState tab={activeTab} />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="rounded-lg border bg-card hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium">Product</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Size</th>
                        <th className="px-4 py-3 text-right text-sm font-medium">Sale</th>
                        <th className="px-4 py-3 text-right text-sm font-medium">Payout</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Ship By</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Created</th>
                        <th className="px-4 py-3 text-right text-sm font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <OrderRow
                          key={order.orderNumber}
                          order={order}
                          onDownloadLabel={handleDownloadLabel}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Cards */}
              <div className="space-y-3 md:hidden">
                {orders.map((order) => (
                  <OrderCard
                    key={order.orderNumber}
                    order={order}
                    onDownloadLabel={handleDownloadLabel}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
