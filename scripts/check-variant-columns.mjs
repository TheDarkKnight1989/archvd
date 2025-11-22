import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const VARIANT_ID = '1fa4b009-3f9f-47a8-84cb-90820427ab3b'

async function checkVariant() {
  console.log('🔍 Checking variant columns...\n')

  // Get ALL columns for this variant
  const { data: variant, error } = await supabase
    .from('stockx_variants')
    .select('*')
    .eq('stockx_variant_id', VARIANT_ID)
    .single()

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('ALL variant data:')
  console.log(JSON.stringify(variant, null, 2))
}

checkVariant()
