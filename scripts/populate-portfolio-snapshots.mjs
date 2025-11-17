#!/usr/bin/env node

/**
 * Daily Portfolio Snapshots Population Script
 *
 * Populates portfolio_snapshots table with daily metrics for all users.
 * Designed to run as a cron job once per day.
 *
 * Usage:
 *   node scripts/populate-portfolio-snapshots.mjs
 *
 * Environment:
 *   Requires DATABASE_URL or Supabase credentials in .env
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('[Snapshot] Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
})

/**
 * Get all active users
 */
async function getActiveUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, currency_pref')
    .order('id')

  if (error) {
    console.error('[Snapshot] Error fetching users:', error.message)
    return []
  }

  return data || []
}

/**
 * Calculate portfolio metrics for a user
 */
async function calculatePortfolioMetrics(userId, currency) {
  try {
    // Fetch portfolio overview (reusing existing logic)
    const overviewRes = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL}/api/portfolio/overview?currency=${currency}`,
      {
        headers: {
          'X-User-ID': userId, // For service role bypass
        }
      }
    )

    if (!overviewRes.ok) {
      // Fall back to direct DB queries
      return await calculateMetricsDirectly(userId, currency)
    }

    const overview = await overviewRes.json()

    // Fetch reports data
    const today = new Date()
    const firstOfYear = new Date(today.getFullYear(), 0, 1)

    const reportsRes = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL}/api/portfolio/reports?currency=${currency}&from=${firstOfYear.toISOString().split('T')[0]}&to=${today.toISOString().split('T')[0]}`,
      {
        headers: {
          'X-User-ID': userId,
        }
      }
    )

    const reports = reportsRes.ok ? await reportsRes.json() : {}

    return {
      total_value: overview.kpis?.estimatedValue || 0,
      invested: overview.kpis?.invested || 0,
      unrealised_pl: overview.kpis?.unrealisedPL || 0,
      net_profit: reports.netProfit || 0,
      sales_income: reports.salesIncome || 0,
      item_spend: reports.totalSpend || 0,
      subscription_spend: reports.subscriptionSpend || 0,
      expense_spend: reports.expenseSpend || 0,
      total_spend: reports.totalSpend || 0,
      items_purchased: reports.itemsPurchased || 0,
      items_sold: reports.itemsSold || 0,
    }
  } catch (error) {
    console.error(`[Snapshot] Error calculating metrics for user ${userId}:`, error.message)
    return null
  }
}

/**
 * Calculate metrics directly from database (fallback)
 */
async function calculateMetricsDirectly(userId, currency) {
  try {
    // Get active inventory
    const { data: inventory, error: invError } = await supabase
      .from('Inventory')
      .select('purchase_total')
      .eq('user_id', userId)
      .eq('status', 'active')

    if (invError) throw invError

    const invested = inventory?.reduce((sum, item) =>
      sum + (parseFloat(item.purchase_total) || 0), 0) || 0

    // Get sold items (YTD)
    const today = new Date()
    const firstOfYear = new Date(today.getFullYear(), 0, 1)

    const { data: sales, error: salesError } = await supabase
      .from('Inventory')
      .select('sold_price, purchase_total, tax, shipping, sales_fee')
      .eq('user_id', userId)
      .eq('status', 'sold')
      .gte('sold_date', firstOfYear.toISOString())

    if (salesError) throw salesError

    const salesIncome = sales?.reduce((sum, item) =>
      sum + (parseFloat(item.sold_price) || 0), 0) || 0

    const itemSpend = sales?.reduce((sum, item) =>
      sum + (parseFloat(item.purchase_total) || 0), 0) || 0

    // Get active subscriptions (prorate for YTD)
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('amount, interval, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (subError) throw subError

    // Calculate days in period
    const daysDiff = Math.ceil((today.getTime() - firstOfYear.getTime()) / (1000 * 60 * 60 * 24))
    const monthsInPeriod = daysDiff / 30.44

    let subscriptionSpend = 0
    subscriptions?.forEach((sub) => {
      let monthlyCost = 0
      if (sub.interval === 'monthly') {
        monthlyCost = sub.amount
      } else if (sub.interval === 'annual') {
        monthlyCost = sub.amount / 12
      }
      subscriptionSpend += monthlyCost * monthsInPeriod
    })

    // Expenses = purchase expenses (tax + shipping) + sales fees
    const purchaseExpenses = sales?.reduce((sum, item) =>
      sum + ((item.tax || 0) + (item.shipping || 0)), 0) || 0

    const salesFees = sales?.reduce((sum, item) =>
      sum + (item.sales_fee || 0), 0) || 0

    const expenseSpend = purchaseExpenses + salesFees

    const totalSpend = itemSpend + subscriptionSpend

    // For portfolio value, we'd need market data
    // For now, use invested as approximation (cron should use real API)
    const totalValue = invested // Placeholder
    const unrealisedPL = totalValue - invested
    const netProfit = salesIncome - totalSpend - salesFees

    return {
      total_value: totalValue,
      invested,
      unrealised_pl: unrealisedPL,
      net_profit: netProfit,
      sales_income: salesIncome,
      item_spend: itemSpend,
      subscription_spend: subscriptionSpend,
      expense_spend: expenseSpend,
      total_spend: totalSpend,
      items_purchased: inventory?.length || 0,
      items_sold: sales?.length || 0,
    }
  } catch (error) {
    console.error(`[Snapshot] Direct calculation error:`, error.message)
    return null
  }
}

/**
 * Upsert snapshot for a user
 */
async function upsertSnapshot(userId, currency, metrics) {
  const today = new Date().toISOString().split('T')[0]

  const { error } = await supabase
    .from('portfolio_snapshots')
    .upsert({
      user_id: userId,
      date: today,
      currency,
      ...metrics,
    }, {
      onConflict: 'user_id,date,currency'
    })

  if (error) {
    console.error(`[Snapshot] Upsert error for user ${userId}:`, error.message)
    return false
  }

  return true
}

/**
 * Main execution
 */
async function main() {
  console.log('[Snapshot] Starting daily portfolio snapshot population...')
  console.log('[Snapshot] Date:', new Date().toISOString().split('T')[0])

  const users = await getActiveUsers()
  console.log(`[Snapshot] Found ${users.length} users`)

  let successCount = 0
  let errorCount = 0

  for (const user of users) {
    const currency = user.currency_pref || 'GBP'
    console.log(`[Snapshot] Processing user ${user.id} (${currency})...`)

    const metrics = await calculatePortfolioMetrics(user.id, currency)

    if (!metrics) {
      console.error(`[Snapshot] Failed to calculate metrics for user ${user.id}`)
      errorCount++
      continue
    }

    const success = await upsertSnapshot(user.id, currency, metrics)

    if (success) {
      console.log(`[Snapshot] ✓ User ${user.id}: ${currency} snapshot saved`)
      successCount++
    } else {
      errorCount++
    }
  }

  console.log(`[Snapshot] Complete: ${successCount} succeeded, ${errorCount} failed`)
  process.exit(errorCount > 0 ? 1 : 0)
}

main().catch(error => {
  console.error('[Snapshot] Fatal error:', error)
  process.exit(1)
})
