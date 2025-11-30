// SOFT-RETIRED PAGE:
// This page is no longer part of the user flow.
// Listings are now managed via the Inventory page.
// Do NOT add new features here unless explicitly directed.

'use client'

/**
 * StockX Listings Page
 *
 * Comprehensive StockX listings management with three main sections:
 * 1. Active Listings - Current active listings with actions
 * 2. Rules - Auto-lower and match lowest ask rules
 * 3. History - Past listings (sold, expired, cancelled)
 */

import { useState, useMemo } from 'react'
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

  // Memoize filters to prevent infinite re-renders
  const filters = useMemo(() => ({
    status: activeTab === 'active' ? ['ACTIVE', 'PENDING'] : ['SOLD', 'EXPIRED', 'CANCELLED'],
  }), [activeTab])

  const { listings, loading, error, refetch } = useStockxListings(filters)

  const [syncing, setSyncing] = useState(false)

  const handleSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/stockx/sync-listings', {
        method: 'POST',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to sync listings')
      }

      // Show success toast with summary
      const summary = [
        `✅ Synced ${result.totalRemoteListings} listings from StockX`,
        result.updatedStatuses > 0 && `📝 Updated ${result.updatedStatuses} statuses`,
        result.markedMissing > 0 && `⚠️ Marked ${result.markedMissing} as missing`,
        result.warnings?.length > 0 && `⚠️ ${result.warnings.length} warnings`,
      ].filter(Boolean).join('\n')

      console.log('[StockX Sync] Success:', summary)

      // Refetch listings to show updated data
      await refetch()
    } catch (error: any) {
      console.error('[StockX Sync] Failed:', error)
      // Error will be shown via error state
    } finally {
      setSyncing(false)
    }
  }

  // Count active listings
  const activeListings = listings.filter(l => l.status === 'ACTIVE')
  const pendingListings = listings.filter(l => l.status === 'PENDING')

  return (
    <div className="mx-auto max-w-[1600px] px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-6 text-fg">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 p-6 rounded-2xl bg-gradient-to-br from-elev-1 to-elev-1/80 border-2 border-[#00FF94]/10 shadow-lg">
        <div className="flex-1">
          <h1 className="font-display text-3xl font-semibold text-fg tracking-tight mb-2">
            StockX Listings
          </h1>
          <p className="text-sm text-fg/70 max-w-2xl">
            Manage your active listings, rules, and history
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Sync Button */}
          <Button
            onClick={handleSync}
            disabled={syncing}
            variant="outline"
            size="default"
            className={cn(
              'transition-boutique shadow-soft border-border hover:border-[#00FF94]/60',
              syncing && 'cursor-wait opacity-75'
            )}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', syncing && 'animate-spin')} />
            <span>{syncing ? 'Syncing...' : 'Sync Listings'}</span>
          </Button>

          {/* Create Listing Button */}
          <Button
            size="default"
            className="bg-[#00FF94] hover:bg-[#00E085] text-black font-medium transition-all duration-120 shadow-soft"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Listing
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-gradient-to-br from-elev-1 to-elev-1/80 border-2 border-[#00FF94]/10 shadow-lg">
          <div className="text-xs font-medium text-muted uppercase tracking-wide">
            Active Listings
          </div>
          <div className="text-2xl font-bold text-fg mt-1 mono">
            {activeListings.length}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gradient-to-br from-elev-1 to-elev-1/80 border-2 border-[#00FF94]/10 shadow-lg">
          <div className="text-xs font-medium text-muted uppercase tracking-wide">
            Pending
          </div>
          <div className="text-2xl font-bold text-fg mt-1 mono">
            {pendingListings.length}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gradient-to-br from-elev-1 to-elev-1/80 border-2 border-[#00FF94]/10 shadow-lg">
          <div className="text-xs font-medium text-muted uppercase tracking-wide">
            Total Value
          </div>
          <div className="text-2xl font-bold text-fg mt-1 mono">
            £{activeListings.reduce((sum, l) => sum + (l.ask_price || 0), 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="bg-elev-0 border-2 border-border/40 shadow-sm">
            <TabsTrigger value="active" className="gap-2 data-[state=active]:bg-elev-1 data-[state=active]:text-fg">
              <TrendingUp className="h-4 w-4" />
              Active Listings
            </TabsTrigger>
            <TabsTrigger value="rules" className="gap-2 data-[state=active]:bg-elev-1 data-[state=active]:text-fg">
              <Settings className="h-4 w-4" />
              Rules
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-elev-1 data-[state=active]:text-fg">
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
