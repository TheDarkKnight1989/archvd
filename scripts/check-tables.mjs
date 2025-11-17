import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTables() {
  console.log('Checking StockX tables...\n')

  const tables = [
    'inventory_market_links',
    'stockx_sales',
    'stockx_market_prices',
    'stockx_listings',
    'stockx_accounts'
  ]

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1)

      if (error) {
        console.log(`❌ ${table}: ${error.message}`)
      } else {
        const columns = data && data.length > 0 ? Object.keys(data[0]).join(', ') : 'empty table'
        console.log(`✅ ${table}: ${columns}`)
      }
    } catch (err) {
      console.log(`❌ ${table}: ${err.message}`)
    }
  }
}

checkTables().catch(console.error)
