#!/usr/bin/env node

/**
 * Refresh the stockx_market_latest materialized view
 */

import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set')
  process.exit(1)
}

async function refreshView() {
  console.log('\n🔄 Refreshing stockx_market_latest materialized view...')

  const pool = new pg.Pool({ connectionString: DATABASE_URL })

  try {
    await pool.query('REFRESH MATERIALIZED VIEW stockx_market_latest')
    console.log('✅ View refreshed successfully\n')
  } catch (err) {
    console.error('❌ Failed to refresh view:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

refreshView().catch(console.error)
