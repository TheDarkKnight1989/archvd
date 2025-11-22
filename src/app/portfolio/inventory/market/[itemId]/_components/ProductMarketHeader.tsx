'use client'

/**
 * ProductMarketHeader - Header section with product overview
 *
 * Displays:
 * - Product image
 * - Brand, model, colorway
 * - SKU
 * - Size (user's system)
 * - Condition badge
 * - Quick actions (Edit, Delete, etc.)
 */

import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Package, Edit, Trash2, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ProductMarketHeaderProps {
  item: any
}

export function ProductMarketHeader({ item }: ProductMarketHeaderProps) {
  const imageUrl = item.image_url || '/placeholder-sneaker.png'
  const condition = item.condition || 'New'
  const conditionColors = {
    New: 'bg-green-500/10 text-green-500 border-green-500/30',
    Used: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
    Worn: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
    Defect: 'bg-red-500/10 text-red-500 border-red-500/30',
  }

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-start gap-6">
        {/* Product Image */}
        <div className="relative h-32 w-32 rounded-lg bg-soft border border-border flex-shrink-0 overflow-hidden">
          {item.image_url ? (
            <Image
              src={imageUrl}
              alt={`${item.brand} ${item.model}`}
              fill
              className="object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <Package className="h-12 w-12 text-muted" />
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <h1 className="text-2xl font-bold text-fg mb-1">
                {item.brand} {item.model}
              </h1>
              {item.colorway && (
                <p className="text-muted text-sm">{item.colorway}</p>
              )}
            </div>

            {/* Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Details
                </DropdownMenuItem>
                <DropdownMenuItem className="text-red-500">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Item
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted">SKU:</span>
              <span className="font-mono font-medium">{item.sku}</span>
            </div>

            {item.size_uk && (
              <div className="flex items-center gap-2">
                <span className="text-muted">Size:</span>
                <span className="font-mono font-medium">UK {item.size_uk}</span>
              </div>
            )}

            <Badge
              variant="outline"
              className={cn('text-xs', conditionColors[condition as keyof typeof conditionColors] || '')}
            >
              {condition}
            </Badge>

            {item.category && (
              <Badge variant="outline" className="text-xs">
                {item.category}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
