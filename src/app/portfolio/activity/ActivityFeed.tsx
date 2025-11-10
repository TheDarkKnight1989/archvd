'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import {
  Package,
  ShoppingCart,
  TrendingUp,
  FileDown,
  FileUp,
  CreditCard,
  Bell,
  Zap,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'

interface AuditEvent {
  id: string
  user_id: string
  event_type: string
  entity_type: string | null
  entity_id: string | null
  title: string
  description: string | null
  metadata: Record<string, any>
  created_at: string
}

interface ActivityFeedProps {
  initialEvents: AuditEvent[]
}

const EVENT_TYPE_GROUPS = {
  item: ['item.created', 'item.updated', 'item.sold', 'item.deleted'],
  batch: ['items.imported', 'items.exported'],
  expense: ['expense.created', 'expense.updated', 'expense.deleted'],
  subscription: [
    'subscription.created',
    'subscription.updated',
    'subscription.activated',
    'subscription.deactivated',
    'subscription.deleted',
  ],
  package: ['package.created', 'package.updated', 'package.deleted'],
  integration: ['integration.connected', 'integration.disconnected'],
  pricing: ['pricing.refresh'],
}

const getEventIcon = (eventType: string): LucideIcon => {
  if (eventType.startsWith('item.')) {
    if (eventType === 'item.sold') return TrendingUp
    return Package
  }
  if (eventType === 'items.imported') return FileDown
  if (eventType === 'items.exported') return FileUp
  if (eventType.startsWith('expense.')) return CreditCard
  if (eventType.startsWith('subscription.')) return Bell
  if (eventType.startsWith('package.')) return Package
  if (eventType.startsWith('integration.')) return Zap
  if (eventType.startsWith('pricing.')) return RefreshCw
  return ShoppingCart
}

const getEventColor = (eventType: string): string => {
  if (eventType === 'item.sold') return 'text-success'
  if (eventType === 'item.created' || eventType === 'items.imported') return 'text-accent'
  if (eventType.includes('deleted')) return 'text-danger'
  if (eventType.includes('activated') || eventType.includes('connected')) return 'text-success'
  if (eventType.includes('deactivated') || eventType.includes('disconnected')) return 'text-muted'
  return 'text-fg'
}

const formatRelativeTime = (isoString: string): string => {
  const now = new Date()
  const then = new Date(isoString)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  return then.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function ActivityFeed({ initialEvents }: ActivityFeedProps) {
  const [selectedType, setSelectedType] = useState<string>('all')

  const filteredEvents = useMemo(() => {
    if (selectedType === 'all') return initialEvents

    const typesInGroup = Object.entries(EVENT_TYPE_GROUPS).find(
      ([key]) => key === selectedType
    )?.[1]

    if (!typesInGroup) return initialEvents

    return initialEvents.filter((event) => typesInGroup.includes(event.event_type))
  }, [initialEvents, selectedType])

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedType('all')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-boutique',
            'border border-border bg-elev-1 hover:bg-elev-2 shadow-soft',
            selectedType === 'all' && 'bg-accent-200 text-fg border-accent/50'
          )}
        >
          All
        </button>
        {Object.keys(EVENT_TYPE_GROUPS).map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-boutique',
              'border border-border bg-elev-1 hover:bg-elev-2 shadow-soft',
              selectedType === type && 'bg-accent-200 text-fg border-accent/50'
            )}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Events List */}
      <div className="space-y-2">
        {filteredEvents.length === 0 && (
          <div className="text-center py-12 text-muted">
            <p>No activity to show</p>
          </div>
        )}

        {filteredEvents.map((event) => {
          const Icon = getEventIcon(event.event_type)
          const color = getEventColor(event.event_type)

          return (
            <div
              key={event.id}
              className="bg-elev-1 border border-border rounded-lg p-4 hover:bg-elev-2 transition-boutique"
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={cn('mt-1', color)}>
                  <Icon className="h-5 w-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-fg">{event.title}</h3>
                      {event.description && (
                        <p className="text-sm text-muted mt-0.5">{event.description}</p>
                      )}
                    </div>
                    <time className="text-xs text-dim font-mono whitespace-nowrap">
                      {formatRelativeTime(event.created_at)}
                    </time>
                  </div>

                  {/* Entity Link */}
                  {event.entity_type && event.entity_id && (
                    <Link
                      href={`/portfolio/${event.entity_type === 'inventory' ? 'inventory' : event.entity_type}#${event.entity_id}`}
                      className="text-xs text-accent hover:underline mt-2 inline-block"
                    >
                      View {event.entity_type} →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
