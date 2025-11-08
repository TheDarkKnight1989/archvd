/**
 * P&L and VAT types matching Supabase view columns
 */

export type PnLItemRow = {
  user_id: string
  item_id: string
  sku: string
  brand: string
  model: string
  size: string
  buy_price: number
  sale_price: number
  sold_date: string // ISO date
  margin_gbp: number
  vat_due_gbp: number
  platform: string | null
}

export type PnLMonthRow = {
  user_id: string
  month: string // YYYY-MM-DD from view
  revenue: number
  cogs: number
  gross_profit: number
  expenses: number
  net_profit: number
}

export type VATMonthRow = {
  user_id: string
  month: string
  total_sales: number
  total_margin: number
  vat_due: number
}
