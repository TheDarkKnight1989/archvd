/**
 * V4 Market Page - Server Wrapper
 *
 * Handles SKU parsing and initial style lookup.
 * NEVER returns 404 - unknown SKUs get resolved client-side.
 *
 * V4 Tables Used:
 * - inventory_v4_style_catalog (lookup)
 */

import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { parseSkuFromSlug } from '@/lib/utils/slug'
import { MarketPageV4 } from './_components/MarketPageV4'

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{
    aliasId?: string
    stockxId?: string
    stockxUrlKey?: string
    name?: string
    brand?: string
    colorway?: string
    imageUrl?: string
  }>
}

// Style catalog row shape (V4 only)
interface StyleCatalogRow {
  style_id: string
  name: string | null
  brand: string | null
  colorway: string | null
  primary_image_url: string | null
  stockx_product_id: string | null
  alias_catalog_id: string | null
  created_at: string
  last_synced_at: string | null
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const sku = parseSkuFromSlug(slug)

  return {
    title: sku ? `${sku.toUpperCase()} | Market` : 'Market',
    description: sku ? `Market data for ${sku.toUpperCase()}` : 'Product market data',
  }
}

export default async function MarketV4Page({ params, searchParams }: PageProps) {
  const { slug } = await params
  const search = await searchParams

  // Parse SKU from slug
  const sku = parseSkuFromSlug(slug)

  if (!sku) {
    // Invalid slug format - show error but don't 404
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500">Invalid Product URL</h1>
          <p className="text-muted-foreground mt-2">
            Could not parse SKU from URL: {slug}
          </p>
        </div>
      </div>
    )
  }

  // Normalize SKU to uppercase
  const styleId = sku.toUpperCase()

  // Server-side style lookup (V4 only)
  const supabase = await createClient()
  const { data: style } = await supabase
    .from('inventory_v4_style_catalog')
    .select('style_id, name, brand, colorway, primary_image_url, stockx_product_id, alias_catalog_id, created_at, last_synced_at')
    .eq('style_id', styleId)
    .maybeSingle() as { data: StyleCatalogRow | null }

  // If style exists but no image, try to get from Alias products
  let aliasImageUrl: string | null = null
  if (style && !style.primary_image_url && style.alias_catalog_id) {
    const { data: aliasProduct } = await supabase
      .from('inventory_v4_alias_products')
      .select('main_picture_url')
      .eq('alias_catalog_id', style.alias_catalog_id)
      .maybeSingle()
    aliasImageUrl = aliasProduct?.main_picture_url || null
  }

  // Extract external IDs from search params (passed from search)
  const externalIds = {
    aliasCatalogId: search.aliasId || null,
    stockxProductId: search.stockxId || null,
    stockxUrlKey: search.stockxUrlKey || null,
  }

  // Extract product metadata from search params
  const productMeta = {
    name: search.name ? decodeURIComponent(search.name) : null,
    brand: search.brand ? decodeURIComponent(search.brand) : null,
    colorway: search.colorway ? decodeURIComponent(search.colorway) : null,
    imageUrl: search.imageUrl ? decodeURIComponent(search.imageUrl) : aliasImageUrl,
  }

  // Pass to client component - NEVER 404
  return (
    <MarketPageV4
      styleId={styleId}
      initialImageUrl={style?.primary_image_url || productMeta.imageUrl}
      initialName={style?.name || productMeta.name}
      initialBrand={style?.brand || productMeta.brand}
    />
  )
}
