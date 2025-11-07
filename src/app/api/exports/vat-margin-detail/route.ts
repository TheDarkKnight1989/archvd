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

    // Fetch sold items from vat_margin_detail_view
    const { data: items, error: fetchError } = await supabase
      .from('vat_margin_detail_view')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', month)
      .order('sold_date', { ascending: true })

    if (fetchError) {
      console.error('Failed to fetch VAT detail data:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
    }

    // Build CSV with VAT-specific columns
    const headers = [
      'Date',
      'SKU',
      'Brand',
      'Model',
      'Size',
      'Purchase Price (£)',
      'Sold Price (£)',
      'Margin (£)',
      'Margin %',
      'Taxable (Y/N)',
      'VAT Due (£)',
      'Platform',
    ]

    const rows = items.map((item: any) => {
      const margin = item.margin || 0
      const purchasePrice = item.purchase_price || 0
      const marginPct = purchasePrice > 0 ? ((margin / purchasePrice) * 100).toFixed(2) : '0.00'
      const taxable = margin > 0 ? 'Y' : 'N'

      return [
        item.sold_date || '',
        item.sku || '',
        item.brand || '',
        item.model || '',
        item.size || '',
        (purchasePrice).toFixed(2),
        (item.sold_price || 0).toFixed(2),
        margin.toFixed(2),
        marginPct,
        taxable,
        (item.vat_due || 0).toFixed(2),
        item.platform || '',
      ]
    })

    const csv = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n')

    // Return CSV with proper headers
    const monthFormatted = new Date(month).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).replace(' ', '_')
    const filename = `vat_margin_detail_${monthFormatted}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Export VAT detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
