/**
 * StockX OAuth Callback
 * Handles authorization code exchange and token storage
 * GET /api/stockx/oauth/callback
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

// Force dynamic rendering - never cache this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

    // Check if this is internal capture flow (state starts with 'internal_')
    const isInternalCapture = state?.startsWith('internal_') ||
                              request.cookies.get('stockx_internal_capture')?.value === 'true';

    let codeVerifier: string | undefined;
    let userId: string | undefined;

    if (isInternalCapture && state?.startsWith('internal_')) {
      // Internal flow: Extract verifier from state parameter
      // Format: internal_<random>_<base64url(verifier)>
      const parts = state.split('_');
      if (parts.length === 3) {
        try {
          codeVerifier = Buffer.from(parts[2], 'base64url').toString();
          console.log('[StockX OAuth Callback] Internal capture - extracted verifier from state');
        } catch (err) {
          console.error('[StockX OAuth Callback] Failed to decode verifier from state:', err);
          return NextResponse.json(
            { error: 'Invalid state format for internal capture' },
            { status: 400 }
          );
        }
      } else {
        console.error('[StockX OAuth Callback] Invalid internal state format:', state);
        return NextResponse.json(
          { error: 'Invalid state format for internal capture' },
          { status: 400 }
        );
      }
    } else {
      // Regular user flow: Use cookies
      const storedState = request.cookies.get('stockx_oauth_state')?.value;
      codeVerifier = request.cookies.get('stockx_oauth_verifier')?.value;
      userId = request.cookies.get('stockx_oauth_user_id')?.value;

      // Debug logging for cookies
      console.log('[StockX OAuth Callback] Cookie debug', {
        hasStoredState: !!storedState,
        hasCodeVerifier: !!codeVerifier,
        hasUserId: !!userId,
        isInternalCapture,
        receivedState: state,
        storedState: storedState?.substring(0, 8) + '...',
        allCookies: request.cookies.getAll().map(c => c.name),
      });

      // Strict validation for regular user flow
      if (!storedState || storedState !== state) {
        logger.error('[StockX OAuth Callback] State mismatch', {
          storedState: storedState?.substring(0, 8) + '...',
          receivedState: state?.substring(0, 8) + '...',
          statesMatch: storedState === state,
          allCookies: request.cookies.getAll().map(c => ({ name: c.name, hasValue: !!c.value })),
        });

        return NextResponse.json(
          {
            error: 'Invalid state parameter',
            debug: {
              hasStoredState: !!storedState,
              receivedState: !!state,
              hint: 'Cookies may not be persisting across OAuth redirect. Try using desktop browser instead of PWA.',
            }
          },
          { status: 400 }
        );
      }

      if (!codeVerifier) {
        return NextResponse.json(
          { error: 'Missing PKCE verifier' },
          { status: 400 }
        );
      }
    }

    // For regular OAuth flow, userId is required
    // For internal capture, userId is NOT needed
    if (!isInternalCapture && !userId) {
      return NextResponse.json(
        { error: 'Missing user ID' },
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
        audience: 'gateway.stockx.com',
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

    if (!access_token) {
      logger.error('[StockX OAuth Callback] Missing access token', {
        hasRefreshToken: !!refresh_token,
        tokenType: token_type,
        scope,
        expiresIn: expires_in,
        responseKeys: Object.keys(tokens)
      });
      return NextResponse.json(
        { error: 'Missing access token' },
        { status: 500 }
      );
    }

    // Log warning if no refresh token (some OAuth configs don't provide it)
    if (!refresh_token) {
      logger.warn('[StockX OAuth Callback] No refresh token provided', {
        message: 'StockX did not return a refresh token. Token will need to be refreshed manually after expiration.',
        expires_in
      });
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

    // ========================================================================
    // INTERNAL CAPTURE MODE: Display tokens instead of storing
    // ========================================================================
    if (isInternalCapture) {
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
      console.log('='.repeat(80));
      console.log('');

      // Return JSON response with token (not a redirect)
      const response = NextResponse.json(
        {
          success: true,
          message: '🎉 StockX app-level refresh token obtained!',
          instructions: [
            'Copy the refresh_token value below',
            'Add it to Vercel environment variables as: STOCKX_REFRESH_TOKEN=...',
            'Redeploy your application',
            'Delete the /api/stockx/internal/start route for security',
            'Test StockX search with a user who has no StockX connection',
          ],
          refresh_token: refresh_token || null,
          access_token_preview: access_token ? `${access_token.substring(0, 20)}...` : null,
          token_type,
          expires_in,
          scope: scope || null,
          warning: !refresh_token ? 'No refresh token received - check if offline_access scope was granted' : null,
        },
        { status: 200 }
      );

      // Clear OAuth cookies
      response.cookies.delete('stockx_oauth_state');
      response.cookies.delete('stockx_oauth_verifier');
      response.cookies.delete('stockx_internal_capture');

      return response;
    }

    // ========================================================================
    // REGULAR FLOW: Store tokens in database for user
    // ========================================================================

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
