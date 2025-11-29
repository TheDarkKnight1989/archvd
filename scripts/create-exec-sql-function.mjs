#!/usr/bin/env node

/**
 * Create the exec_sql helper function in Supabase
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

async function createExecSqlFunction() {
  console.log('\n🚀 Creating exec_sql helper function...\n');

  const createFnSQL = `
    CREATE OR REPLACE FUNCTION public.exec_sql(sql_query TEXT)
    RETURNS TEXT
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      EXECUTE sql_query;
      RETURN 'Success';
    EXCEPTION WHEN OTHERS THEN
      RETURN 'Error: ' || SQLERRM;
    END;
    $$;
  `;

  try {
    // Try using the REST API to execute SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: createFnSQL })
    });

    if (!response.ok) {
      console.error('❌ Failed to create exec_sql function via REST API');
      console.log('\n💡 Please create the function manually via Supabase Dashboard SQL Editor:');
      console.log(createFnSQL);
      process.exit(1);
    }

    console.log('✅ exec_sql function created successfully!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Please create the function manually via Supabase Dashboard SQL Editor:');
    console.log(createFnSQL);
    process.exit(1);
  }
}

createExecSqlFunction();
