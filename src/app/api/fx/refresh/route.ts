import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/fx/refresh
 *
 * Fetches latest GBP/EUR exchange rates and updates the database.
 * This can be called manually or via a cron job.
 *
 * Uses exchangerate-api.com free tier (1500 requests/month)
 * Alternative: European Central Bank API (no key required)
 */
export async function POST(request: Request) {
  try {
    // Verify authorization (optional - add API key check if needed)
    const authHeader = request.headers.get('authorization')
    const apiKey = process.env.CRON_SECRET

    if (apiKey && authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Initialize Supabase client with service role for write access
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Fetch live rates from exchangerate-api.com
    const exchangeApiKey = process.env.EXCHANGE_RATE_API_KEY
    let gbpPerEur: number
    let gbpPerUsd: number
    let source: string

    if (exchangeApiKey) {
      // Use exchangerate-api.com (requires API key)
      // Fetch GBP as base currency to get EUR and USD rates
      const response = await fetch(
        `https://v6.exchangerate-api.com/v6/${exchangeApiKey}/latest/GBP`
      )

      if (!response.ok) {
        throw new Error(`Exchange rate API error: ${response.status}`)
      }

      const data = await response.json()

      if (data.result !== 'success') {
        throw new Error(`Exchange rate API returned: ${data.result}`)
      }

      // GBP to EUR and USD rates
      const eurPerGbp = data.conversion_rates.EUR
      const usdPerGbp = data.conversion_rates.USD

      // We store GBP per EUR and GBP per USD (inverse rates)
      gbpPerEur = 1.0 / eurPerGbp
      gbpPerUsd = 1.0 / usdPerGbp
      source = 'exchangerate-api.com'
    } else {
      // Fallback: Use exchangerate.host API (free, no key required)
      const response = await fetch(
        'https://api.exchangerate.host/latest?base=GBP&symbols=EUR,USD'
      )

      if (!response.ok) {
        throw new Error(`Exchange rate API error: ${response.status}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error('Exchange rate API request failed')
      }

      // Get EUR and USD per GBP, then calculate inverses
      const eurPerGbp = data.rates.EUR
      const usdPerGbp = data.rates.USD

      gbpPerEur = 1.0 / eurPerGbp
      gbpPerUsd = 1.0 / usdPerGbp
      source = 'exchangerate.host'
    }

    // Validate rates (sanity checks)
    if (gbpPerEur < 0.7 || gbpPerEur > 1.0) {
      throw new Error(`Invalid GBP/EUR rate: ${gbpPerEur}. Expected between 0.7 and 1.0`)
    }
    if (gbpPerUsd < 0.5 || gbpPerUsd > 1.0) {
      throw new Error(`Invalid GBP/USD rate: ${gbpPerUsd}. Expected between 0.5 and 1.0`)
    }

    // Get today's date (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0]

    // Calculate inverse rates for response
    const eurPerGbp = 1.0 / gbpPerEur
    const usdPerGbp = 1.0 / gbpPerUsd

    // Update or insert rate
    const { data: upsertData, error: upsertError } = await supabase
      .from('fx_rates')
      .upsert({
        as_of: today,
        gbp_per_eur: gbpPerEur.toFixed(6),
        usd_per_gbp: usdPerGbp.toFixed(6),
        meta: {
          source,
          fetched_at: new Date().toISOString(),
          raw_rates: {
            gbp_per_eur: gbpPerEur,
            gbp_per_usd: gbpPerUsd,
            eur_per_gbp: eurPerGbp,
            usd_per_gbp: usdPerGbp,
          },
        },
      })
      .select()
      .single()

    if (upsertError) {
      throw new Error(`Database error: ${upsertError.message}`)
    }

    return NextResponse.json({
      success: true,
      date: today,
      rates: {
        gbp_per_eur: parseFloat(gbpPerEur.toFixed(6)),
        eur_per_gbp: parseFloat(eurPerGbp.toFixed(6)),
        gbp_per_usd: parseFloat(gbpPerUsd.toFixed(6)),
        usd_per_gbp: parseFloat(usdPerGbp.toFixed(6)),
      },
      source,
      updated_at: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[FX Refresh] Error:', error.message)

    return NextResponse.json(
      {
        error: 'Failed to refresh FX rates',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/fx/refresh
 *
 * Returns the latest FX rates from the database (no update)
 */
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error } = await supabase
      .from('fx_rates')
      .select('*')
      .order('as_of', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      rate: {
        date: data.as_of,
        gbp_per_eur: parseFloat(data.gbp_per_eur),
        eur_per_gbp: parseFloat(data.eur_per_gbp),
        usd_per_gbp: data.usd_per_gbp ? parseFloat(data.usd_per_gbp) : null,
        gbp_per_usd: data.gbp_per_usd ? parseFloat(data.gbp_per_usd) : null,
        meta: data.meta,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to fetch FX rates',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
