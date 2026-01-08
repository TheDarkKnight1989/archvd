/**
 * Apply RLS policy for inventory_v4_sync_queue
 */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function applyRLS() {
  console.log('Checking inventory_v4_sync_queue table access...')

  // Service role should bypass RLS, so let's check the table exists
  const { data, error } = await supabase
    .from('inventory_v4_sync_queue')
    .select('id')
    .limit(1)

  if (error) {
    console.log('Error:', error.message)
    if (error.code === '42P01') {
      console.log('Table does not exist - create it first')
      return
    }
  } else {
    console.log('Table exists and is accessible via service role')
  }

  // Print SQL for manual execution in Supabase Dashboard
  console.log('\n========================================')
  console.log('Run this SQL in Supabase Dashboard SQL Editor:')
  console.log('========================================\n')
  console.log(`
-- Enable RLS on sync queue table
ALTER TABLE inventory_v4_sync_queue ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Users can read sync queue status" ON inventory_v4_sync_queue;

-- Allow authenticated users to read sync queue status
CREATE POLICY "Users can read sync queue status"
  ON inventory_v4_sync_queue
  FOR SELECT
  TO authenticated
  USING (true);
`)
}

applyRLS()
