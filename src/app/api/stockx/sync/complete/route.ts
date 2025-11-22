/**
 * StockX Complete Sync
 * End-to-end sync pipeline for StockX catalog + market job queuing
 *
 * POST /api/stockx/sync/complete
 *
 * DIRECTIVE COMPLIANCE:
 * - No live StockX market API calls in this route
 * - V1 endpoints forbidden
 * - Worker + V2 + cached stockx_market_latest ONLY
 * - This route syncs catalog + queues market jobs
 * - stockx-worker processes market jobs with V2 services
 * - Results cached in stockx_market_latest view
 *
 * Pipeline:
 * 1. Verify StockX OAuth is connected
 * 2. Fetch owned inventory SKUs
 * 3. Sync StockX catalog → market_products (using V2 catalog service)
 * 4. Queue market jobs for background price fetching
 * 5. Auto-link inventory → market products (exact SKU + size)
 * 6. Return detailed sync report with queued job count
 *
 * Does NOT create inventory items from StockX data.
 * Does NOT modify existing inventory rows.
 * Does NOT make live market API calls (queues jobs instead).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProductBySku } from '@/lib/services/stockx/products'
import { createMarketJobsBatch } from '@/lib/stockx/jobs'
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
  jobs: {
    created: number
    skipped: number
    errors: string[]
  }
  links: {
    created: number
    updated: number
    skipped: number
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
    jobs: { created: 0, skipped: 0, errors: [] },
    links: { created: 0, updated: 0, skipped: 0, errors: [] },
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
    // Step 3: Sync StockX Catalog
    // ========================================================================
    report.step = 'sync_catalog'

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
        const product = await getProductBySku(rawSku, { userId: user.id })

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

      } catch (error: any) {
        report.catalog.errors.push(`Failed to fetch ${rawSku}: ${error.message}`)
      }
    }

    logger.info('[StockX Complete Sync] Catalog synced', {
      catalogInserted: report.catalog.inserted,
    })

    // ========================================================================
    // Step 4: Queue Market Jobs for Background Processing
    // ========================================================================
    report.step = 'queue_market_jobs'

    // Collect all unique SKU+size pairs from inventory
    const jobParams = inventory
      .filter(item => item.sku && item.size)
      .map(item => ({
        sku: item.sku,
        size: item.size,
        userId: user.id,
      }))

    // Create market jobs in batch (replaces live V1 API calls)
    const jobResult = await createMarketJobsBatch(jobParams)

    report.jobs.created = jobResult.created
    report.jobs.skipped = jobResult.skipped
    report.jobs.errors = jobResult.errors

    logger.info('[StockX Complete Sync] Market jobs queued', {
      jobsCreated: jobResult.created,
      jobsSkipped: jobResult.skipped,
    })

    // ========================================================================
    // Step 5: Auto-link Inventory → Market Products
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
        jobsCreated: report.jobs.created,
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
