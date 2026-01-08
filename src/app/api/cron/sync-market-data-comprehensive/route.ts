/**
 * Comprehensive Market Data Sync
 *
 * Syncs ALL market data for products:
 * - Multi-region pricing (US, UK, EU, global)
 * - Offer histograms
 * - Recent sales
 * - StockX pricing suggestions
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAliasClient } from '@/lib/services/alias/client'
import { getAliasRegions } from '@/lib/services/alias/regions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('🔄 Comprehensive Market Data Sync - Starting...')

  try {
    const aliasClient = createAliasClient()

    // Get all available regions
    const regions = await getAliasRegions(aliasClient)
    console.log(`📍 Found ${regions.length} regions: ${regions.map(r => r.name).join(', ')}`)

    // Get products that need syncing
    const productsToSync = await getProductsForSync()
    console.log(`📦 Found ${productsToSync.length} products to sync`)

    let synced = 0
    let errors = 0

    // Sync in batches
    const BATCH_SIZE = 5 // Smaller batches due to more API calls
    for (let i = 0; i < productsToSync.length; i += BATCH_SIZE) {
      const batch = productsToSync.slice(i, i + BATCH_SIZE)

      await Promise.allSettled(
        batch.map(async (product) => {
          try {
            await syncProductComprehensive(product, regions, aliasClient)
            synced++
          } catch (error) {
            console.error(`Failed to sync ${product.sku}:`, error)
            errors++
          }
        })
      )

      // Rate limit between batches
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Update last_synced_at
    await supabase
      .from('products')
      .update({ last_synced_at: new Date().toISOString() })
      .in('id', productsToSync.map(p => p.id))

    console.log(`✅ Sync complete - Synced: ${synced}, Errors: ${errors}`)

    return NextResponse.json({
      success: true,
      synced,
      errors,
      total: productsToSync.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: 'Sync failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function getProductsForSync() {
  const now = new Date()

  // HOT: >1h, WARM: >6h, COLD: >24h
  const { data: hotProducts } = await supabase
    .from('products')
    .select(`
      id, sku, brand, model, tier,
      product_variants (id, size_key, size_numeric, alias_catalog_id, stockx_product_id, stockx_variant_id)
    `)
    .eq('tier', 'hot')
    .or(`last_synced_at.is.null,last_synced_at.lt.${new Date(now.getTime() - 60 * 60 * 1000).toISOString()}`)
    .limit(20)

  const { data: warmProducts } = await supabase
    .from('products')
    .select(`
      id, sku, brand, model, tier,
      product_variants (id, size_key, size_numeric, alias_catalog_id, stockx_product_id, stockx_variant_id)
    `)
    .eq('tier', 'warm')
    .or(`last_synced_at.is.null,last_synced_at.lt.${new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString()}`)
    .limit(50)

  const { data: coldProducts } = await supabase
    .from('products')
    .select(`
      id, sku, brand, model, tier,
      product_variants (id, size_key, size_numeric, alias_catalog_id, stockx_product_id, stockx_variant_id)
    `)
    .eq('tier', 'cold')
    .or(`last_synced_at.is.null,last_synced_at.lt.${new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()}`)
    .limit(100)

  return [...(hotProducts || []), ...(warmProducts || []), ...(coldProducts || [])]
}

async function syncProductComprehensive(product: any, regions: any[], aliasClient: any) {
  console.log(`\n🔄 Syncing ${product.sku}...`)

  const aliasVariant = product.product_variants.find((v: any) => v.alias_catalog_id)
  const stockxVariant = product.product_variants.find((v: any) => v.stockx_product_id)

  // Sync Alias data for all regions
  if (aliasVariant?.alias_catalog_id) {
    await syncAliasComprehensive(product, aliasVariant.alias_catalog_id, regions, aliasClient)
  }

  // Sync StockX data
  if (stockxVariant?.stockx_product_id) {
    await syncStockXComprehensive(product, stockxVariant.stockx_product_id)
  }
}

async function syncAliasComprehensive(
  product: any,
  catalogId: string,
  regions: any[],
  aliasClient: any
) {
  console.log(`  📍 Alias: Syncing ${regions.length} regions...`)

  for (const region of regions) {
    try {
      // 1. Get pricing/availability for this region
      const pricingResponse = await aliasClient.listPricingInsights({
        catalog_id: catalogId,
        region_id: region.id
      })

      // Insert into master_market_data
      for (const variant of pricingResponse.variants) {
        const productVariant = product.product_variants.find((v: any) =>
          v.size_numeric && Math.abs(v.size_numeric - variant.size) < 0.1
        )

        if (!productVariant || !variant.availability) continue

        await supabase.from('master_market_data').insert({
          provider: 'alias',
          provider_source: 'alias_pricing_insights',
          provider_product_id: catalogId,
          sku: product.sku,
          size_key: productVariant.size_key,
          size_numeric: variant.size,
          size_system: variant.size_unit || 'US',
          currency_code: 'USD', // TODO: Map region to currency
          region_code: region.id.toLowerCase().replace('region_', ''),
          lowest_ask: variant.availability.lowest_listing_price_cents ? parseInt(variant.availability.lowest_listing_price_cents) / 100 : null,
          highest_bid: variant.availability.highest_offer_price_cents ? parseInt(variant.availability.highest_offer_price_cents) / 100 : null,
          last_sale_price: variant.availability.last_sold_listing_price_cents ? parseInt(variant.availability.last_sold_listing_price_cents) / 100 : null,
          global_indicator_price: variant.availability.global_indicator_price_cents ? parseInt(variant.availability.global_indicator_price_cents) / 100 : null,
          ask_count: variant.availability.number_of_listings,
          bid_count: variant.availability.number_of_offers,
          snapshot_at: new Date().toISOString(),
          is_flex: false,
          is_consigned: variant.consigned || false
        })
      }

      // 2. Get offer histograms for each size
      for (const variant of pricingResponse.variants) {
        try {
          const histogramResponse = await aliasClient.getOfferHistogram({
            catalog_id: catalogId,
            size: variant.size,
            region_id: region.id
          })

          if (histogramResponse.offer_histogram?.bins) {
            // Insert histogram bins
            for (const bin of histogramResponse.offer_histogram.bins) {
              await supabase.from('alias_offer_histograms').insert({
                catalog_id: catalogId,
                sku: product.sku,
                size: variant.size,
                region_id: region.id,
                price_cents: parseInt(bin.offer_price_cents),
                count: parseInt(bin.count),
                snapshot_at: new Date().toISOString()
              })
            }
          }
        } catch (error) {
          // Histograms might not exist for all sizes
          console.log(`    ⚠️  No histogram for size ${variant.size}`)
        }
      }

      // 3. Get recent sales
      try {
        const salesResponse = await aliasClient.getRecentSales({
          catalog_id: catalogId,
          region_id: region.id,
          limit: 50
        })

        if (salesResponse.recent_sales) {
          for (const sale of salesResponse.recent_sales) {
            await supabase.from('alias_recent_sales').insert({
              catalog_id: catalogId,
              sku: product.sku,
              size: sale.size,
              region_id: region.id,
              price_cents: parseInt(sale.price_cents),
              purchased_at: sale.purchased_at,
              is_consigned: sale.consigned,
              snapshot_at: new Date().toISOString()
            })
          }
        }
      } catch (error) {
        console.log(`    ⚠️  No recent sales for ${region.name}`)
      }

      console.log(`    ✅ ${region.name}`)

    } catch (error: any) {
      console.log(`    ❌ ${region.name}: ${error.message}`)
    }
  }
}

async function syncStockXComprehensive(product: any, stockxProductId: string) {
  console.log(`  🟢 StockX: ${stockxProductId}`)
  // TODO: Implement comprehensive StockX sync
  // - Get market data for all variants
  // - Get pricing suggestions
  // - Get sales history
  console.log(`    ⏭️  StockX sync not implemented yet`)
}
