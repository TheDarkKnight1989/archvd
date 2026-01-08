/**
 * DEBUG: Full StockX API Diagnosis
 * Tests configuration, authentication, and API access
 * GET /api/stockx/debug/diagnose
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import {
  isStockxMockMode,
  isStockxEnabled,
  getStockxApiKey,
  getStockxApiBaseUrl,
  maskStockxToken,
} from '@/lib/config/stockx'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    checks: {},
    errors: [],
  }

  try {
    // 1. Check basic configuration
    results.checks.config = {
      enabled: isStockxEnabled(),
      mockMode: isStockxMockMode(),
      hasApiKey: false,
      apiKeyPreview: null,
      apiBaseUrl: null,
    }

    try {
      const apiKey = getStockxApiKey()
      results.checks.config.hasApiKey = !!apiKey
      results.checks.config.apiKeyPreview = apiKey
        ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`
        : '(not set)'
    } catch (e: any) {
      results.checks.config.apiKeyError = e.message
    }

    try {
      results.checks.config.apiBaseUrl = getStockxApiBaseUrl()
    } catch (e: any) {
      results.checks.config.apiBaseUrlError = e.message
    }

    // 2. Check authentication
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    results.checks.auth = {
      authenticated: !!user,
      userId: user?.id || null,
      email: user?.email || null,
      error: authError?.message || null,
    }

    if (!user) {
      results.errors.push('Not authenticated - please log in first')
      return NextResponse.json(results)
    }

    // 3. Check stockx_accounts record
    const adminSupabase = createServiceRoleClient()
    const { data: account, error: accountError } = await adminSupabase
      .from('stockx_accounts')
      .select('user_id, account_email, scope, expires_at, created_at, updated_at')
      .eq('user_id', user.id)
      .single()

    results.checks.account = {
      hasRecord: !!account,
      error: accountError?.message || null,
      data: account
        ? {
            email: account.account_email,
            scope: account.scope,
            expiresAt: account.expires_at,
            isExpired: new Date(account.expires_at) < new Date(),
            createdAt: account.created_at,
            updatedAt: account.updated_at,
          }
        : null,
    }

    if (!account) {
      results.errors.push('No StockX account connected - need to connect via OAuth')
      return NextResponse.json(results)
    }

    // 4. Test the Orders API
    results.checks.ordersApi = {
      tested: false,
      success: false,
      error: null,
      response: null,
    }

    try {
      // Get fresh access token
      const { data: tokenData } = await adminSupabase
        .from('stockx_accounts')
        .select('access_token')
        .eq('user_id', user.id)
        .single()

      if (!tokenData?.access_token) {
        results.checks.ordersApi.error = 'No access token found'
      } else {
        const apiKey = getStockxApiKey()
        const baseUrl = getStockxApiBaseUrl()

        results.checks.ordersApi.requestDetails = {
          url: `${baseUrl}/selling/orders/active?pageSize=1`,
          hasToken: true,
          tokenPreview: maskStockxToken(tokenData.access_token),
          hasApiKey: !!apiKey,
          apiKeyPreview: apiKey ? `${apiKey.slice(0, 8)}...` : '(not set)',
        }

        // Make the actual API call
        const headers: Record<string, string> = {
          Authorization: `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        }

        if (apiKey) {
          headers['x-api-key'] = apiKey
        }

        const response = await fetch(`${baseUrl}/selling/orders/active?pageSize=1`, {
          method: 'GET',
          headers,
        })

        const responseText = await response.text()

        results.checks.ordersApi.tested = true
        results.checks.ordersApi.httpStatus = response.status
        results.checks.ordersApi.httpStatusText = response.statusText

        if (response.ok) {
          results.checks.ordersApi.success = true
          try {
            const data = JSON.parse(responseText)
            results.checks.ordersApi.response = {
              orderCount: data.orders?.length || 0,
              hasOrders: (data.orders?.length || 0) > 0,
            }
          } catch {
            results.checks.ordersApi.response = responseText.substring(0, 200)
          }
        } else {
          results.checks.ordersApi.success = false
          results.checks.ordersApi.error = responseText

          // Diagnose common errors
          if (response.status === 403) {
            if (!apiKey) {
              results.errors.push(
                '403 Forbidden: STOCKX_API_KEY is not set - this is required for V2 API'
              )
            } else {
              results.errors.push(
                '403 Forbidden: API key may not have selling permissions, or may be a V1 key that needs migration'
              )
            }
          } else if (response.status === 401) {
            results.errors.push('401 Unauthorized: OAuth token may be expired or invalid')
          }
        }
      }
    } catch (e: any) {
      results.checks.ordersApi.error = e.message
    }

    // 5. Test the Catalog API (should work for all authenticated users)
    results.checks.catalogApi = {
      tested: false,
      success: false,
      error: null,
    }

    try {
      const { data: tokenData } = await adminSupabase
        .from('stockx_accounts')
        .select('access_token')
        .eq('user_id', user.id)
        .single()

      if (tokenData?.access_token) {
        const apiKey = getStockxApiKey()
        const baseUrl = getStockxApiBaseUrl()

        const headers: Record<string, string> = {
          Authorization: `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        }

        if (apiKey) {
          headers['x-api-key'] = apiKey
        }

        // Test catalog search - should work for all users
        const response = await fetch(
          `${baseUrl}/v2/catalog/search?query=jordan&pageSize=1`,
          {
            method: 'GET',
            headers,
          }
        )

        results.checks.catalogApi.tested = true
        results.checks.catalogApi.httpStatus = response.status

        if (response.ok) {
          results.checks.catalogApi.success = true
        } else {
          const errorText = await response.text()
          results.checks.catalogApi.error = errorText
        }
      }
    } catch (e: any) {
      results.checks.catalogApi.error = e.message
    }

    // Summary diagnosis
    results.diagnosis = []

    if (results.checks.config.mockMode) {
      results.diagnosis.push('❌ Mock mode is ON - disable it to use real API')
    }

    if (!results.checks.config.hasApiKey) {
      results.diagnosis.push(
        '❌ STOCKX_API_KEY is not configured - required for V2 API endpoints'
      )
    }

    if (results.checks.account?.data?.isExpired) {
      results.diagnosis.push('❌ OAuth token is expired - need to reconnect')
    }

    if (results.checks.ordersApi.success) {
      results.diagnosis.push('✅ Orders API is working!')
    } else if (results.checks.ordersApi.httpStatus === 403) {
      results.diagnosis.push('❌ Orders API returns 403 - check API key permissions')
    }

    if (results.checks.catalogApi.success) {
      results.diagnosis.push('✅ Catalog API is working')
    }

    if (results.diagnosis.length === 0) {
      results.diagnosis.push('Unable to determine specific issues')
    }

    return NextResponse.json(results)
  } catch (error: any) {
    results.errors.push(`Unexpected error: ${error.message}`)
    return NextResponse.json(results, { status: 500 })
  }
}
