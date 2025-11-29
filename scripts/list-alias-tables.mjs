import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🔍 Checking Alias-related tables in database...\n')

// Try to list tables
const { data, error } = await supabase.rpc('exec_sql', {
  sql: `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE '%alias%'
    ORDER BY table_name;
  `
})

if (error) {
  console.error('Error:', error)
} else {
  console.log('Alias-related tables:')
  console.log(data)
}

// Also check inventory_alias_links specifically
const { data: links, error: linksError } = await supabase
  .from('inventory_alias_links')
  .select('*')
  .limit(1)

if (linksError) {
  console.error('\n❌ inventory_alias_links error:', linksError)
} else {
  console.log('\n✅ inventory_alias_links exists')
  if (links && links.length > 0) {
    console.log('Sample row:', links[0])
  }
}
