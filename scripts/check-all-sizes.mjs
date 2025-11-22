import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

console.log('Checking DD1391-100 all sizes...\n')

const { data, error } = await supabase
  .from('stockx_latest_prices')
  .select('*')
  .eq('sku', 'DD1391-100')
  .order('as_of', { ascending: false })

if (error) {
  console.error('Error:', error)
} else if (data && data.length > 0) {
  console.log(`Found ${data.length} price records:\n`)
  data.forEach((row, idx) => {
    console.log(`Record ${idx + 1}:`)
    console.log(`  Currency: ${row.currency}`)
    console.log(`  Size: ${row.size}`)
    console.log(`  Last Sale: ${row.last_sale || 'N/A'}`)
    console.log(`  Lowest Ask: ${row.lowest_ask || 'N/A'}`)
    console.log(`  Highest Bid: ${row.highest_bid || 'N/A'}`)
    console.log(`  As Of: ${row.as_of}`)
    console.log('')
  })
} else {
  console.log('No price data found')
}
