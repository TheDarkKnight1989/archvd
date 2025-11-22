import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('Checking stockx_latest_prices table...')
const { data, error, count } = await supabase
  .from('stockx_latest_prices')
  .select('*', { count: 'exact', head: true })

if (error) {
  console.error('Error:', error)
} else {
  console.log(`✓ stockx_latest_prices table has ${count} rows`)
}

// Also check stockx_market_latest
console.log('\nChecking stockx_market_latest view...')
const { data: data2, error: error2, count: count2 } = await supabase
  .from('stockx_market_latest')
  .select('*', { count: 'exact', head: true })

if (error2) {
  console.error('Error checking stockx_market_latest:', error2)
} else {
  console.log(`✓ stockx_market_latest view has ${count2} rows`)
}

// Check if there's any data for the Panda Dunk
console.log('\nChecking for Nike Dunk Panda DD1391-100...')
const { data: pandaData, error: pandaError } = await supabase
  .from('stockx_latest_prices')
  .select('*')
  .eq('sku', 'DD1391-100')
  .limit(5)

if (pandaError) {
  console.error('Error:', pandaError)
} else if (pandaData && pandaData.length > 0) {
  console.log(`✓ Found ${pandaData.length} price records:`)
  pandaData.forEach(row => {
    console.log(`  Size ${row.size}: Last Sale = ${row.last_sale}, Lowest Ask = ${row.lowest_ask}`)
  })
} else {
  console.log('✗ No price data found for DD1391-100')
}
