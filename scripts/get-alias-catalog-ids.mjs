import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Get catalog IDs that exist
const { data, error } = await supabase
  .from('inventory_v4_style_catalog')
  .select('alias_catalog_id')
  .not('alias_catalog_id', 'is', null)

if (error) {
  console.error('Error:', error.message)
  process.exit(1)
}

console.log(data.map(d => d.alias_catalog_id).join('\n'))
