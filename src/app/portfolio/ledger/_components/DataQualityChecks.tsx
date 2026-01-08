/**
 * Data Quality Checks Component
 * Identifies issues in sales data and provides actionable insights
 */

'use client'

import { useMemo } from 'react'
import { AlertCircle, CheckCircle, AlertTriangle, Info, Copy, DollarSign, Calendar, Tag } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { SalesItem } from '@/hooks/useSalesTable'

interface DataQualityChecksProps {
  items: SalesItem[]
  className?: string
}

interface QualityIssue {
  id: string
  type: 'error' | 'warning' | 'info'
  category: 'missing_data' | 'duplicate' | 'incomplete'
  message: string
  count: number
  itemIds: string[]
}

export function DataQualityChecks({ items, className }: DataQualityChecksProps) {
  // Analyze data quality
  const qualityAnalysis = useMemo(() => {
    const issues: QualityIssue[] = []
    const seenSkus = new Map<string, string[]>() // SKU -> item IDs

    // Track various issues
    const missingPurchasePrice: string[] = []
    const missingPlatform: string[] = []
    const missingFees: string[] = []
    const missingSoldDate: string[] = []

    items.forEach((item) => {
      // Check for missing purchase price
      if (!item.purchase_price || item.purchase_price === 0) {
        missingPurchasePrice.push(item.id)
      }

      // Check for missing platform
      if (!item.platform) {
        missingPlatform.push(item.id)
      }

      // Check for missing fees on marketplace sales
      if (item.platform && ['stockx', 'goat', 'alias', 'ebay'].includes(item.platform.toLowerCase())) {
        if (!item.sales_fee || item.sales_fee === 0) {
          missingFees.push(item.id)
        }
      }

      // Check for missing sold date
      if (!item.sold_date) {
        missingSoldDate.push(item.id)
      }

      // Check for duplicate SKUs sold on same date
      if (item.sku && item.sold_date) {
        const key = `${item.sku}-${item.sold_date}`
        if (!seenSkus.has(key)) {
          seenSkus.set(key, [])
        }
        seenSkus.get(key)!.push(item.id)
      }
    })

    // Add issues
    if (missingPurchasePrice.length > 0) {
      issues.push({
        id: 'missing-purchase-price',
        type: 'error',
        category: 'missing_data',
        message: 'Sales missing purchase price (can\'t calculate profit)',
        count: missingPurchasePrice.length,
        itemIds: missingPurchasePrice,
      })
    }

    if (missingPlatform.length > 0) {
      issues.push({
        id: 'missing-platform',
        type: 'warning',
        category: 'missing_data',
        message: 'Sales missing platform information',
        count: missingPlatform.length,
        itemIds: missingPlatform,
      })
    }

    if (missingFees.length > 0) {
      issues.push({
        id: 'missing-fees',
        type: 'warning',
        category: 'missing_data',
        message: 'Marketplace sales missing fee information',
        count: missingFees.length,
        itemIds: missingFees,
      })
    }

    if (missingSoldDate.length > 0) {
      issues.push({
        id: 'missing-sold-date',
        type: 'error',
        category: 'missing_data',
        message: 'Sales missing sold date',
        count: missingSoldDate.length,
        itemIds: missingSoldDate,
      })
    }

    // Check for duplicates
    const duplicates: string[] = []
    seenSkus.forEach((itemIds) => {
      if (itemIds.length > 1) {
        duplicates.push(...itemIds)
      }
    })

    if (duplicates.length > 0) {
      issues.push({
        id: 'duplicate-sales',
        type: 'info',
        category: 'duplicate',
        message: 'Potential duplicate sales (same SKU sold on same date)',
        count: duplicates.length,
        itemIds: duplicates,
      })
    }

    // Calculate data completeness score
    const totalFields = items.length * 4 // purchase_price, platform, fees (for marketplace), sold_date
    const missingFields = missingPurchasePrice.length + missingPlatform.length + missingFees.length + missingSoldDate.length
    const completeness = items.length > 0 ? ((totalFields - missingFields) / totalFields) * 100 : 100

    return {
      issues,
      completeness: Math.max(0, Math.min(100, completeness)),
      totalSales: items.length,
      healthySales: items.length - new Set([...missingPurchasePrice, ...missingSoldDate]).size,
    }
  }, [items])

  if (items.length === 0) {
    return null
  }

  const hasIssues = qualityAnalysis.issues.length > 0

  return (
    <div className={cn('bg-elev-1 border border-border/40 rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-fg uppercase tracking-wide mb-1 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[#00FF94]" />
            Data Quality
          </h3>
          <p className="text-xs text-muted">
            Health checks for your sales data
          </p>
        </div>

        {/* Completeness Score */}
        <div className="text-right">
          <div className="text-xs text-dim uppercase tracking-wide mb-1">Completeness</div>
          <div className={cn(
            "text-2xl font-bold mono",
            qualityAnalysis.completeness >= 90 ? "text-[#00FF94]" :
            qualityAnalysis.completeness >= 70 ? "text-amber-400" :
            "text-red-400"
          )}>
            {qualityAnalysis.completeness.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Overall Status */}
      <div className={cn(
        "flex items-center gap-2 p-3 rounded-lg mb-4",
        hasIssues ? "bg-amber-500/10 border border-amber-500/30" : "bg-[#00FF94]/10 border border-[#00FF94]/30"
      )}>
        {hasIssues ? (
          <>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <div className="flex-1 text-xs">
              <span className="font-semibold text-amber-400">
                {qualityAnalysis.issues.length} issue{qualityAnalysis.issues.length !== 1 ? 's' : ''} found
              </span>
              <span className="text-muted ml-2">
                • {qualityAnalysis.healthySales}/{qualityAnalysis.totalSales} sales are complete
              </span>
            </div>
          </>
        ) : (
          <>
            <CheckCircle className="h-4 w-4 text-[#00FF94]" />
            <div className="flex-1 text-xs">
              <span className="font-semibold text-[#00FF94]">All sales data looks good!</span>
              <span className="text-muted ml-2">
                No data quality issues detected
              </span>
            </div>
          </>
        )}
      </div>

      {/* Issues List */}
      {hasIssues && (
        <div className="space-y-2">
          {qualityAnalysis.issues.map((issue) => {
            const Icon = issue.type === 'error' ? AlertCircle :
                       issue.type === 'warning' ? AlertTriangle : Info

            const color = issue.type === 'error' ? 'red' :
                         issue.type === 'warning' ? 'amber' : 'blue'

            return (
              <div
                key={issue.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg bg-elev-0 border transition-all hover:border-opacity-100",
                  issue.type === 'error' && "border-red-500/30 hover:border-red-500/50",
                  issue.type === 'warning' && "border-amber-500/30 hover:border-amber-500/50",
                  issue.type === 'info' && "border-blue-500/30 hover:border-blue-500/50"
                )}
              >
                <Icon className={cn(
                  "h-4 w-4 mt-0.5",
                  issue.type === 'error' && "text-red-400",
                  issue.type === 'warning' && "text-amber-400",
                  issue.type === 'info' && "text-blue-400"
                )} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-fg">{issue.message}</span>
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold mono",
                      issue.type === 'error' && "bg-red-500/20 text-red-400",
                      issue.type === 'warning' && "bg-amber-500/20 text-amber-400",
                      issue.type === 'info' && "bg-blue-500/20 text-blue-400"
                    )}>
                      {issue.count}
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    {issue.type === 'error' && 'Fix these issues to ensure accurate profit calculations'}
                    {issue.type === 'warning' && 'These sales have incomplete data that may affect reporting'}
                    {issue.type === 'info' && 'Review these sales to confirm they are not duplicates'}
                  </p>
                </div>

                {issue.category === 'missing_data' && (
                  <div className="flex items-center gap-1 text-xs text-muted">
                    {issue.id === 'missing-purchase-price' && <DollarSign className="h-3.5 w-3.5" />}
                    {issue.id === 'missing-platform' && <Tag className="h-3.5 w-3.5" />}
                    {issue.id === 'missing-fees' && <DollarSign className="h-3.5 w-3.5" />}
                    {issue.id === 'missing-sold-date' && <Calendar className="h-3.5 w-3.5" />}
                  </div>
                )}

                {issue.category === 'duplicate' && (
                  <Copy className="h-3.5 w-3.5 text-blue-400" />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Help Text */}
      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-400 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-blue-400 mb-1">How to fix issues</p>
            <p className="text-muted leading-relaxed">
              Click the <span className="font-bold">•••</span> menu on any sale and select <span className="font-bold">Edit Sale</span> to update missing information.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
