'use client'

import { ProductLineItem } from '@/components/product/ProductLineItem'
import type { EnrichedLineItem } from '@/lib/portfolio/types'

export interface ItemCellProps {
  item: EnrichedLineItem
  onClick?: () => void
}

/**
 * ItemCell - Product card for inventory table (sticky left column)
 * WHY: Displays image, brand/model, colorway, size, and SKU using ProductLineItem
 */
export function ItemCell({ item, onClick }: ItemCellProps) {
  return (
    <ProductLineItem
      // Image fallback chain
      imageUrl={item.image.src}
      imageAlt={item.image.alt}
      marketImageUrl={item.image.src}
      inventoryImageUrl={item.image.src}
      provider={item.market.provider}
      imageSource={item.imageSource}

      // Product info
      brand={item.brand}
      model={item.model}
      variant={item.colorway || undefined}
      sku={item.sku}

      // Link
      href={item.links.productUrl || `/product/${item.sku}`}
      onOpen={onClick}

      // Size
      sizeUk={item.size_uk?.toString() || null}
      sizeSystem="UK"
      sizeGender={null}

      // Category
      category="sneakers" // WHY: Default for now, enhance with actual category mapping

      // Layout
      compact={false}
    />
  )
}

/**
 * Skeleton for loading state
 */
export function ItemCellSkeleton() {
  return <ProductLineItem.Skeleton />
}
