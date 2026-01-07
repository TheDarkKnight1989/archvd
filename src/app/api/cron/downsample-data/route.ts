/**
 * Downsample Historical Data - Monthly Retention Job
 *
 * Runs monthly to downsample old data and save storage costs:
 * - Hourly data (< 3 months): Keep as-is
 * - Hourly data (> 3 months): Downsample to daily averages
 * - Daily data (> 1 year): Downsample to weekly averages
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
    // Calculate cutoff dates
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    const threeMonthsCutoff = threeMonthsAgo.toISOString().split('T')[0]

    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const oneYearCutoff = oneYearAgo.toISOString().split('T')[0]

    console.log('🗜️ Starting data downsampling...')
    console.log(`  3-month cutoff: ${threeMonthsCutoff}`)
    console.log(`  1-year cutoff: ${oneYearCutoff}`)

    // Step 1: Downsample hourly → daily (data older than 3 months)
    const { data: dailyResult, error: dailyError } = await supabase
      .rpc('downsample_to_daily', { cutoff_date: threeMonthsCutoff })

    if (dailyError) {
      console.error('Error downsampling to daily:', dailyError)
      return NextResponse.json(
        { success: false, error: dailyError.message },
        { status: 500 }
      )
    }

    const dailyRowsCreated = dailyResult || 0
    console.log(`✅ Created ${dailyRowsCreated} daily aggregate rows`)

    // Step 2: Downsample daily → weekly (data older than 1 year)
    const { data: weeklyResult, error: weeklyError } = await supabase
      .rpc('downsample_to_weekly', { cutoff_date: oneYearCutoff })

    if (weeklyError) {
      console.error('Error downsampling to weekly:', weeklyError)
      return NextResponse.json(
        { success: false, error: weeklyError.message },
        { status: 500 }
      )
    }

    const weeklyRowsCreated = weeklyResult || 0
    console.log(`✅ Created ${weeklyRowsCreated} weekly aggregate rows`)

    // Step 3: Check storage saved
    const { count: hourlyCount } = await supabase
      .from('master_market_data')
      .select('*', { count: 'exact', head: true })

    const { count: dailyCount } = await supabase
      .from('master_market_data_daily')
      .select('*', { count: 'exact', head: true })

    const { count: weeklyCount } = await supabase
      .from('master_market_data_weekly')
      .select('*', { count: 'exact', head: true })

    const duration = Date.now() - startTime

    const result = {
      success: true,
      duration,
      downsampled: {
        dailyRowsCreated,
        weeklyRowsCreated,
      },
      currentStorage: {
        hourlyRows: hourlyCount,
        dailyRows: dailyCount,
        weeklyRows: weeklyCount,
        totalRows: (hourlyCount || 0) + (dailyCount || 0) + (weeklyCount || 0),
      },
      cutoffDates: {
        threeMonthsCutoff,
        oneYearCutoff,
      },
      completedAt: new Date().toISOString(),
    }

    console.log('📊 Downsampling complete:', result)

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('Error during downsampling:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
