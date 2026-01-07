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
  // MANUAL ITEM FIX: Detect manual items - show title only, no brand
  const isManual = !item.stockx_product_id && !item.alias_catalog_id

  const displayTitle = item.model?.trim() || item.sku?.trim() || 'Untitled'

  // For manual items, pass empty brand so ProductLineItem just shows the title
  const displayBrand = isManual ? '' : (item.brand?.trim() || '')

  return (
    <ProductLineItem
      // Image fallback chain
      imageUrl={item.image.url}
      imageAlt={item.image.alt}
      marketImageUrl={item.image.url}
      inventoryImageUrl={item.image.url}
      provider={item.market.provider}
      imageSource={item.imageSource === 'alias' ? 'local' : item.imageSource}

      // Product info (for manual items: no brand, just title)
      brand={displayBrand}
      model={displayTitle}
      variant={item.colorway || undefined}
      sku={item.sku}

      // Link
      href={item.links.productUrl || `/product/${item.sku}`}
      onOpen={onClick}

      // Size
      sizeUk={item.size_uk?.toString() || null}
      sizeSystem="UK"
      sizeGender={null}

      // Category (pass actual category for proper size display handling)
      category={(item.category as any) || "sneakers"}

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
