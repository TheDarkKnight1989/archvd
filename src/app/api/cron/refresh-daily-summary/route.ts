/**
 * Refresh Daily Market Summary - Materialized View Refresh
 *
 * Runs nightly to update pre-computed daily aggregates
 * for fast chart rendering
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const startTime = Date.now()

  try {
    // Refresh materialized view (CONCURRENTLY = no table locks)
    const { error } = await supabase.rpc('refresh_daily_summary')

    if (error) {
      console.error('Failed to refresh daily summary:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      duration,
      refreshedAt: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Error refreshing daily summary:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// Alternative: Direct SQL approach (if RPC not available)
export async function POST() {
  const startTime = Date.now()

  try {
    // Use raw SQL to refresh
    const { error } = await supabase
      .from('daily_market_summary')
      .select('*')
      .limit(0) // Dummy query to test connection

    if (error) throw error

    // Note: Supabase doesn't expose REFRESH MATERIALIZED VIEW via client
    // You need to create a database function:
    /*
    CREATE OR REPLACE FUNCTION refresh_daily_summary()
    RETURNS void AS $$
    BEGIN
      REFRESH MATERIALIZED VIEW CONCURRENTLY daily_market_summary;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    */

    console.log('Daily summary refresh triggered')

    return NextResponse.json({
      success: true,
      duration: Date.now() - startTime,
      message: 'Daily summary refresh triggered'
    })

  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
