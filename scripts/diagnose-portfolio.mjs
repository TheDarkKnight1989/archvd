import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function diagnose() {
  console.log('🔍 PORTFOLIO DIAGNOSIS\n')
  console.log('=' .repeat(60))

  // 1. Check if there's any inventory data
  console.log('\n1️⃣  Checking Inventory table...')
  const { data: inventory, error: invError } = await supabase
    .from('Inventory')
    .select('id, sku, brand, model, status')
    .limit(5)

  if (invError) {
    console.log('❌ Error:', invError.message)
  } else {
    console.log(`✅ Found ${inventory?.length || 0} items (showing first 5)`)
    if (inventory && inventory.length > 0) {
      console.table(inventory)
    } else {
      console.log('   📭 No inventory items found - this is why portfolio is empty!')
    }
  }

  // 2. Check total count
  const { count, error: countError } = await supabase
    .from('Inventory')
    .select('*', { count: 'exact', head: true })

  if (!countError) {
    console.log(`   Total inventory items: ${count || 0}`)
  }

  // 3. Check if portfolio overview API works
  console.log('\n2️⃣  Testing portfolio overview API...')
  const { data: user } = await supabase.auth.admin.listUsers()
  const userId = user?.users?.[0]?.id

  if (userId) {
    console.log(`   User ID: ${userId}`)

    const { data: overview, error: overviewError } = await supabase
      .rpc('get_portfolio_overview_v2', { p_currency: 'GBP' })

    if (overviewError) {
      console.log('   ❌ Overview function error:', overviewError.message)
    } else {
      console.log('   ✅ Overview function works')
      console.log('   Data:', JSON.stringify(overview, null, 2))
    }
  } else {
    console.log('   ⚠️  No users found')
  }

  // 4. Check StockX tables
  console.log('\n3️⃣  Checking StockX tables...')
  const stockxTables = [
    'inventory_market_links',
    'stockx_listings',
    'stockx_batch_job_items'
  ]

  for (const table of stockxTables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.log(`   ❌ ${table}: ${error.message}`)
    } else {
      console.log(`   ✅ ${table}: ${count || 0} rows`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n💡 RECOMMENDATIONS:')

  if (!inventory || inventory.length === 0) {
    console.log('   • Portfolio is empty because there are no inventory items')
    console.log('   • Add some items first before testing portfolio features')
  } else {
    console.log('   • You have inventory data, so the issue is likely in the UI/API')
    console.log('   • Check browser console for specific errors')
  }
}

diagnose().catch(console.error)
