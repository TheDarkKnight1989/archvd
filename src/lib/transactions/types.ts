/**
 * Transaction types for Buy & Sell history
 */

export type TransactionType = 'sale' | 'purchase'

export type TxRow = {
  id: string
  title: string
  subtitle: string        // "Size: UK9  •  DZ5485-612" or set/grade for cards
  imageUrl: string        // resolved via fallback chain
  qty: number
  purchasePrice?: number  // only for purchases table (unit)
  salePrice?: number      // only for sales table (unit)
  total: number
  fees: number
  realizedPL?: number     // sales: (sale - cost - fees)
  performancePct?: number // sales: realizedPL / cost * 100
  occurredAt: string
  platform?: string

  // Additional fields needed for edit modal
  unit_price: number      // raw unit price for editing
  sku: string | null
  size_uk: string | null
  image_url: string | null
  notes: string | null
  type: TransactionType
  user_id: string
  inventory_id: string | null
}

export type TxKpis = {
  // Sales KPIs
  totalSales?: number
  realizedGains?: number
  transactions?: number
  avgGainPct?: number

  // Purchase KPIs
  totalSpent?: number
  totalItems?: number
  uniqueProducts?: number
  recent7d?: number
}

export type TxHistoryResponse = {
  kpis: TxKpis
  rows: TxRow[]
}

export type Transaction = {
  id: string
  user_id: string
  type: TransactionType
  inventory_id: string | null
  sku: string | null
  size_uk: string | null
  title: string | null
  image_url: string | null
  qty: number
  unit_price: number
  fees: number
  total: number
  platform: string | null
  notes: string | null
  occurred_at: string
  created_at: string
  updated_at: string
}
