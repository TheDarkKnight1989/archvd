/**
 * StockX OAuth Callback
 * Handles authorization code exchange and token storage
 * GET /api/stockx/oauth/callback
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

// OAuth configuration
const STOCKX_OAUTH_TOKEN_URL = process.env.STOCKX_OAUTH_TOKEN_URL || 'https://accounts.stockx.com/oauth/token';
const STOCKX_CLIENT_ID = process.env.STOCKX_CLIENT_ID;
const STOCKX_CLIENT_SECRET = process.env.STOCKX_CLIENT_SECRET;
const STOCKX_REDIRECT_URI = process.env.STOCKX_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/stockx/oauth/callback`;
const STOCKX_USERINFO_URL = process.env.STOCKX_USERINFO_URL || 'https://accounts.stockx.com/oauth/userinfo';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Check for OAuth errors
    if (error) {
      const errorDescription = searchParams.get('error_description') || 'Unknown error';
      logger.error('[StockX OAuth Callback] OAuth error', {
        error,
        errorDescription,
      });

      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/portfolio/settings/integrations?error=oauth_failed&provider=stockx`
      );
    }

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing code or state parameter' },
        { status: 400 }
      );
    }

    // Verify state
    const storedState = request.cookies.get('stockx_oauth_state')?.value;
    const codeVerifier = request.cookies.get('stockx_oauth_verifier')?.value;
    const userId = request.cookies.get('stockx_oauth_user_id')?.value;

    if (!storedState || storedState !== state) {
      logger.error('[StockX OAuth Callback] State mismatch', {
        storedState,
        receivedState: state,
      });

      return NextResponse.json(
        { error: 'Invalid state parameter' },
        { status: 400 }
      );
    }

    if (!codeVerifier || !userId) {
      return NextResponse.json(
        { error: 'Missing PKCE verifier or user ID' },
        { status: 400 }
      );
    }

    // Check for required config
    if (!STOCKX_CLIENT_ID || !STOCKX_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'StockX OAuth is not configured' },
        { status: 500 }
      );
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(STOCKX_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: STOCKX_REDIRECT_URI,
        client_id: STOCKX_CLIENT_ID,
        client_secret: STOCKX_CLIENT_SECRET,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logger.error('[StockX OAuth Callback] Token exchange failed', {
        status: tokenResponse.status,
        error: errorText,
      });

      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/portfolio/settings/integrations?error=token_exchange_failed&provider=stockx`
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

    if (!access_token || !refresh_token) {
      logger.error('[StockX OAuth Callback] Missing tokens', { tokens });
      return NextResponse.json(
        { error: 'Missing access or refresh token' },
        { status: 500 }
      );
    }

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();

    // Fetch user info (optional - StockX may provide this)
    let accountEmail: string | null = null;
    let accountId: string | null = null;

    try {
      const userinfoResponse = await fetch(STOCKX_USERINFO_URL, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Accept': 'application/json',
        },
      });

      if (userinfoResponse.ok) {
        const userinfo = await userinfoResponse.json();
        accountEmail = userinfo.email || null;
        accountId = userinfo.sub || userinfo.id || null;
      }
    } catch (error) {
      logger.warn('[StockX OAuth Callback] Failed to fetch userinfo', { error });
    }

    // Store tokens in database
    const supabase = await createClient();

    const { error: dbError } = await supabase
      .from('stockx_accounts')
      .upsert(
        {
          user_id: userId,
          access_token,
          refresh_token,
          token_type,
          scope: scope || null,
          expires_at: expiresAt,
          account_email: accountEmail,
          account_id: accountId,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      );

    if (dbError) {
      logger.error('[StockX OAuth Callback] Database error', {
        error: dbError.message,
        code: dbError.code,
      });

      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/portfolio/settings/integrations?error=db_error&provider=stockx`
      );
    }

    const duration = Date.now() - startTime;

    logger.apiRequest(
      '/api/stockx/oauth/callback',
      { code_present: !!code, state_present: !!state },
      duration,
      { success: true, userId }
    );

    // Clear OAuth cookies
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/portfolio/settings/integrations?connected=stockx`
    );

    response.cookies.delete('stockx_oauth_state');
    response.cookies.delete('stockx_oauth_verifier');
    response.cookies.delete('stockx_oauth_user_id');

    return response;

  } catch (error: any) {
    logger.error('[StockX OAuth Callback] Unexpected error', {
      message: error.message,
      stack: error.stack,
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/portfolio/settings/integrations?error=unexpected&provider=stockx`
    );
  }
}
