import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Check if products table exists
const { data, error } = await supabase
  .from('products')
  .select('*')
  .limit(1)

if (error) {
  console.error('products table error:', error.message)
} else {
  console.log('✅ products table exists')
  console.log('Columns:', Object.keys(data[0] || {}))
}
