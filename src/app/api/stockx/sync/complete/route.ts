/**
 * StockX Complete Sync
 * End-to-end sync pipeline for live StockX market data on dashboard
 *
 * POST /api/stockx/sync/complete
 *
 * Pipeline:
 * 1. Verify StockX OAuth is connected
 * 2. Fetch owned inventory SKUs
 * 3. Sync StockX catalog + prices → market_products + market_prices
 * 4. Auto-link inventory → market products (exact SKU + size)
 * 5. Refresh materialized views
 * 6. Return detailed sync report
 *
 * Does NOT create inventory items from StockX data.
 * Does NOT modify existing inventory rows.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStockxClient } from '@/lib/services/stockx/client'
import { getProductBySku } from '@/lib/services/stockx/products'
import { logger } from '@/lib/logger'

type SyncReport = {
  success: boolean
  step: string
  stockxConnected: boolean
  accountEmail: string | null
  inventory: {
    totalItems: number
    uniqueSkus: number
  }
  catalog: {
    fetched: number
    inserted: number
    skipped: number
    errors: string[]
  }
  prices: {
    fetched: number
    inserted: number
    skipped: number
    errors: string[]
  }
  links: {
    created: number
    updated: number
    skipped: number
    errors: string[]
  }
  views: {
    refreshed: string[]
    errors: string[]
  }
  missingPrices: Array<{
    inventoryId: string
    sku: string
    size: string | null
    reason: string
  }>
  durationMs: number
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  const report: SyncReport = {
    success: false,
    step: 'init',
    stockxConnected: false,
    accountEmail: null,
    inventory: { totalItems: 0, uniqueSkus: 0 },
    catalog: { fetched: 0, inserted: 0, skipped: 0, errors: [] },
    prices: { fetched: 0, inserted: 0, skipped: 0, errors: [] },
    links: { created: 0, updated: 0, skipped: 0, errors: [] },
    views: { refreshed: [], errors: [] },
    missingPrices: [],
    durationMs: 0,
  }

  try {
    // ========================================================================
    // Step 1: Verify StockX OAuth Connection
    // ========================================================================
    report.step = 'verify_stockx'

    if (process.env.NEXT_PUBLIC_STOCKX_ENABLE !== 'true') {
      return NextResponse.json({
        ...report,
        success: false,
        error: 'StockX integration is not enabled. Set NEXT_PUBLIC_STOCKX_ENABLE=true',
        durationMs: Date.now() - startTime,
      }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        ...report,
        success: false,
        error: 'Unauthorized',
        durationMs: Date.now() - startTime,
      }, { status: 401 })
    }

    // Check StockX account connection
    const { data: account, error: accountError } = await supabase
      .from('stockx_accounts')
      .select('account_email, access_token, refresh_token')
      .eq('user_id', user.id)
      .single()

    if (accountError || !account || !account.access_token) {
      return NextResponse.json({
        ...report,
        success: false,
        stockxConnected: false,
        error: 'StockX account not connected. Please go to Settings → Integrations and connect your StockX account via OAuth.',
        durationMs: Date.now() - startTime,
      }, { status: 401 })
    }

    report.stockxConnected = true
    report.accountEmail = account.account_email

    logger.info('[StockX Complete Sync] OAuth verified', {
      userId: user.id,
      accountEmail: account.account_email,
    })

    // ========================================================================
    // Step 2: Fetch User's Inventory SKUs
    // ========================================================================
    report.step = 'fetch_inventory'

    const { data: inventory, error: inventoryError } = await supabase
      .from('Inventory')
      .select('id, sku, size, size_uk, category')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (inventoryError) {
      throw new Error(`Failed to fetch inventory: ${inventoryError.message}`)
    }

    if (!inventory || inventory.length === 0) {
      return NextResponse.json({
        ...report,
        success: true,
        step: 'completed',
        error: 'No active inventory items to sync',
        durationMs: Date.now() - startTime,
      })
    }

    report.inventory.totalItems = inventory.length

    // Get unique SKUs (dash-insensitive)
    const uniqueSkus = new Set<string>()
    inventory.forEach((item) => {
      if (item.sku) {
        uniqueSkus.add(item.sku.toLowerCase().replace(/-/g, ''))
      }
    })

    report.inventory.uniqueSkus = uniqueSkus.size

    logger.info('[StockX Complete Sync] Inventory analyzed', {
      totalItems: inventory.length,
      uniqueSkus: uniqueSkus.size,
    })

    // ========================================================================
    // Step 3: Sync StockX Catalog + Prices
    // ========================================================================
    report.step = 'sync_catalog_prices'

    const client = getStockxClient(user.id)

    // Track which SKUs we successfully synced
    const syncedSkus = new Set<string>()

    for (const item of inventory) {
      const rawSku = item.sku
      if (!rawSku) continue

      const normalizedSku = rawSku.toLowerCase().replace(/-/g, '')
      if (syncedSkus.has(normalizedSku)) {
        report.catalog.skipped++
        continue
      }

      try {
        // Fetch product details from StockX
        const product = await getProductBySku(rawSku)

        if (!product) {
          report.catalog.skipped++
          report.catalog.errors.push(`SKU not found on StockX: ${rawSku}`)
          continue
        }

        report.catalog.fetched++

        // Insert into market_products
        const { error: productError } = await supabase
          .from('market_products')
          .upsert({
            sku: product.sku,
            provider: 'stockx',
            provider_product_id: product.id,
            brand: product.brand,
            model: product.model || product.name,
            colorway: product.colorway || null,
            image_url: product.imageUrl || null,
            category: item.category || 'sneaker',
            meta: {
              slug: product.slug,
              retail_price: product.retailPrice,
              release_date: product.releaseDate,
              description: product.description,
            },
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'sku,provider',
          })

        if (productError) {
          report.catalog.errors.push(`Failed to insert ${product.sku}: ${productError.message}`)
          continue
        }

        report.catalog.inserted++
        syncedSkus.add(normalizedSku)

        // Now fetch prices for all available sizes
        if (product.variants && product.variants.length > 0) {
          for (const variant of product.variants) {
            try {
              // Fetch market data for this size
              // Note: StockX API structure may vary - adjust endpoint as needed
              const marketData = await client.request<any>(
                `/v1/products/${encodeURIComponent(product.slug)}/market?size=${encodeURIComponent(variant.size)}`
              )

              report.prices.fetched++

              // Extract price data
              const lowestAsk = marketData.lowestAsk?.amount || marketData.lowest_ask
              const highestBid = marketData.highestBid?.amount || marketData.highest_bid
              const lastSale = marketData.lastSale?.amount || marketData.last_sale

              if (!lowestAsk && !highestBid && !lastSale) {
                report.prices.skipped++
                continue
              }

              // Convert size to UK if needed (StockX usually returns US sizing)
              let sizeUk = variant.size
              if (variant.sizeType === 'US') {
                // Simple US to UK conversion: UK = US - 1
                const usSize = parseFloat(variant.size)
                if (!isNaN(usSize)) {
                  sizeUk = String(usSize - 1)
                }
              }

              // Insert into market_prices
              const { error: priceError } = await supabase
                .from('market_prices')
                .insert({
                  sku: product.sku,
                  provider: 'stockx',
                  size: sizeUk,
                  currency: 'GBP', // StockX returns GBP for UK users
                  price: lastSale || lowestAsk, // Prefer last sale
                  lowest_ask: lowestAsk,
                  highest_bid: highestBid,
                  last_sale: lastSale,
                  as_of: new Date().toISOString(),
                })

              if (priceError) {
                report.prices.errors.push(`Failed to insert price for ${product.sku} size ${variant.size}: ${priceError.message}`)
              } else {
                report.prices.inserted++
              }

              // Small delay to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 50))

            } catch (priceError: any) {
              report.prices.errors.push(`Failed to fetch price for ${product.sku} size ${variant.size}: ${priceError.message}`)
            }
          }
        }

        // Delay between products to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200))

      } catch (error: any) {
        report.catalog.errors.push(`Failed to fetch ${rawSku}: ${error.message}`)
      }
    }

    logger.info('[StockX Complete Sync] Catalog + prices synced', {
      catalogInserted: report.catalog.inserted,
      pricesInserted: report.prices.inserted,
    })

    // ========================================================================
    // Step 4: Auto-link Inventory → Market Products
    // ========================================================================
    report.step = 'link_inventory'

    for (const item of inventory) {
      if (!item.sku) continue

      try {
        // Find matching market product (dash-insensitive)
        const { data: marketProduct, error: marketProductError } = await supabase
          .from('market_products')
          .select('sku, provider')
          .eq('provider', 'stockx')
          .ilike('sku', item.sku.replace(/-/g, '%'))
          .single()

        if (marketProductError || !marketProduct) {
          report.missingPrices.push({
            inventoryId: item.id,
            sku: item.sku,
            size: item.size_uk || item.size,
            reason: 'No market product found (SKU not in catalog)',
          })
          continue
        }

        // Determine size to match
        const sizeToMatch = item.size_uk || item.size

        // Check if link already exists
        const { data: existingLink } = await supabase
          .from('inventory_market_links')
          .select('id')
          .eq('inventory_id', item.id)
          .eq('provider', 'stockx')
          .single()

        if (existingLink) {
          // Update existing link
          const { error: updateError } = await supabase
            .from('inventory_market_links')
            .update({
              provider_product_sku: marketProduct.sku,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingLink.id)

          if (updateError) {
            report.links.errors.push(`Failed to update link for ${item.sku}: ${updateError.message}`)
          } else {
            report.links.updated++
          }
        } else {
          // Create new link
          const { error: linkError } = await supabase
            .from('inventory_market_links')
            .insert({
              inventory_id: item.id,
              provider: 'stockx',
              provider_product_sku: marketProduct.sku,
              provider_product_id: marketProduct.sku, // Use SKU as ID for now
            })

          if (linkError) {
            report.links.errors.push(`Failed to create link for ${item.sku}: ${linkError.message}`)
          } else {
            report.links.created++
          }
        }

        // Check if there's a price for this size
        const { data: priceData } = await supabase
          .from('market_prices')
          .select('price')
          .eq('sku', marketProduct.sku)
          .eq('provider', 'stockx')
          .eq('size', sizeToMatch)
          .order('as_of', { ascending: false })
          .limit(1)
          .single()

        if (!priceData) {
          report.missingPrices.push({
            inventoryId: item.id,
            sku: item.sku,
            size: sizeToMatch,
            reason: 'No price data for this size',
          })
        }

      } catch (error: any) {
        report.links.errors.push(`Error linking ${item.sku}: ${error.message}`)
      }
    }

    logger.info('[StockX Complete Sync] Inventory linked', {
      created: report.links.created,
      updated: report.links.updated,
    })

    // ========================================================================
    // Step 5: Refresh Materialized Views
    // ========================================================================
    report.step = 'refresh_views'

    // Refresh market_price_daily_medians
    try {
      await supabase.rpc('refresh_market_price_daily_medians')
      report.views.refreshed.push('market_price_daily_medians')
    } catch (error: any) {
      report.views.errors.push(`Failed to refresh market_price_daily_medians: ${error.message}`)
    }

    // Refresh portfolio_value_daily
    try {
      await supabase.rpc('refresh_portfolio_value_daily', { p_user_id: user.id })
      report.views.refreshed.push('portfolio_value_daily')
    } catch (error: any) {
      report.views.errors.push(`Failed to refresh portfolio_value_daily: ${error.message}`)
    }

    logger.info('[StockX Complete Sync] Views refreshed', {
      refreshed: report.views.refreshed,
    })

    // ========================================================================
    // Done!
    // ========================================================================
    report.success = true
    report.step = 'completed'
    report.durationMs = Date.now() - startTime

    logger.apiRequest(
      '/api/stockx/sync/complete',
      { userId: user.id },
      report.durationMs,
      {
        catalogInserted: report.catalog.inserted,
        pricesInserted: report.prices.inserted,
        linksCreated: report.links.created,
        missingPrices: report.missingPrices.length,
      }
    )

    return NextResponse.json(report)

  } catch (error: any) {
    report.durationMs = Date.now() - startTime

    logger.error('[StockX Complete Sync] Error', {
      step: report.step,
      error: error.message,
      stack: error.stack,
    })

    return NextResponse.json({
      ...report,
      success: false,
      error: error.message,
      durationMs: report.durationMs,
    }, { status: 500 })
  }
}
