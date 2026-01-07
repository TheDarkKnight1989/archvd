// ============================================================================
// Item Summary (from /item_summary/search)
// ============================================================================

export interface EbayItemSummary {
  itemId: string
  title: string
  price: {
    value: string
    currency: string
  }
  itemEndDate?: string // ISO date
  condition?: string // conditionId as string
  categoryId?: string
  image?: {
    imageUrl: string
  }
}

// ============================================================================
// Full Item Details (from /item/{itemId})
// ============================================================================

export interface EbayVariation {
  variationId: string
  availability?: {
    availabilityStatus?: string
    estimatedAvailabilityStatus?: string
  }
  localizedAspects?: Array<{
    name: string // e.g. "US Shoe Size (Men's)"
    value: string // e.g. "10.5"
    type?: string
  }>
}

export interface EbayShippingOption {
  shippingCost: {
    value: string
    currency: string
  }
  shippingServiceCode?: string
  type?: string // e.g. "CALCULATED", "FLAT"
}

export interface EbaySeller {
  username?: string
  feedbackPercentage?: string
  feedbackScore?: number
}

export interface EbayItemDetails {
  itemId: string
  title: string
  price: {
    value: string
    currency: string
  }
  condition?: string // conditionId as string
  conditionDescription?: string // e.g. "New with box"
  categoryId?: string
  image?: {
    imageUrl: string
  }
  additionalImages?: Array<{
    imageUrl: string
  }>
  itemEndDate?: string // ISO date

  // Size variations
  localizedAspects?: Array<{
    name: string
    value: string
    type?: string
  }>

  // All variations (for multi-size listings)
  variations?: EbayVariation[]

  // Shipping details
  shippingOptions?: EbayShippingOption[]

  // Seller info
  seller?: EbaySeller

  // Authenticity verification
  authenticityVerification?: {
    description?: string
    terms?: string
    type?: string
  }
}

// ============================================================================
// Enriched Sold Item (combines summary + details)
// ============================================================================

export interface EbaySoldItem {
  // From summary
  itemId: string
  title: string
  price: number // major units
  currency: string
  soldAt: string // ISO date
  conditionId?: number
  categoryId?: string

  // From full details (optional - populated if two-step fetch used)
  variations?: EbayVariation[]
  shippingOptions?: EbayShippingOption[]
  seller?: EbaySeller
  authenticityVerification?: {
    description?: string
    type?: string
  }

  // Extracted data
  extractedSize?: string // Raw size value (deprecated - use sizeInfo)
  extractedSKU?: string // Extracted from title
  shippingCost?: number // Cheapest shipping option in major units

  // Enhanced size extraction with system detection
  sizeInfo?: {
    size: string // Raw size value (e.g., "10.5", "11.5")
    system: 'US' | 'UK' | 'EU' | 'UNKNOWN'
    confidence: 'HIGH' | 'MEDIUM' | 'LOW'
    normalizedKey: string // e.g., "US 10.5", "UK 11.5"
  }
}

// ============================================================================
// Search Options & Results
// ============================================================================

export interface EbaySoldSearchOptions {
  query: string // e.g. "DD1391-100" or "Jordan 4 Black Cat"
  limit?: number // default 50
  conditionIds?: number[] // e.g. [1000] for NEW
  categoryIds?: string[] // e.g. ["15709"] for athletic sneakers
  qualifiedPrograms?: string[] // e.g. ["AUTHENTICITY_GUARANTEE"]
  soldItemsOnly?: boolean // default true for sold searches
  fetchFullDetails?: boolean // default false - whether to fetch /item/{itemId} for each result
}

export interface EbaySoldSearchResult {
  items: EbaySoldItem[]
  totalFetched: number // How many items from summary search
  fullDetailsFetched: number // How many got full details (if fetchFullDetails: true)
}
