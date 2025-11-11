/**
 * StockX Credentials Verification Endpoint
 * Tests if StockX API credentials are valid using client credentials flow
 * GET /api/stockx/verify-credentials
 *
 * This endpoint does NOT require user authentication - it's for testing app-level credentials
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.STOCKX_CLIENT_ID;
    const clientSecret = process.env.STOCKX_CLIENT_SECRET;
    const apiKey = process.env.STOCKX_API_KEY;
    const tokenUrl = process.env.STOCKX_OAUTH_TOKEN_URL || 'https://accounts.stockx.com/oauth/token';
    const apiBaseUrl = process.env.STOCKX_API_BASE_URL || 'https://api.stockx.com';

    // Check if credentials are configured
    if (!clientId || !clientSecret) {
      return NextResponse.json({
        success: false,
        error: 'Missing credentials',
        details: {
          hasClientId: !!clientId,
          hasClientSecret: !!clientSecret,
          hasApiKey: !!apiKey,
        }
      }, { status: 500 });
    }

    console.log('[StockX Verify] Testing credentials...');
    console.log('[StockX Verify] Token URL:', tokenUrl);
    console.log('[StockX Verify] API Base URL:', apiBaseUrl);
    console.log('[StockX Verify] Client ID:', clientId.slice(0, 8) + '...');

    // Step 1: Try to get an access token using client credentials
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    console.log('[StockX Verify] Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[StockX Verify] Token request failed:', errorText);

      return NextResponse.json({
        success: false,
        step: 'token_request',
        error: `Token request failed with status ${tokenResponse.status}`,
        details: errorText,
        suggestion: 'Your client_id or client_secret may be invalid, or your StockX app may not be approved for client_credentials flow',
      }, { status: 200 });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        step: 'token_parse',
        error: 'No access token in response',
        details: tokenData,
      }, { status: 200 });
    }

    console.log('[StockX Verify] Access token obtained:', accessToken.slice(0, 8) + '...');

    // Step 2: Try to make a simple API call to test the token
    // Using a lightweight endpoint that should work with client credentials
    const testEndpoint = '/v2/catalog/search?query=jordan&pageSize=1';
    const apiUrl = `${apiBaseUrl}${testEndpoint}`;

    console.log('[StockX Verify] Testing API call to:', apiUrl);

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Add x-api-key if available
    if (apiKey) {
      headers['x-api-key'] = apiKey;
      console.log('[StockX Verify] Including x-api-key:', apiKey.slice(0, 8) + '...' + apiKey.slice(-4));
    }

    const apiResponse = await fetch(apiUrl, {
      method: 'GET',
      headers,
    });

    console.log('[StockX Verify] API response status:', apiResponse.status);

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('[StockX Verify] API call failed:', errorText);

      return NextResponse.json({
        success: false,
        step: 'api_call',
        error: `API call failed with status ${apiResponse.status}`,
        details: errorText,
        suggestion: apiResponse.status === 403
          ? 'Your app may not have permission to access this endpoint. Check your StockX app permissions in the developer portal.'
          : apiResponse.status === 401
          ? 'Authentication failed. The access token may be invalid or your x-api-key may be wrong.'
          : 'Unknown API error. Check StockX developer documentation.',
      }, { status: 200 });
    }

    const apiData = await apiResponse.json();

    console.log('[StockX Verify] API call successful!');

    return NextResponse.json({
      success: true,
      message: 'StockX credentials are valid and API is accessible',
      token_info: {
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        scope: tokenData.scope || 'default',
      },
      api_test: {
        endpoint: testEndpoint,
        status: apiResponse.status,
        result_count: apiData.count || 0,
      },
    }, { status: 200 });

  } catch (error: any) {
    console.error('[StockX Verify] Unexpected error:', error);

    return NextResponse.json({
      success: false,
      error: 'Unexpected error',
      details: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
