#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

console.log('\n🔧 Adding FK constraint via SQL query...\n');

const sql = `
-- Add FK from inventory_market_links.item_id to Inventory.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_inventory_market_links_item_id'
  ) THEN
    ALTER TABLE inventory_market_links
    ADD CONSTRAINT fk_inventory_market_links_item_id
    FOREIGN KEY (item_id)
    REFERENCES "Inventory"(id)
    ON DELETE CASCADE;

    RAISE NOTICE 'Added FK constraint';
  ELSE
    RAISE NOTICE 'FK already exists';
  END IF;
END $$;

-- Add index for join performance
CREATE INDEX IF NOT EXISTS idx_inventory_market_links_item_id
ON inventory_market_links(item_id);

SELECT 'Migration complete' as result;
`;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Execute via RPC (try different approaches)
try {
  // Try method 1: Direct query
  const { data, error } = await supabase.rpc('query', { query_text: sql });

  if (error) {
    console.log('RPC method failed, trying REST API...');

    // Method 2: Try via REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query_text: sql })
    });

    if (!response.ok) {
      throw new Error('Both methods failed. You need to run this SQL manually in Supabase Dashboard.');
    }
  }

  console.log('✅ FK constraint added successfully!\n');
  console.log('PostgREST can now join inventory_market_links with Inventory table.\n');
} catch (err) {
  console.error('\n❌ Auto-execution failed.');
  console.error('\nPlease run this SQL manually in Supabase Dashboard → SQL Editor:\n');
  console.log('─'.repeat(80));
  console.log(sql);
  console.log('─'.repeat(80));
  console.log('\n');
}
