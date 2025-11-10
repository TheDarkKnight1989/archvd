'use client'

import * as React from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import * as Tooltip from '@radix-ui/react-tooltip'

// Size system types
type SizeSystem = 'UK' | 'US' | 'EU' | 'JP'
type SizeGender = 'M' | 'W' | 'GS' | 'PS' | 'TD' | null

// Category types
type ProductCategory = 'sneakers' | 'pokemon' | 'streetwear' | 'other'
type LanguageTag = 'EN' | 'JP' | null

export type ProductLineItemProps = {
  // Visuals
  imageUrl: string | null
  imageAlt?: string

  // Text
  brand: string
  model: string
  variant?: string // colorway / set name / edition; optional
  sku: string

  // Linking
  href: string // internal product route: /product/[sku]
  onOpen?: () => void // optional row-level click handler

  // Size (optional)
  sizeUk?: string | null // we store UK internally
  sizeSystem?: SizeSystem // user pref
  sizeGender?: SizeGender

  // Category flags
  category: ProductCategory
  languageTag?: LanguageTag // for Pokémon sealed

  // Layout
  compact?: boolean // for tighter tables (watchlists)
  className?: string
}

/**
 * Convert UK size to target size system
 * This is a placeholder - extend with proper conversion tables as needed
 */
function convertSize(
  sizeUk: string | null | undefined,
  toSystem: SizeSystem,
  gender: SizeGender = null
): string | null {
  if (!sizeUk) return null

  const ukSize = parseFloat(sizeUk)
  if (isNaN(ukSize)) return sizeUk // Return as-is if not numeric

  // Simple conversion logic - extend this based on your requirements
  switch (toSystem) {
    case 'UK':
      return sizeUk
    case 'US':
      // US Men's is typically UK + 1
      // US Women's is typically UK + 2
      const usOffset = gender === 'W' ? 2 : 1
      return (ukSize + usOffset).toString()
    case 'EU':
      // EU is typically UK * 1.5 + 33.5 (approximate)
      return Math.round(ukSize * 1.5 + 33.5).toString()
    case 'JP':
      // JP (cm) is typically UK * 1.5 + 22 (approximate)
      return Math.round(ukSize * 1.5 + 22).toString()
    default:
      return sizeUk
  }
}

/**
 * Format size with system and gender labels
 */
function formatSizeLabel(
  size: string,
  system: SizeSystem,
  gender: SizeGender
): string {
  const genderLabel = gender && gender !== 'M' ? ` ${gender}` : ''
  return `${system}${genderLabel} ${size}`
}

/**
 * ProductLineItem - Standardized product cell for all tables
 *
 * Displays:
 * - Image thumbnail (40x40 or 44x44)
 * - Brand + Model with external link icon
 * - Variant/colorway (semibold)
 * - Size chip (if applicable, converted to user's preferred system)
 * - SKU chip (always shown)
 * - Language tag for Pokémon (EN/JP)
 */
