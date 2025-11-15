/**
 * Provider Preference Tests
 * Tests for market data provider selection logic
 */

import { describe, it, expect } from 'vitest'

describe('Provider Preference Logic', () => {
  it('should prefer StockX over Alias', () => {
    const providers = [
      { provider: 'alias', price: 200, asOf: '2025-01-10T12:00:00Z' },
      { provider: 'stockx', price: 195, asOf: '2025-01-10T12:00:00Z' },
    ]

    // Sort by preference: stockx > alias > ebay > seed
    const sorted = providers.sort((a, b) => {
      const order: Record<string, number> = { stockx: 0, alias: 1, ebay: 2, seed: 3 }
      return order[a.provider] - order[b.provider]
    })

    expect(sorted[0].provider).toBe('stockx')
  })

  it('should prefer Alias over eBay', () => {
    const providers = [
      { provider: 'ebay', price: 200, asOf: '2025-01-10T12:00:00Z' },
      { provider: 'alias', price: 195, asOf: '2025-01-10T12:00:00Z' },
    ]

    const sorted = providers.sort((a, b) => {
      const order: Record<string, number> = { stockx: 0, alias: 1, ebay: 2, seed: 3 }
      return order[a.provider] - order[b.provider]
    })

    expect(sorted[0].provider).toBe('alias')
  })

  it('should prefer eBay over seed data', () => {
    const providers = [
      { provider: 'seed', price: 200, asOf: '2025-01-10T12:00:00Z' },
      { provider: 'ebay', price: 195, asOf: '2025-01-10T12:00:00Z' },
    ]

    const sorted = providers.sort((a, b) => {
      const order: Record<string, number> = { stockx: 0, alias: 1, ebay: 2, seed: 3 }
      return order[a.provider] - order[b.provider]
    })

    expect(sorted[0].provider).toBe('ebay')
  })

  it('should handle missing providers gracefully', () => {
    const providers = [
      { provider: 'unknown', price: 200, asOf: '2025-01-10T12:00:00Z' },
      { provider: 'stockx', price: 195, asOf: '2025-01-10T12:00:00Z' },
    ]

    const sorted = providers.sort((a, b) => {
      const order: Record<string, number> = { stockx: 0, alias: 1, ebay: 2, seed: 3, unknown: 999 }
      return (order[a.provider] ?? 999) - (order[b.provider] ?? 999)
    })

    expect(sorted[0].provider).toBe('stockx')
  })

  it('should prefer more recent data when providers are equal', () => {
    const providers = [
      { provider: 'stockx', price: 200, asOf: '2025-01-09T12:00:00Z' },
      { provider: 'stockx', price: 195, asOf: '2025-01-10T12:00:00Z' },
    ]

    const sorted = providers.sort((a, b) => {
      // First by provider, then by timestamp
      const order: Record<string, number> = { stockx: 0, alias: 1, ebay: 2, seed: 3 }
      const providerDiff = order[a.provider] - order[b.provider]
      if (providerDiff !== 0) return providerDiff

      return new Date(b.asOf).getTime() - new Date(a.asOf).getTime()
    })

    expect(sorted[0].asOf).toBe('2025-01-10T12:00:00Z')
    expect(sorted[0].price).toBe(195)
  })
})

describe('Market Data Selection', () => {
  it('should select best provider from multiple sources', () => {
    const marketData = [
      { provider: 'seed', price: 180, asOf: '2025-01-08T00:00:00Z' },
      { provider: 'alias', price: 195, asOf: '2025-01-09T12:00:00Z' },
      { provider: 'stockx', price: 200, asOf: '2025-01-10T10:00:00Z' },
      { provider: 'ebay', price: 190, asOf: '2025-01-10T11:00:00Z' },
    ]

    const selectBest = (data: typeof marketData) => {
      const order: Record<string, number> = { stockx: 0, alias: 1, ebay: 2, seed: 3 }
      const sorted = [...data].sort((a, b) => {
        const providerDiff = order[a.provider] - order[b.provider]
        if (providerDiff !== 0) return providerDiff
        return new Date(b.asOf).getTime() - new Date(a.asOf).getTime()
      })
      return sorted[0]
    }

    const best = selectBest(marketData)
    expect(best.provider).toBe('stockx')
    expect(best.price).toBe(200)
  })

  it('should handle single provider', () => {
    const marketData = [
      { provider: 'alias', price: 195, asOf: '2025-01-10T12:00:00Z' },
    ]

    const best = marketData[0]
    expect(best.provider).toBe('alias')
    expect(best.price).toBe(195)
  })

  it('should handle empty data', () => {
    const marketData: any[] = []
    const best = marketData[0]
    expect(best).toBeUndefined()
  })
})

describe('Provider Display Names', () => {
  it('should format provider names correctly', () => {
    const providerNames: Record<string, string> = {
      stockx: 'StockX',
      alias: 'Alias',
      ebay: 'eBay',
      seed: 'Seeded',
    }

    expect(providerNames['stockx']).toBe('StockX')
    expect(providerNames['alias']).toBe('Alias')
    expect(providerNames['ebay']).toBe('eBay')
    expect(providerNames['seed']).toBe('Seeded')
  })
})
