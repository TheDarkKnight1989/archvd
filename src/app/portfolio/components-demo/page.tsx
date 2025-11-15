'use client'

import { useState } from 'react'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { ActivityFeedItem, ActivityFeedItemSkeleton } from '@/components/ActivityFeedItem'
import { ReleaseCard, ReleaseCardSkeleton } from '@/components/ReleaseCard'
import { MarketModal } from '@/components/MarketModal'
import type { TimeRange } from '@/components/MarketModal'
import { SubscriptionRow, SubscriptionRowSkeleton } from '@/components/SubscriptionRow'
import { PackageRow, PackageRowSkeleton } from '@/components/PackageRow'
import { ColumnChooser } from '@/components/ColumnChooser'
import type { ColumnConfig } from '@/components/ColumnChooser'
import { SavedViewChip } from '@/components/SavedViewChip'
import { IntegrationCard, IntegrationCardSkeleton } from '@/components/IntegrationCard'
import { CurrencySwitcher } from '@/components/CurrencySwitcher'
import { Card } from '@/components/ui/card'

export default function ComponentsDemoPage() {
  useRequireAuth()

  // State for interactive components
  const [marketModalOpen, setMarketModalOpen] = useState(false)
  const [selectedSize, setSelectedSize] = useState('UK9')
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [columns, setColumns] = useState<ColumnConfig[]>([
    { key: 'sku', label: 'SKU', visible: true, lock: true },
    { key: 'brand', label: 'Brand', visible: true },
    { key: 'model', label: 'Model', visible: true },
    { key: 'size', label: 'Size', visible: false },
    { key: 'price', label: 'Price', visible: true },
    { key: 'status', label: 'Status', visible: false },
  ])

  const mockPriceSeries = [
    { date: '2025-10-01', price: 250 },
    { date: '2025-10-08', price: 260 },
    { date: '2025-10-15', price: 255 },
    { date: '2025-10-22', price: 270 },
    { date: '2025-10-29', price: 265 },
    { date: '2025-11-05', price: 280 },
  ]

  return (
    <div className="mx-auto max-w-[1400px] px-4 md:px-6 lg:px-8 py-6 space-y-8 text-fg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg relative inline-block">
            Matrix V2 - Phase 3 Components
            <span className="absolute bottom-0 left-0 w-20 h-0.5 bg-accent-400 opacity-40"></span>
          </h1>
          <p className="text-dim mt-2">
            Interactive showcase of all Matrix V2 Phase 3 components
          </p>
        </div>
        <CurrencySwitcher />
      </div>

      {/* ActivityFeedItem */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-fg">ActivityFeedItem</h2>
        <div className="grid gap-3">
          <ActivityFeedItem
            type="purchase"
            title="Purchased — Nike Dunk Low Panda UK9"
            subtitle="StockX"
            timestampISO="2025-11-08T10:30:00Z"
            amountGBP={120}
            tags={['sneaker', 'nike']}
          />
          <ActivityFeedItem
            type="sale"
            title="Sold — Air Jordan 1 Lost & Found UK9"
            subtitle="eBay"
            timestampISO="2025-11-07T15:00:00Z"
            amountGBP={280}
            deltaPct={15.5}
            highlight
            cta={{ label: 'View details', onClick: () => alert('View details') }}
          />
          <ActivityFeedItem
            type="price_alert"
            title="Price Alert — New Balance 550 dropped below £100"
            timestampISO="2025-11-08T09:00:00Z"
            amountGBP={95}
            deltaPct={-12.3}
          />
          <ActivityFeedItemSkeleton />
        </div>
      </section>

      {/* ReleaseCard */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-fg">ReleaseCard</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ReleaseCard
            imageUrl="https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop"
            name="Air Jordan 1 High OG"
            brand="Nike"
            colorway="Chicago Lost & Found"
            releaseDateISO="2025-11-15T09:00:00Z"
            priceGBP={169.99}
            sku="DZ5485-612"
            retailers={[
              { name: 'Nike', href: 'https://nike.com' },
              { name: 'Footlocker', href: 'https://footlocker.com' },
              { name: 'JD Sports' },
            ]}
            onRemind={() => alert('Reminder set!')}
            onSave={() => alert('Saved!')}
          />
          <ReleaseCard
            imageUrl="https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400&h=300&fit=crop"
            name="New Balance 550"
            brand="New Balance"
            colorway="White Navy"
            releaseDateISO="2025-11-20T09:00:00Z"
            priceGBP={120}
            sku="BB550WT1"
            retailers={[]}
            onRemind={() => alert('Reminder set!')}
          />
          <ReleaseCardSkeleton />
        </div>
      </section>

      {/* MarketModal Trigger */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-fg">MarketModal</h2>
        <Card elevation="soft" className="p-6">
          <button
            onClick={() => setMarketModalOpen(true)}
            className="px-4 py-2 bg-accent text-black rounded-lg font-medium hover:bg-accent-600 transition-all duration-120 glow-accent-hover"
          >
            Open Market Modal
          </button>
        </Card>
      </section>

      {/* SubscriptionRow */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-fg">SubscriptionRow</h2>
        <div className="space-y-3">
          <SubscriptionRow
            planName="Pro Plan"
            priceGBP={29}
            interval="mo"
            status="active"
            renewalDateISO="2025-12-08T00:00:00Z"
            seats={3}
            onManage={() => alert('Manage subscription')}
            onUpgrade={() => alert('Upgrade')}
          />
          <SubscriptionRow
            planName="Enterprise Plan"
            priceGBP={299}
            interval="yr"
            status="trial"
            renewalDateISO="2025-11-22T00:00:00Z"
            seats={10}
            onManage={() => alert('Manage subscription')}
          />
          <SubscriptionRowSkeleton />
        </div>
      </section>

      {/* PackageRow */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-fg">PackageRow</h2>
        <div className="space-y-3">
          <PackageRow
            carrier="RoyalMail"
            trackingId="RM123456789GB"
            status="in_transit"
            etaISO="2025-11-10T00:00:00Z"
            lastUpdateISO="2025-11-08T08:30:00Z"
            onTrack={() => alert('Track package')}
          />
          <PackageRow
            carrier="DPD"
            trackingId="DPD987654321UK"
            status="out_for_delivery"
            etaISO="2025-11-08T18:00:00Z"
            lastUpdateISO="2025-11-08T06:00:00Z"
            onTrack={() => alert('Track package')}
          />
          <PackageRow
            carrier="UPS"
            trackingId="1Z999AA10123456784"
            status="delivered"
            lastUpdateISO="2025-11-07T14:30:00Z"
          />
          <PackageRowSkeleton />
        </div>
      </section>

      {/* ColumnChooser & SavedViewChip */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-fg">ColumnChooser & SavedViewChip</h2>
        <Card elevation="soft" className="p-6">
          <div className="flex flex-wrap gap-3 items-center">
            <SavedViewChip
              label="In Stock"
              active
              onApply={() => alert('Apply In Stock filter')}
              onSave={() => alert('Save changes')}
              onDelete={() => alert('Delete view')}
            />
            <SavedViewChip
              label="High Value Items"
              onApply={() => alert('Apply High Value filter')}
            />
            <SavedViewChip
              label="Sold This Month"
              onApply={() => alert('Apply Sold This Month filter')}
              onDelete={() => alert('Delete view')}
            />
            <div className="ml-auto">
              <ColumnChooser
                columns={columns}
                onChange={(next) => {
                  setColumns((cols) =>
                    cols.map((col) => ({
                      ...col,
                      visible: next.find((n) => n.key === col.key)?.visible ?? col.visible,
                    }))
                  )
                }}
                defaultColumns={[
                  { key: 'sku', label: 'SKU', visible: true, lock: true },
                  { key: 'brand', label: 'Brand', visible: true },
                  { key: 'model', label: 'Model', visible: true },
                  { key: 'price', label: 'Price', visible: true },
                ]}
              />
            </div>
          </div>
          <div className="mt-4 text-sm text-dim">
            Visible columns: {columns.filter((c) => c.visible).map((c) => c.label).join(', ')}
          </div>
        </Card>
      </section>

      {/* IntegrationCard */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-fg">IntegrationCard</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <IntegrationCard
            provider="stockx"
            status="connected"
            accountLabel="user@example.com"
            onDisconnect={() => alert('Disconnect StockX')}
          />
          <IntegrationCard
            provider="goat"
            status="disconnected"
            onConnect={() => alert('Connect to GOAT')}
          />
          <IntegrationCard
            provider="ebay"
            status="error"
            accountLabel="seller123"
            onFix={() => alert('Fix eBay connection')}
          />
        </div>
      </section>

      {/* MarketModal */}
      <MarketModal
        open={marketModalOpen}
        onOpenChange={setMarketModalOpen}
        product={{
          name: 'Air Jordan 1 High OG',
          sku: 'DZ5485-612',
          brand: 'Nike',
          colorway: 'Chicago Lost & Found',
          imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop',
        }}
        sizes={['UK6', 'UK7', 'UK8', 'UK9', 'UK10', 'UK11', 'UK12']}
        activeSize={selectedSize}
        onSizeChange={setSelectedSize}
        range={timeRange}
        onRangeChange={setTimeRange}
        series={mockPriceSeries}
        sourceBadge="StockX"
        lastUpdatedISO="2025-11-08T10:00:00Z"
      />
    </div>
  )
}
