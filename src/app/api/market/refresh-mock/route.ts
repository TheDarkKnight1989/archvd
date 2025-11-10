// Mock Price Refresh API
// Perturbs mock market prices by ±3% to simulate market changes
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/market/refresh-mock
 *
 * Simulates market price fluctuations by updating all mock prices with ±3% variance.
 * Creates new price snapshots with updated timestamps.
 *
 * Returns statistics about the refresh operation.
 */
export async function POST() {
  try {
    const supabase = await createClient()

    // Fetch all current mock prices
    const { data: currentPrices, error: fetchError } = await supabase
      .from('product_market_prices')
      .select('*')
      .eq('source', 'mock-stockx')
      .order('sku', { ascending: true })
      .order('size', { ascending: true })

    if (fetchError) {
      throw new Error(`Failed to fetch mock prices: ${fetchError.message}`)
    }

    if (!currentPrices || currentPrices.length === 0) {
      return NextResponse.json({
        message: 'No mock prices found to refresh',
        updated: 0,
      })
    }

    // Generate perturbed prices (±3% random variance)
    const newPrices = currentPrices.map((price) => {
      // Random variance between -3% and +3%
      const variance = (Math.random() * 6 - 3) / 100 // -0.03 to +0.03
      const perturbedPrice = parseFloat(price.price) * (1 + variance)

      // Round to 2 decimal places
      const roundedPrice = Math.round(perturbedPrice * 100) / 100

      return {
        sku: price.sku,
        size: price.size,
        source: price.source,
        currency: price.currency,
        price: roundedPrice,
        as_of: new Date().toISOString(),
        meta: {
          ...price.meta,
          perturbed: true,
          variance: `${(variance * 100).toFixed(2)}%`,
          original_price: parseFloat(price.price),
        },
      }
    })

    // Insert new price snapshots
    const { data: inserted, error: insertError } = await supabase
      .from('product_market_prices')
      .insert(newPrices)
      .select()

    if (insertError) {
      throw new Error(`Failed to insert perturbed prices: ${insertError.message}`)
    }

    // Calculate statistics
    const stats = {
      total_updated: inserted?.length || 0,
      unique_skus: new Set(newPrices.map(p => p.sku)).size,
      avg_price_change: newPrices.reduce((acc, newPrice) => {
        const original = currentPrices.find(p => p.sku === newPrice.sku && p.size === newPrice.size)
        if (!original) return acc
        const change = ((newPrice.price - parseFloat(original.price)) / parseFloat(original.price)) * 100
        return acc + Math.abs(change)
      }, 0) / newPrices.length,
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json({
      message: 'Mock prices refreshed successfully',
      stats,
      sample: newPrices.slice(0, 5), // Return first 5 as sample
    })

  } catch (error: any) {
    console.error('[Refresh Mock API] Error:', error.message)

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
