/**
 * Smart size matching using StockX's sizeChart metadata with brand-specific conversion fallback
 *
 * EXTRACTED FROM: /api/stockx/map-item/route.ts (lines 23-111)
 * REUSED BY: /api/items/add-by-sku, /api/stockx/map-item
 *
 * This function matches a target size (e.g., "9") in a given size system (e.g., "UK")
 * against StockX variants using their sizeChart.displayOptions array.
 *
 * Example:
 * - targetSize: "9"
 * - assumedSystem: "UK"
 * - variant.sizeChart.displayOptions: ["US 10", "UK 9", "EU 44"]
 * - Result: Match! (because "UK 9" is in displayOptions)
 *
 * If sizeChart data is missing, falls back to brand-specific size conversion.
 */

import type { StockxVariant } from '@/lib/services/stockx/catalog'
import { detectBrand, detectGender, convertUkToUs } from '@/lib/utils/size-conversion'

export function findVariantBySize(
  targetSize: string,
  assumedSystem: 'UK' | 'US' | 'EU' | 'JP',
  variants: StockxVariant[],
  productBrand?: string | null,
  productTitle?: string | null
): StockxVariant | null {
  console.log('[Size Matching] Starting search:', { targetSize, assumedSystem, variantsCount: variants.length })

  // First pass: Try using StockX's sizeChart metadata (most reliable)
  for (const variant of variants) {
    if (!variant.sizeChart?.displayOptions || variant.sizeChart.displayOptions.length === 0) {
      continue
    }

    // Build search patterns for the target size in the assumed system
    // Examples for targetSize="9", assumedSystem="UK":
    // - "UK 9"
    // - "UK9"
    // - "9" (exact match)
    const searchPatterns = [
      `${assumedSystem} ${targetSize}`,  // "UK 9"
      `${assumedSystem}${targetSize}`,   // "UK9"
      targetSize,                         // "9" (exact match)
    ].map(p => p.toLowerCase().trim())

    console.log('[Size Matching] Checking variant:', {
      variantId: variant.variantId,
      variantValue: variant.variantValue,
      displayOptions: variant.sizeChart.displayOptions,
      searchPatterns,
    })

    // Check if any pattern matches any displayOption
    for (const displayOption of variant.sizeChart.displayOptions) {
      const normalizedOption = displayOption.toLowerCase().trim()

      for (const pattern of searchPatterns) {
        // Check for exact match or contains match
        if (normalizedOption === pattern || normalizedOption.includes(pattern)) {
          console.log('[Size Matching] ✅ MATCH FOUND:', {
            variantId: variant.variantId,
            variantValue: variant.variantValue,
            matchedDisplayOption: displayOption,
            pattern,
          })
          return variant
        }
      }
    }
  }

  console.log('[Size Matching] No sizeChart match found, trying brand-specific conversion fallback...')

  // Second pass: Fallback to brand-specific size conversion (when sizeChart data is missing)
  if (assumedSystem === 'UK' && productBrand && productTitle) {
    const brand = detectBrand(productBrand, productTitle)
    const gender = detectGender(productTitle)
    const usSize = convertUkToUs(parseFloat(targetSize), brand, gender)

    if (usSize) {
      console.log('[Size Matching] Converted UK → US:', {
        ukSize: targetSize,
        usSize,
        brand,
        gender,
      })

      // Find variant with matching US size
      for (const variant of variants) {
        const variantSize = parseFloat(variant.variantValue)
        if (variantSize === usSize) {
          console.log('[Size Matching] ✅ MATCH FOUND (brand conversion fallback):', {
            variantId: variant.variantId,
            variantValue: variant.variantValue,
            ukSize: targetSize,
            usSize,
          })
          return variant
        }
      }

      console.warn('[Size Matching] Conversion successful but no variant found for US size:', usSize)
    }
  }

  console.warn('[Size Matching] ❌ No match found for:', { targetSize, assumedSystem })
  return null
}
