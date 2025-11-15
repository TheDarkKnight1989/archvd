/**
 * Check StockX Setup
 * Verifies OAuth connection and provides setup guidance
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSetup() {
  console.log('🔍 Checking StockX Setup...\n')

  // Check environment variables
  console.log('📋 Environment Configuration:')
  console.log(`  NEXT_PUBLIC_STOCKX_ENABLE: ${process.env.NEXT_PUBLIC_STOCKX_ENABLE}`)
  console.log(`  NEXT_PUBLIC_STOCKX_MOCK: ${process.env.NEXT_PUBLIC_STOCKX_MOCK}`)
  console.log(`  STOCKX_API_BASE_URL: ${process.env.STOCKX_API_BASE_URL ? '✓' : '✗'}`)
  console.log(`  STOCKX_CLIENT_ID: ${process.env.STOCKX_CLIENT_ID ? '✓' : '✗'}`)
  console.log(`  STOCKX_CLIENT_SECRET: ${process.env.STOCKX_CLIENT_SECRET ? '✓' : '✗'}`)
  console.log(`  STOCKX_API_KEY: ${process.env.STOCKX_API_KEY ? '✓' : '✗'}`)
  console.log()

  // Check OAuth accounts
  const { data: accounts, error } = await supabase
    .from('stockx_accounts')
    .select('user_id, account_email, created_at, expires_at')

  if (error) {
    console.error('❌ Error fetching StockX accounts:', error.message)
    return
  }

  if (!accounts || accounts.length === 0) {
    console.log('⚠️  No StockX accounts connected\n')
    console.log('📝 To connect your StockX account:')
    console.log('  1. Navigate to: http://localhost:3000/portfolio/settings/integrations')
    console.log('  2. Click "Connect StockX" button')
    console.log('  3. Complete OAuth authorization flow')
    console.log('  4. Come back and run this script again\n')
    return
  }

  console.log(`✓ Found ${accounts.length} connected StockX account(s):\n`)
  accounts.forEach((account, idx) => {
    console.log(`  ${idx + 1}. ${account.account_email}`)
    console.log(`     User ID: ${account.user_id}`)
    console.log(`     Connected: ${new Date(account.created_at).toLocaleString()}`)
    console.log(`     Expires: ${new Date(account.expires_at).toLocaleString()}`)
    console.log()
  })

  // Check inventory count
  const { count: inventoryCount } = await supabase
    .from('Inventory')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  console.log(`📦 Active Inventory Items: ${inventoryCount}`)

  // Check market products
  const { count: marketProductsCount } = await supabase
    .from('market_products')
    .select('*', { count: 'exact', head: true })
    .eq('provider', 'stockx')

  console.log(`🏷️  StockX Market Products: ${marketProductsCount}`)

  // Check market prices
  const { count: marketPricesCount } = await supabase
    .from('market_prices')
    .select('*', { count: 'exact', head: true })
    .eq('provider', 'stockx')

  console.log(`💰 StockX Market Prices: ${marketPricesCount}`)

  // Check inventory links
  const { count: linksCount } = await supabase
    .from('inventory_market_links')
    .select('*', { count: 'exact', head: true })
    .eq('provider', 'stockx')

  console.log(`🔗 Inventory → Market Links: ${linksCount}\n`)

  if (accounts.length > 0 && inventoryCount && inventoryCount > 0) {
    console.log('✅ Ready to sync! Run the following command:')
    console.log('   curl -X POST http://localhost:3000/api/stockx/sync/complete')
  }
}

checkSetup().catch(console.error)
