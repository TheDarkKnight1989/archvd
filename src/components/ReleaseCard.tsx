'use client'

import { cn } from '@/lib/utils/cn'
import { gbp2 } from '@/lib/utils/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Bell, Bookmark } from 'lucide-react'

export interface ReleaseCardProps {
  imageUrl: string
  name: string
  brand: string
  colorway?: string
  releaseDateISO: string
  retailers: { name: string; logoUrl?: string; href?: string }[]
  priceGBP?: number
  sku?: string
  remindable?: boolean
  onRemind?: () => void
  onSave?: () => void
}

const formatReleaseDate = (isoString: string): string => {
  const date = new Date(isoString)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function ReleaseCard({
  imageUrl,
  name,
  brand,
  colorway,
  releaseDateISO,
  retailers,
  priceGBP,
  sku,
  remindable = true,
  onRemind,
  onSave,
}: ReleaseCardProps) {
  const releaseDate = formatReleaseDate(releaseDateISO)

  return (
    <div className="bg-elev-2 gradient-elev rounded-2xl border border-border overflow-hidden transition-all duration-120 hover:border-accent/40 group">
      {/* Image - 16:9 ratio */}
      <div className="relative aspect-video bg-elev-3 overflow-hidden">
        <img
          src={imageUrl}
          alt={`${brand} ${name}`}
          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
        {sku && (
          <div className="absolute top-2 right-2">
            <Badge
              className="bg-black/60 text-white border-none backdrop-blur-sm text-xs font-mono"
            >
              {sku}
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Brand & Name */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-accent uppercase tracking-wide">
            {brand}
          </div>
          <h3 className="text-base font-semibold text-fg leading-tight">
            {name}
          </h3>
          {colorway && (
            <p className="text-sm text-dim truncate">{colorway}</p>
          )}
        </div>

        {/* Release Date & Price */}
        <div className="flex items-baseline justify-between">
          <div className="text-sm text-fg font-medium">{releaseDate}</div>
          {priceGBP !== undefined && (
            <div className="text-sm font-mono font-medium text-fg">
              {gbp2.format(priceGBP)}
            </div>
          )}
        </div>

        {/* Retailers */}
        <div className="space-y-2">
          <div className="text-xs text-dim uppercase tracking-wide">
            Retailers
          </div>
          {retailers.length === 0 ? (
            <div className="text-sm text-dim italic">Retailers TBA</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {retailers.map((retailer, idx) => (
                <a
                  key={idx}
                  href={retailer.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-elev-1 border border-border text-xs transition-all duration-120',
                    retailer.href &&
                      'hover:bg-elev-3 hover:border-accent/40 cursor-pointer'
                  )}
                  aria-label={`${retailer.name} retailer`}
                >
                  {retailer.logoUrl ? (
                    <img
                      src={retailer.logoUrl}
                      alt={retailer.name}
                      className="h-3 w-auto"
                    />
                  ) : (
                    <span className="text-fg font-medium">{retailer.name}</span>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {remindable && onRemind && (
            <Button
              onClick={onRemind}
              className="flex-1 bg-accent text-black hover:bg-accent-600 glow-accent-hover transition-all duration-120"
              size="sm"
            >
              <Bell className="h-4 w-4 mr-1.5" />
              Remind
            </Button>
          )}
          {onSave && (
            <Button
              onClick={onSave}
              variant="outline"
              className="border-border hover:border-accent/60 transition-all duration-120"
              size="sm"
            >
              <Bookmark className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// Skeleton component
export function ReleaseCardSkeleton() {
  return (
    <div className="bg-elev-2 rounded-2xl border border-border overflow-hidden">
      <Skeleton className="aspect-video" />
      <div className="p-4 space-y-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-20" />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>
    </div>
  )
}
