// @ts-nocheck
import pg from 'pg'
import 'dotenv/config'

const { Client } = pg

async function refreshView() {
  console.log('=== Refreshing Portfolio Materialized View ===\n')

  // Parse DATABASE_URL from Supabase
  const dbUrl = process.env.DATABASE_URL

  if (!dbUrl) {
    console.error('❌ DATABASE_URL not found in environment')
    return
  }

  const client = new Client({
    connectionString: dbUrl
  })

  try {
    await client.connect()
    console.log('✅ Connected to database\n')

    // Run REFRESH MATERIALIZED VIEW (without CONCURRENTLY for first time)
    console.log('Refreshing portfolio_value_daily...')
    await client.query('REFRESH MATERIALIZED VIEW portfolio_value_daily;')
    console.log('✅ Successfully refreshed portfolio_value_daily\n')

    // Verify the view now has data
    console.log('Verifying portfolio_value_daily...')
    const result = await client.query('SELECT * FROM portfolio_value_daily LIMIT 1;')

    if (result.rows.length > 0) {
      console.log('✅ Portfolio view populated successfully')
      console.log('Columns:', Object.keys(result.rows[0]))
      console.log('\nSample row:', JSON.stringify(result.rows[0], null, 2))
    } else {
      console.log('⚠️  View is now accessible but contains no data (may be expected if no inventory exists)')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await client.end()
  }
}

refreshView().catch(console.error)
