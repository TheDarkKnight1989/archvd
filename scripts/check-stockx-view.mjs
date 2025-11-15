/**
 * Check stockx_latest_prices view
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })
dotenv.config({ path: join(__dirname, '..', '.env') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('📊 CHECKING stockx_latest_prices VIEW\n')

const { data, error } = await supabase
  .from('stockx_latest_prices')
  .select('*')

if (error) {
  console.error('❌ Error:', error)
  process.exit(1)
}

console.log(`✓ View returned ${data.length} rows\n`)

data.forEach(row => {
  console.log(`${row.sku} size ${row.size}: Ask $${row.lowest_ask} | Bid $${row.highest_bid} | Last $${row.last_sale}`)
})

console.log('\n✅ View is working!')
