/**
 * INTERNAL USE ONLY - StockX App-Level OAuth Callback
 *
 * ⚠️  WARNING: This route is for one-time internal use to capture a refresh token.
 * ⚠️  REMOVE or DISABLE this route after obtaining the refresh token.
 * ⚠️  This should NOT be accessible in production.
 *
 * Purpose: Exchanges OAuth code for tokens and displays refresh token
 * Usage: Automatically called by StockX after OAuth authorization
 *
 * GET /api/stockx/internal/callback
 */

import { NextRequest, NextResponse } from 'next/server';

// OAuth configuration
const STOCKX_OAUTH_TOKEN_URL = process.env.STOCKX_OAUTH_TOKEN_URL || 'https://accounts.stockx.com/oauth/token';
const STOCKX_CLIENT_ID = process.env.STOCKX_CLIENT_ID;
const STOCKX_CLIENT_SECRET = process.env.STOCKX_CLIENT_SECRET;
const INTERNAL_REDIRECT_URI = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/stockx/internal/callback`;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Check for OAuth errors
    if (error) {
      const errorDescription = searchParams.get('error_description') || 'Unknown error';
      console.error('[StockX Internal OAuth] OAuth error', {
        error,
        errorDescription,
      });

      return NextResponse.json(
        {
          success: false,
          error,
          error_description: errorDescription,
        },
        { status: 400 }
      );
    }

    if (!code || !state) {
      return NextResponse.json(
        { success: false, error: 'Missing code or state parameter' },
        { status: 400 }
      );
    }

    // Verify state
    const storedState = request.cookies.get('stockx_internal_oauth_state')?.value;
    const codeVerifier = request.cookies.get('stockx_internal_oauth_verifier')?.value;

    if (!storedState || storedState !== state) {
      console.error('[StockX Internal OAuth] State mismatch', {
        storedState,
        receivedState: state,
      });

      return NextResponse.json(
        { success: false, error: 'Invalid state parameter (possible CSRF attack)' },
        { status: 400 }
      );
    }

    if (!codeVerifier) {
      return NextResponse.json(
        { success: false, error: 'Missing PKCE verifier' },
        { status: 400 }
      );
    }

    // Check for required config
    if (!STOCKX_CLIENT_ID || !STOCKX_CLIENT_SECRET) {
      return NextResponse.json(
        { success: false, error: 'StockX OAuth is not configured' },
        { status: 500 }
      );
    }

    // Exchange authorization code for tokens
    console.log('[StockX Internal OAuth] Exchanging code for tokens...');

    const tokenResponse = await fetch(STOCKX_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: INTERNAL_REDIRECT_URI,
        client_id: STOCKX_CLIENT_ID,
        client_secret: STOCKX_CLIENT_SECRET,
        code_verifier: codeVerifier,
        audience: 'gateway.stockx.com',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[StockX Internal OAuth] Token exchange failed', {
        status: tokenResponse.status,
        error: errorText,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Token exchange failed',
          details: errorText,
          status: tokenResponse.status,
        },
        { status: 500 }
      );
    }

    const tokens = await tokenResponse.json();

    const {
      access_token,
      refresh_token,
      token_type = 'Bearer',
      expires_in,
      scope,
    } = tokens;

    if (!access_token) {
      console.error('[StockX Internal OAuth] Missing access token', {
        hasRefreshToken: !!refresh_token,
        tokenType: token_type,
        scope,
        expiresIn: expires_in,
        responseKeys: Object.keys(tokens)
      });
      return NextResponse.json(
        { success: false, error: 'Missing access token in response' },
        { status: 500 }
      );
    }

    // Log warning if no refresh token
    if (!refresh_token) {
      console.warn('[StockX Internal OAuth] No refresh token provided!', {
        message: 'StockX did not return a refresh token. Check if offline_access scope was granted.',
        scope,
        expires_in
      });
    }

    // Log the refresh token to server console
    console.log('');
    console.log('='.repeat(80));
    console.log('🎉 StockX App-Level Refresh Token Obtained!');
    console.log('='.repeat(80));
    console.log('');
    console.log('IMPORTANT: Copy this refresh token and add it to your Vercel environment variables:');
    console.log('');
    console.log(`STOCKX_REFRESH_TOKEN=${refresh_token || '(MISSING - Check scope!)'}`);
    console.log('');
    console.log('Token Details:');
    console.log(`  - Type: ${token_type}`);
    console.log(`  - Expires In: ${expires_in} seconds (${Math.floor(expires_in / 3600)} hours)`);
    console.log(`  - Scope: ${scope || 'default'}`);
    console.log(`  - Access Token: ${access_token.substring(0, 20)}...`);
    console.log('');
    console.log('After adding STOCKX_REFRESH_TOKEN to Vercel:');
    console.log('  1. Redeploy your application');
    console.log('  2. REMOVE or DISABLE the /api/stockx/internal/* routes');
    console.log('  3. Test StockX search with a fresh user (no StockX connection)');
    console.log('');
    console.log('='.repeat(80));
    console.log('');

    // Clear OAuth cookies
    const response = NextResponse.json(
      {
        success: true,
        message: '🎉 StockX app-level refresh token obtained!',
        instructions: [
          'Copy the refresh_token value below',
          'Add it to Vercel environment variables as: STOCKX_REFRESH_TOKEN=...',
          'Redeploy your application',
          'REMOVE or DISABLE these internal OAuth routes',
          'Test StockX search with a user who has no StockX connection',
        ],
        refresh_token: refresh_token || null,
        access_token_preview: access_token ? `${access_token.substring(0, 20)}...` : null,
        token_type,
        expires_in,
        scope: scope || null,
        warning: !refresh_token ? 'No refresh token received - check if offline_access scope was granted' : null,
      },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    response.cookies.delete('stockx_internal_oauth_state');
    response.cookies.delete('stockx_internal_oauth_verifier');

    return response;

  } catch (error: any) {
    console.error('[StockX Internal OAuth Callback] Unexpected error', {
      message: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Unexpected error during token exchange',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
