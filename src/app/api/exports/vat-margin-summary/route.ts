import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get month parameter
    const searchParams = request.nextUrl.searchParams
    const month = searchParams.get('month')

    if (!month) {
      return NextResponse.json({ error: 'Month parameter required' }, { status: 400 })
    }

    // Fetch VAT summary from vat_margin_monthly_view
    const { data: summary, error: fetchError } = await supabase
      .from('vat_margin_monthly_view')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', month)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Failed to fetch VAT summary data:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
    }

    // Build CSV with summary row
    const headers = [
      'Month',
      'Number of Sales',
      'Total Sales (£)',
      'Total Margin (£)',
      'Taxable Margin (£)',
      'VAT Due (£)',
      'Average Margin %',
    ]

    const totalSales = summary?.total_sales || 0
    const totalMargin = summary?.total_margin || 0
    const taxableMargin = summary?.taxable_margin || 0
    const vatDue = summary?.vat_due || 0
    const numSales = summary?.num_sales || 0
    const avgMarginPct = totalSales > 0 ? ((totalMargin / totalSales) * 100).toFixed(2) : '0.00'

    const monthFormatted = new Date(month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

    const row = [
      monthFormatted,
      numSales.toString(),
      totalSales.toFixed(2),
      totalMargin.toFixed(2),
      taxableMargin.toFixed(2),
      vatDue.toFixed(2),
      avgMarginPct,
    ]

    const csv = [headers.join(','), row.map((cell) => `"${cell}"`).join(',')].join('\n')

    // Return CSV with proper headers
    const monthFilename = new Date(month).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).replace(' ', '_')
    const filename = `vat_summary_${monthFilename}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Export VAT summary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