export function ProductLineItem({
  imageUrl,
  imageAlt,
  brand,
  model,
  variant,
  sku,
  href,
  onOpen,
  sizeUk,
  sizeSystem = 'UK',
  sizeGender = null,
  category,
  languageTag,
  compact = false,
  className,
}: ProductLineItemProps) {
  // Convert size to user's preferred system
  const convertedSize = React.useMemo(() => {
    if (!sizeUk || category === 'pokemon') return null
    return convertSize(sizeUk, sizeSystem, sizeGender)
  }, [sizeUk, sizeSystem, sizeGender, category])

  const sizeLabel = React.useMemo(() => {
    if (!convertedSize) return null
    return formatSizeLabel(convertedSize, sizeSystem, sizeGender)
  }, [convertedSize, sizeSystem, sizeGender])

  const handleClick = (e: React.MouseEvent) => {
    if (onOpen) {
      e.preventDefault()
      onOpen()
    }
  }

  const imageSizeClass = compact ? 'h-10 w-10' : 'h-10 w-10 lg:h-11 lg:w-11'

  return (
    <div className={cn('flex gap-3 items-start', className)}>
      {/* Image thumbnail */}
      <div
        className={cn(
          imageSizeClass,
          'rounded-lg overflow-hidden flex-shrink-0 bg-elev-1 transition-transform duration-200 group-hover:-translate-y-[0.5px]'
        )}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={imageAlt || `${brand} ${model}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-elev-2 text-xs font-medium text-dim">
            {brand?.slice(0, 2).toUpperCase() || 'IT'}
          </div>
        )}
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Title row: Brand + Model + Link icon */}
        <div className="flex items-center gap-1.5">
          <Link
            href={href}
            onClick={handleClick}
            className="text-sm text-ink tracking-tight hover:text-ink/70 transition-colors line-clamp-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:rounded"
            aria-label={`View ${brand} ${model} details`}
          >
            {brand} {model}
          </Link>

          <Tooltip.Provider delayDuration={300}>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <Link
                  href={href}
                  onClick={handleClick}
                  className="flex-shrink-0 text-ink/50 hover:text-ink/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:rounded"
                  aria-hidden="true"
                >
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                </Link>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="bg-elev-3 border border-border px-2 py-1 rounded-lg text-xs text-fg shadow-lg"
                  sideOffset={5}
                >
                  Open details
                  <Tooltip.Arrow className="fill-elev-3" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>

        {/* Variant/colorway (semibold) */}
        {variant && (
          <div className="text-[13px] font-semibold text-ink line-clamp-1" title={variant}>
            {variant}
          </div>
        )}

        {/* Chips row: Size (if applicable) + SKU + Language tag */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Size chip for sneakers/streetwear */}
          {sizeLabel && category !== 'pokemon' && (
            <span
              className="inline-flex items-center text-[11px] px-2 py-[2px] rounded-full bg-[#F3EFE8] text-ink/80 whitespace-nowrap"
              title={`Size: ${sizeLabel}`}
            >
              <span className="font-semibold">Size:</span>
              <span className="ml-1">{sizeLabel}</span>
            </span>
          )}

          {/* Language tag for Pokémon sealed */}
          {languageTag && category === 'pokemon' && (
            <span
              className="inline-flex items-center text-[11px] px-2 py-[2px] rounded-full bg-[#F3EFE8] text-ink/80 font-medium"
              title={`Language: ${languageTag}`}
            >
              {languageTag}
            </span>
          )}

          {/* SKU chip (always shown) */}
          <span
            className="inline-flex items-center text-[11px] px-2 py-[2px] rounded-full bg-[#F3EFE8] text-ink/80 font-mono"
            title={`SKU: ${sku}`}
          >
            {sku}
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Skeleton variant for loading states
 */
ProductLineItem.Skeleton = function ProductLineItemSkeleton({
  compact = false,
  className,
}: {
  compact?: boolean
  className?: string
}) {
  const imageSizeClass = compact ? 'h-10 w-10' : 'h-10 w-10 lg:h-11 lg:w-11'

  return (
    <div className={cn('flex gap-3 items-start', className)}>
      {/* Image skeleton */}
      <div
        className={cn(
          imageSizeClass,
          'rounded-lg bg-elev-2 animate-pulse flex-shrink-0'
        )}
      />

      {/* Text content skeleton */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Title row */}
        <div className="h-4 bg-elev-2 animate-pulse rounded w-3/4" />

        {/* Variant */}
        <div className="h-3.5 bg-elev-2 animate-pulse rounded w-1/2" />

        {/* Chips */}
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-16 bg-elev-2 animate-pulse rounded-full" />
          <div className="h-5 w-20 bg-elev-2 animate-pulse rounded-full" />
        </div>
      </div>
    </div>
  )
}

/**
 * Compact variant helper
 */
ProductLineItem.Compact = function ProductLineItemCompact(
  props: Omit<ProductLineItemProps, 'compact'>
) {
  return <ProductLineItem {...props} compact />
}

export default ProductLineItem
