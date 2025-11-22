/**
 * Product Market Page - Individual item view with market data and management
 *
 * Route: /portfolio/inventory/market/[itemId]
 *
 * Sections (8 total):
 * 1. Header - Product details (image, brand, model, SKU, size, condition)
 * 2. StockX Market Data - Lowest Ask, Highest Bid, Sales volume, etc.
 * 3. Inventory & Pricing - Purchase price, market value, P/L, listing price
 * 4. Condition & Notes - Edit condition + notes (existing logic)
 * 5. Listing & Platform Info - Listing status, expires at, platform details
 * 6. Performance Graphs - P/L over time, price history (placeholder)
 * 7. Purchase History - Purchase details, order info, receipt tracking
 * 8. Alerts - Price alerts, market notifications (placeholder)
 */

import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductMarketHeader } from './_components/ProductMarketHeader'
import { StockXMarketPanel } from './_components/StockXMarketPanel'
import { InventoryPricingPanel } from './_components/InventoryPricingPanel'
import { ConditionNotesPanel } from './_components/ConditionNotesPanel'
import { ListingPlatformPanel } from './_components/ListingPlatformPanel'
import { AlertsPanel } from './_components/AlertsPanel'

interface PageProps {
  params: {
    itemId: string
  }
}

async function getItemData(itemId: string) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  // Fetch item with enriched data
  const { data: item, error } = await supabase
    .from('enriched_inventory_items')
    .select('*')
    .eq('id', itemId)
    .single()

  if (error || !item) {
    return null
  }

  return item
}

export default async function ProductMarketPage({ params }: PageProps) {
  const item = await getItemData(params.itemId)

  if (!item) {
    notFound()
  }

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      {/* Back Button */}
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/portfolio/inventory" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Inventory
          </Link>
        </Button>
      </div>

      {/* Header Section */}
      <Suspense fallback={<Skeleton className="h-32 w-full" />}>
        <ProductMarketHeader item={item} />
      </Suspense>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* StockX Market Data Panel */}
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <StockXMarketPanel item={item} />
          </Suspense>

          {/* Inventory & Pricing Panel */}
          <Suspense fallback={<Skeleton className="h-48 w-full" />}>
            <InventoryPricingPanel item={item} />
          </Suspense>

          {/* Purchase History Panel */}
          <div className="p-6 bg-card rounded-lg border border-border">
            <h3 className="text-lg font-semibold mb-4">Purchase History</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Purchase Date</span>
                <span className="font-medium mono">
                  {item.purchase_date
                    ? new Date(item.purchase_date).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Place of Purchase</span>
                <span className="font-medium">{item.place_of_purchase || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Order Number</span>
                <span className="font-medium mono">{item.order_number || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Condition & Notes Panel */}
          <Suspense fallback={<Skeleton className="h-48 w-full" />}>
            <ConditionNotesPanel item={item} />
          </Suspense>

          {/* Listing & Platform Info Panel */}
          <Suspense fallback={<Skeleton className="h-48 w-full" />}>
            <ListingPlatformPanel item={item} />
          </Suspense>

          {/* Alerts Panel (Placeholder) */}
          <Suspense fallback={<Skeleton className="h-48 w-full" />}>
            <AlertsPanel item={item} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
