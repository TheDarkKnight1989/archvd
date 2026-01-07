'use client'

/**
 * Create Listing Tab
 *
 * Comprehensive listing creation with:
 * - Ask price input with smart suggestions
 * - Automation rules (match lowest, auto-lower, auto-match)
 * - Guards and limits (min profit margin, price floor)
 * - Fee calculation and net payout preview
 *
 * Supports both CREATE and REPRICE modes.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Target, Shield, Eye, Sparkles, Info, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { calculateListingFees } from '@/hooks/useStockxListings'
import { useUserSettings } from '@/hooks/useUserSettings'
import type { StockXListingModalItem } from '@/lib/inventory-v4/stockx-listing-adapter'

// =============================================================================
// TYPES
// =============================================================================

interface CreateListingTabProps {
  item: StockXListingModalItem
  currency: string
  onSubmit: (data: ListingFormData) => Promise<void>
  loading: boolean
  /** If true, modal is in reprice mode (updating existing listing) */
  isReprice?: boolean
}

export interface ListingFormData {
  askPrice: number
  matchLowestAsk: boolean
  instantSell: boolean
  autoLowerWeekly: boolean
  autoMatchPercent: number | null
  minProfitMargin: number | null
  minPriceFloor: number | null
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CreateListingTab({
  item,
  currency,
  onSubmit,
  loading,
  isReprice = false,
}: CreateListingTabProps) {
  // Fetch user settings for seller level
  const { settings } = useUserSettings()

  // Extract market data from typed item
  const lowestAsk = item.lowestAsk
  const highestBid = item.highestBid
  const invested = item.purchasePrice ?? 0

  // Form state - pre-fill with existing price if repricing
  const [askPrice, setAskPrice] = useState(
    isReprice && item.existingListing
      ? item.existingListing.listed_price.toFixed(0)
      : ''
  )
  const [matchLowestAsk, setMatchLowestAsk] = useState(false)
  const [instantSell, setInstantSell] = useState(false)
  const [autoLowerWeekly, setAutoLowerWeekly] = useState(false)
  const [autoMatchPercent, setAutoMatchPercent] = useState('')
  const [minProfitMargin, setMinProfitMargin] = useState('')
  const [minPriceFloor, setMinPriceFloor] = useState('')

  // Calculate fees and net payout using user's seller level
  const askPriceNum = parseFloat(askPrice) || 0
  const sellerLevel = settings?.stockx_seller_level || 1
  const fees = calculateListingFees(askPriceNum, sellerLevel)
  const netPayout = fees.netPayout
  const profit = netPayout - invested
  const profitMargin = invested > 0 ? (profit / invested) * 100 : 0

  // Format currency
  const formatPrice = (amount: number | null): string => {
    if (amount === null) return 'N/A'
    const symbol =
      currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : ''
    return `${symbol}${amount.toFixed(0)}`
  }

  // Handle quick suggestion clicks
  // StockX only accepts whole numbers, so we round accordingly
  const applySuggestion = (price: number, roundDown: boolean = false) => {
    // Round down for discounts (Beat by 5%) to ensure we actually beat the competition
    // Round to nearest for exact matches (Match Lowest Ask, Instant Sell)
    const roundedPrice = roundDown ? Math.floor(price) : Math.round(price)
    setAskPrice(roundedPrice.toFixed(0))
    setMatchLowestAsk(false)
    setInstantSell(false)
  }

  // Handle submit
  const handleSubmit = async () => {
    await onSubmit({
      askPrice: askPriceNum,
      matchLowestAsk,
      instantSell,
      autoLowerWeekly,
      autoMatchPercent: autoMatchPercent ? parseFloat(autoMatchPercent) : null,
      minProfitMargin: minProfitMargin ? parseFloat(minProfitMargin) : null,
      minPriceFloor: minPriceFloor ? parseFloat(minPriceFloor) : null,
    })
  }

  // CTA button text
  const ctaText = loading
    ? isReprice
      ? 'Updating Price...'
      : 'Creating Listing...'
    : isReprice
      ? 'Update Price'
      : 'List on StockX'

  return (
    <div className="space-y-6">
      {/* Ask Price Input */}
      <div className="space-y-2">
        <Label htmlFor="askPrice" className="text-sm font-semibold text-fg">
          {isReprice ? 'New Ask Price' : 'Ask Price'} ({currency})
        </Label>
        <Input
          id="askPrice"
          type="number"
          step="0.01"
          min="0"
          placeholder={`Enter your ask price in ${currency}`}
          value={askPrice}
          onChange={(e) => setAskPrice(e.target.value)}
          required
          disabled={loading}
          className="text-lg font-medium mono"
        />
      </div>

      {/* Smart Suggestions */}
      {(lowestAsk || highestBid) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-fg uppercase tracking-wide">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Smart Suggestions
          </div>
          <div className="grid grid-cols-3 gap-2">
            {/* Match Lowest Ask */}
            {lowestAsk && (
              <button
                onClick={() => applySuggestion(lowestAsk)}
                className="px-3 py-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/10 border-2 border-blue-500/50 hover:bg-blue-500/30 hover:border-blue-500 transition-all duration-120 text-left shadow-lg shadow-blue-500/10"
              >
                <div className="text-xs text-muted mb-1 font-medium">Match Lowest Ask</div>
                <div className="text-sm font-bold text-blue-400 mono">{formatPrice(lowestAsk)}</div>
              </button>
            )}

            {/* Beat by 5% */}
            {lowestAsk && (
              <button
                onClick={() => applySuggestion(lowestAsk * 0.95, true)}
                className="px-3 py-2.5 rounded-xl bg-gradient-to-br from-accent/20 to-accent/10 border-2 border-accent/50 hover:bg-accent/30 hover:border-accent transition-all duration-120 text-left shadow-lg shadow-accent/10"
              >
                <div className="text-xs text-muted mb-1 font-medium">Beat by 5%</div>
                <div className="text-sm font-bold text-accent mono">
                  {formatPrice(Math.floor(lowestAsk * 0.95))}
                </div>
              </button>
            )}

            {/* Instant Sell */}
            {highestBid && (
              <button
                onClick={() => applySuggestion(highestBid)}
                className="px-3 py-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 border-2 border-emerald-500/50 hover:bg-emerald-500/30 hover:border-emerald-500 transition-all duration-120 text-left shadow-lg shadow-emerald-500/10"
              >
                <div className="text-xs text-muted mb-1 font-medium">Instant Sell</div>
                <div className="text-sm font-bold text-emerald-400 mono">
                  {formatPrice(highestBid)}
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Automation Rules */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-fg uppercase tracking-wide">
          <Target className="h-3.5 w-3.5 text-accent" />
          Automation Rules
        </div>

        <div className="space-y-3 rounded-xl bg-gradient-to-br from-elev-1 to-elev-1/80 border-2 border-accent/20 shadow-lg p-4">
          {/* Match Lowest Ask */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <Checkbox
              checked={matchLowestAsk}
              onCheckedChange={(checked) => setMatchLowestAsk(checked as boolean)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-fg group-hover:text-[#00FF94] transition-colors">
                Match lowest ask automatically
              </div>
              <div className="text-xs text-muted mt-0.5">
                Keep your listing competitive by matching the market&apos;s lowest ask price
              </div>
            </div>
          </label>

          {/* Instant Sell Instead */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <Checkbox
              checked={instantSell}
              onCheckedChange={(checked) => setInstantSell(checked as boolean)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-fg group-hover:text-[#00FF94] transition-colors">
                Instant sell instead
              </div>
              <div className="text-xs text-muted mt-0.5">
                List at highest bid price for immediate sale (subject to fees)
              </div>
            </div>
          </label>

          {/* Auto-lower weekly */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <Checkbox
              checked={autoLowerWeekly}
              onCheckedChange={(checked) => setAutoLowerWeekly(checked as boolean)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-fg group-hover:text-[#00FF94] transition-colors">
                Auto-lower weekly
              </div>
              <div className="text-xs text-muted mt-0.5">
                Reduce your ask price by 3% each week to increase sell probability
              </div>
            </div>
          </label>

          {/* Auto-match ± X% */}
          <div className="space-y-2">
            <label className="flex items-start gap-3">
              <Checkbox
                checked={!!autoMatchPercent}
                onCheckedChange={(checked) => setAutoMatchPercent(checked ? '2' : '')}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-fg">Auto-match lowest ask ± %</div>
                <div className="text-xs text-muted mt-0.5 mb-2">
                  Stay within a percentage range of the market&apos;s lowest ask
                </div>
                {autoMatchPercent && (
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={autoMatchPercent}
                    onChange={(e) => setAutoMatchPercent(e.target.value)}
                    placeholder="2"
                    className="max-w-[100px] text-sm"
                    disabled={loading}
                  />
                )}
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Guards & Limits */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-fg uppercase tracking-wide">
          <Shield className="h-3.5 w-3.5 text-accent" />
          Guards & Limits
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Min Profit Margin */}
          <div className="space-y-1.5">
            <Label htmlFor="minProfitMargin" className="text-xs text-muted">
              Min Profit Margin (%)
            </Label>
            <Input
              id="minProfitMargin"
              type="number"
              step="1"
              min="0"
              value={minProfitMargin}
              onChange={(e) => setMinProfitMargin(e.target.value)}
              placeholder="15"
              className="text-sm"
              disabled={loading}
            />
          </div>

          {/* Min Price Floor */}
          <div className="space-y-1.5">
            <Label htmlFor="minPriceFloor" className="text-xs text-muted">
              Min Price Floor ({currency})
            </Label>
            <Input
              id="minPriceFloor"
              type="number"
              step="1"
              min="0"
              value={minPriceFloor}
              onChange={(e) => setMinPriceFloor(e.target.value)}
              placeholder={invested > 0 ? invested.toFixed(0) : '0'}
              className="text-sm"
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {/* Fee Breakdown */}
      {askPriceNum > 0 && (
        <div className="rounded-xl bg-gradient-to-br from-elev-1 to-elev-1/80 border-2 border-accent/20 shadow-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-fg uppercase tracking-wide">
            <Info className="h-3.5 w-3.5 text-accent" />
            Fee Breakdown
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">Ask Price:</span>
              <span className="font-semibold mono text-fg">{formatPrice(askPriceNum)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted">
                Transaction Fee ({(fees.transactionFeeRate * 100).toFixed(1)}%):
              </span>
              <span className="font-medium mono text-red-400">
                -{formatPrice(fees.transactionFee)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted">
                Processing Fee ({(fees.processingFeeRate * 100).toFixed(1)}%):
              </span>
              <span className="font-medium mono text-red-400">
                -{formatPrice(fees.processingFee)}
              </span>
            </div>

            <div className="border-t border-border pt-2 flex items-center justify-between">
              <span className="font-semibold text-fg">Net Payout:</span>
              <span className="font-bold text-lg mono text-[#00FF94]">
                {formatPrice(netPayout)}
              </span>
            </div>

            {invested > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted">Profit:</span>
                <span
                  className={cn(
                    'font-semibold mono',
                    profit >= 0 ? 'text-[#00FF94]' : 'text-red-400'
                  )}
                >
                  {profit >= 0 ? '+' : ''}
                  {formatPrice(profit)} ({profitMargin.toFixed(1)}%)
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          onClick={handleSubmit}
          disabled={loading || !askPrice || askPriceNum <= 0}
          className="flex-1 h-12 bg-[#00FF94] hover:bg-[#00E085] text-black font-bold text-base shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-120"
        >
          {isReprice && <RefreshCw className="h-4 w-4 mr-2" />}
          {ctaText}
        </Button>

        <Button
          variant="outline"
          disabled={loading}
          className="gap-2 h-12 border-2 border-[#00FF94]/50 text-[#00FF94] hover:bg-[#00FF94]/20 hover:border-[#00FF94] font-semibold transition-all duration-120"
        >
          <Eye className="h-4 w-4" />
          Preview
        </Button>
      </div>

      {/* Educational Note */}
      <div className="rounded-xl bg-gradient-to-br from-accent/20 to-accent/10 border-2 border-accent/40 shadow-lg shadow-accent/10 p-4">
        <p className="text-xs text-fg leading-relaxed">
          <span className="font-bold text-accent">Note:</span> Automation rules are saved but not
          yet active. Full automation features coming soon. For now, your listing will be{' '}
          {isReprice ? 'updated' : 'created'} at the specified ask price.
        </p>
      </div>
    </div>
  )
}
