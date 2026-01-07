/**
 * eBay Sneaker-specific helpers
 * Pre-configured searches for authenticated, new sneakers
 */

import { EbayClient } from './client'
import { EbaySoldSearchOptions } from './types'

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * eBay Condition IDs
 * https://developer.ebay.com/devzone/finding/callref/enums/conditionIdList.html
 */
export const EBAY_CONDITION = {
  NEW: 1000,
  NEW_WITH_DEFECTS: 1500,
  NEW_WITH_BOX: 1750,
  NEW_WITHOUT_BOX: 1500,
  PRE_OWNED: 3000,
  VERY_GOOD: 4000,
  GOOD: 5000,
  ACCEPTABLE: 6000,
} as const

/**
 * eBay Sneaker Category IDs (US marketplace)
 * Note: These may vary by marketplace (EBAY_GB, EBAY_US, etc.)
 */
export const EBAY_SNEAKER_CATEGORIES = {
  ATHLETIC_SNEAKERS_MEN: '15709',
  ATHLETIC_SNEAKERS_WOMEN: '95672',
  ATHLETIC_SNEAKERS_UNISEX: '155194',
  CASUAL_SNEAKERS_MEN: '24087',
  CASUAL_SNEAKERS_WOMEN: '63889',
} as const

/**
 * eBay Qualified Programs
 */
export const EBAY_PROGRAMS = {
  AUTHENTICITY_GUARANTEE: 'AUTHENTICITY_GUARANTEE',
  EBAY_REFURBISHED: 'EBAY_REFURBISHED',
} as const

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Search for NEW sneakers with Authenticity Guarantee
 * This is the most common use case for premium sneaker reselling
 */
export async function searchAuthenticatedNewSneakers(query: string, options?: {
  limit?: number
  categoryIds?: string[]
  soldItemsOnly?: boolean
  fetchFullDetails?: boolean // Enable two-step fetch for variations/sizes
}) {
  const client = new EbayClient()

  const searchOptions: EbaySoldSearchOptions = {
    query,
    limit: options?.limit ?? 50,
    // Only fetch NEW (1000) - strictest condition for AG items
    conditionIds: [EBAY_CONDITION.NEW],
    qualifiedPrograms: [EBAY_PROGRAMS.AUTHENTICITY_GUARANTEE],
    categoryIds: options?.categoryIds ?? [
      EBAY_SNEAKER_CATEGORIES.ATHLETIC_SNEAKERS_MEN,
      EBAY_SNEAKER_CATEGORIES.ATHLETIC_SNEAKERS_WOMEN,
      EBAY_SNEAKER_CATEGORIES.ATHLETIC_SNEAKERS_UNISEX,
    ],
    soldItemsOnly: options?.soldItemsOnly ?? true,
    fetchFullDetails: options?.fetchFullDetails ?? false, // Default: summary only
  }

  return client.searchSold(searchOptions)
}

/**
 * Search for ANY authenticated sneakers (new or used)
 */
export async function searchAuthenticatedSneakers(query: string, options?: {
  limit?: number
  categoryIds?: string[]
  soldItemsOnly?: boolean
  fetchFullDetails?: boolean
}) {
  const client = new EbayClient()

  const searchOptions: EbaySoldSearchOptions = {
    query,
    limit: options?.limit ?? 50,
    qualifiedPrograms: [EBAY_PROGRAMS.AUTHENTICITY_GUARANTEE],
    categoryIds: options?.categoryIds ?? [
      EBAY_SNEAKER_CATEGORIES.ATHLETIC_SNEAKERS_MEN,
      EBAY_SNEAKER_CATEGORIES.ATHLETIC_SNEAKERS_WOMEN,
      EBAY_SNEAKER_CATEGORIES.ATHLETIC_SNEAKERS_UNISEX,
    ],
    soldItemsOnly: options?.soldItemsOnly ?? true,
    fetchFullDetails: options?.fetchFullDetails ?? false,
  }

  return client.searchSold(searchOptions)
}

/**
 * Search for NEW sneakers (with or without authentication)
 */
export async function searchNewSneakers(query: string, options?: {
  limit?: number
  categoryIds?: string[]
  soldItemsOnly?: boolean
  requireAuthentication?: boolean
  fetchFullDetails?: boolean
}) {
  const client = new EbayClient()

  const searchOptions: EbaySoldSearchOptions = {
    query,
    limit: options?.limit ?? 50,
    conditionIds: [EBAY_CONDITION.NEW],
    categoryIds: options?.categoryIds ?? [
      EBAY_SNEAKER_CATEGORIES.ATHLETIC_SNEAKERS_MEN,
      EBAY_SNEAKER_CATEGORIES.ATHLETIC_SNEAKERS_WOMEN,
      EBAY_SNEAKER_CATEGORIES.ATHLETIC_SNEAKERS_UNISEX,
    ],
    soldItemsOnly: options?.soldItemsOnly ?? true,
    fetchFullDetails: options?.fetchFullDetails ?? false,
  }

  // Optionally require authentication
  if (options?.requireAuthentication) {
    searchOptions.qualifiedPrograms = [EBAY_PROGRAMS.AUTHENTICITY_GUARANTEE]
  }

  return client.searchSold(searchOptions)
}
