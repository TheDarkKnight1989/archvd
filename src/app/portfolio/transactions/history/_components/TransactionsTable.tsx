'use client'

import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import { MoreVertical } from 'lucide-react'
import type { TxRow } from '@/lib/transactions/types'
import Image from 'next/image'
import { PlainMoneyCell, MoneyCell, PercentCell } from '@/lib/format/money'
import { Badge } from '@/components/ui/badge'

interface TransactionsTableProps {
  rows: TxRow[]
  loading: boolean
  type: 'sales' | 'purchases'
  onEdit: (row: TxRow) => void
}

export function TransactionsTable({ rows, loading, type, onEdit }: TransactionsTableProps) {
  const { convert, format } = useCurrency()

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="bg-elev-1 border border-border rounded-lg p-8 text-center">
        <div className="text-dim">Loading transactions...</div>
      </div>
    )
  }

  if (rows.length === 0) {
    return null // Empty state handled by parent
  }

  return (
    <div className="bg-elev-1 border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-elev-2 to-elev-2/80 border-b border-border/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Item
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                Qty
              </th>
              {type === 'sales' ? (
                <>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                    Sale Price
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                    Fees
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                    Realized P/L
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                    Performance
                  </th>
                </>
              ) : (
                <>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                    Purchase Price
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                    Fees
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                    Total
                  </th>
                </>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Platform
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, index) => (
              <tr
                key={row.id}
                className={cn(
                  'transition-all duration-200 hover:bg-elev-2 hover:shadow-lg hover:shadow-accent/5 group',
                  index % 2 === 0 ? 'bg-elev-1' : 'bg-bg'
                )}
              >
                {/* Date */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm text-fg">{formatDate(row.occurredAt)}</div>
                </td>

                {/* Item */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 rounded-md overflow-hidden bg-elev-2 flex-shrink-0">
                      <Image
                        src={row.imageUrl}
                        alt={row.title}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-fg truncate">{row.title}</div>
                      {row.subtitle && (
                        <div className="text-xs text-muted truncate">{row.subtitle}</div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Qty */}
                <td className="px-4 py-3 text-right">
                  <div className="text-sm text-fg font-mono">{row.qty}</div>
                </td>

                {/* Price */}
                <td className="px-4 py-3 text-right">
                  <PlainMoneyCell
                    value={convert(type === 'sales' ? (row.salePrice || 0) : (row.purchasePrice || 0), 'GBP')}
                  />
                </td>

                {/* Fees */}
                <td className="px-4 py-3 text-right">
                  <PlainMoneyCell value={convert(row.fees, 'GBP')} />
                </td>

                {/* Total */}
                <td className="px-4 py-3 text-right">
                  <PlainMoneyCell value={convert(row.total, 'GBP')} />
                </td>

                {/* Sales-specific columns */}
                {type === 'sales' && (
                  <>
                    {/* Realized P/L */}
                    <td className="px-4 py-3 text-right">
                      <MoneyCell
                        value={convert(row.realizedPL || 0, 'GBP')}
                        showArrow={true}
                      />
                    </td>

                    {/* Performance % */}
                    <td className="px-4 py-3 text-right">
                      <PercentCell value={row.performancePct} />
                    </td>
                  </>
                )}

                {/* Platform */}
                <td className="px-4 py-3">
                  {row.platform ? (
                    <Badge variant="outline" className="text-xs font-normal">
                      {row.platform}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted">—</span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onEdit(row)}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent/10 hover:border hover:border-accent/30 transition-all opacity-0 group-hover:opacity-100"
                    title="Edit transaction"
                  >
                    <MoreVertical className="h-4 w-4 text-accent" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
