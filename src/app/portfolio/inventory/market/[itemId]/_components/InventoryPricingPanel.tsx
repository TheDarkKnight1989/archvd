'use client'

/**
 * InventoryPricingPanel - Pricing and P/L overview
 *
 * Shows:
 * - Purchase Price
 * - Market Value
 * - Unrealised P/L
 * - Performance %
 * - Listing Price (if listed)
 */

import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react'
import { PlainMoneyCell, MoneyCell, PercentCell } from '@/lib/format/money'
import { cn } from '@/lib/utils/cn'

interface InventoryPricingPanelProps {
  item: any
}

export function InventoryPricingPanel({ item }: InventoryPricingPanelProps) {
  const purchasePrice = item.purchase_price || 0
  const tax = item.tax || 0
  const shipping = item.shipping || 0
  const totalCost = purchasePrice + tax + shipping

  const marketValue = item.market_value || item.market?.price || 0
  const pl = marketValue - totalCost
  const performancePct = totalCost > 0 ? ((pl / totalCost) * 100) : null

  const listingPrice = item.stockx?.askPrice
  const isListed = !!item.stockx?.listingId && item.stockx?.listingStatus === 'ACTIVE'

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h3 className="text-lg font-semibold mb-4">Inventory & Pricing</h3>

      <div className="space-y-4">
        {/* Cost Breakdown */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted">Purchase Price</span>
            <span className="font-mono font-medium">
              <PlainMoneyCell value={purchasePrice} currency="GBP" />
            </span>
          </div>

          {(tax > 0 || shipping > 0) && (
            <>
              {tax > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted">Tax</span>
                  <span className="font-mono font-medium">
                    <PlainMoneyCell value={tax} currency="GBP" />
                  </span>
                </div>
              )}
              {shipping > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted">Shipping</span>
                  <span className="font-mono font-medium">
                    <PlainMoneyCell value={shipping} currency="GBP" />
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-border flex justify-between items-center text-sm">
                <span className="text-muted font-medium">Total Cost</span>
                <span className="font-mono font-bold">
                  <PlainMoneyCell value={totalCost} currency="GBP" />
                </span>
              </div>
            </>
          )}
        </div>

        {/* Market Value */}
        <div className="pt-4 border-t border-border">
          <div className="flex justify-between items-center mb-2">
            <span className="text-muted text-sm">Market Value</span>
            <span className="font-mono font-bold text-lg">
              <PlainMoneyCell value={marketValue} currency="GBP" />
            </span>
          </div>

          {/* P/L Display */}
          <div className="p-3 bg-soft/50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Unrealised P/L</span>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <MoneyCell value={pl} currency="GBP" />
                </div>
                {performancePct !== null && (
                  <div className="text-right">
                    <PercentCell value={performancePct} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Listing Price (if listed) */}
        {isListed && listingPrice && (
          <div className="pt-4 border-t border-border">
            <div className="flex justify-between items-center">
              <span className="text-muted text-sm">Ask Price (Listed)</span>
              <span className="font-mono font-medium text-green-500">
                <PlainMoneyCell value={listingPrice} currency="USD" />
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
