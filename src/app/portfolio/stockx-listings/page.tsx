'use client'

/**
 * StockX Listings Page
 *
 * Comprehensive StockX listings management with three main sections:
 * 1. Active Listings - Current active listings with actions
 * 2. Rules - Auto-lower and match lowest ask rules
 * 3. History - Past listings (sold, expired, cancelled)
 */

import { useState } from 'react'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useStockxListings } from '@/hooks/useStockxListings'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingUp, Settings, History, RefreshCw, Plus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { ActiveListingsSection } from './_components/ActiveListingsSection'
import { RulesSection } from './_components/RulesSection'
import { HistorySection } from './_components/HistorySection'

export default function StockXListingsPage() {
  const { user } = useRequireAuth()
  const [activeTab, setActiveTab] = useState<'active' | 'rules' | 'history'>('active')
  const { listings, loading, error, refetch } = useStockxListings({
    status: activeTab === 'active' ? ['ACTIVE', 'PENDING'] : ['SOLD', 'EXPIRED', 'CANCELLED'],
  })

  const [syncing, setSyncing] = useState(false)

  const handleSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/stockx/listings/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false, batchSize: 100 }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to sync' }))
        throw new Error(error.error || 'Failed to sync listings')
      }

      await refetch()
    } catch (error) {
      console.error('Failed to sync listings:', error)
    } finally {
      setSyncing(false)
    }
  }

  // Count active listings
  const activeListings = listings.filter(l => l.status === 'ACTIVE')
  const pendingListings = listings.filter(l => l.status === 'PENDING')

  return (
    <div className="min-h-screen bg-base">
      {/* Header */}
      <div className="border-b border-border bg-soft/30">
        <div className="max-w-[1800px] mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-fg">StockX Listings</h1>
              <p className="text-sm text-muted mt-1">
                Manage your active listings, rules, and history
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Sync Button */}
              <Button
                onClick={handleSync}
                disabled={syncing}
                variant="outline"
                size="sm"
                className={cn(
                  'gap-2 transition-all duration-120',
                  syncing && 'cursor-wait opacity-75'
                )}
              >
                <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
                <span>{syncing ? 'Syncing...' : 'Sync Listings'}</span>
              </Button>

              {/* Create Listing Button */}
              <Button
                size="sm"
                className="bg-[#00FF94] hover:bg-[#00E085] text-black font-medium gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Listing
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-elev-1 rounded-lg border border-border p-4">
              <div className="text-xs font-medium text-muted uppercase tracking-wide">
                Active Listings
              </div>
              <div className="text-2xl font-bold text-fg mt-1 mono">
                {activeListings.length}
              </div>
            </div>

            <div className="bg-elev-1 rounded-lg border border-border p-4">
              <div className="text-xs font-medium text-muted uppercase tracking-wide">
                Pending
              </div>
              <div className="text-2xl font-bold text-fg mt-1 mono">
                {pendingListings.length}
              </div>
            </div>

            <div className="bg-elev-1 rounded-lg border border-border p-4">
              <div className="text-xs font-medium text-muted uppercase tracking-wide">
                Total Value
              </div>
              <div className="text-2xl font-bold text-fg mt-1 mono">
                £{activeListings.reduce((sum, l) => sum + (l.ask_price || 0), 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1800px] mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="bg-soft/50 border border-border">
            <TabsTrigger value="active" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Active Listings
            </TabsTrigger>
            <TabsTrigger value="rules" className="gap-2">
              <Settings className="h-4 w-4" />
              Rules
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-6">
            <ActiveListingsSection
              listings={activeListings}
              loading={loading}
              onRefresh={refetch}
            />
          </TabsContent>

          <TabsContent value="rules" className="mt-6">
            <RulesSection />
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <HistorySection
              listings={listings.filter(l => ['SOLD', 'EXPIRED', 'CANCELLED'].includes(l.status))}
              loading={loading}
              onRefresh={refetch}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
