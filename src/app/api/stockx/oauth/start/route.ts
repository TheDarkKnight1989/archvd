/**
 * StockX OAuth Start
 * Initiates OAuth 2.0 flow with PKCE
 * GET /api/stockx/oauth/start
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

// Force dynamic rendering - never cache this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// OAuth configuration
const STOCKX_OAUTH_AUTHORIZE_URL = process.env.STOCKX_OAUTH_AUTHORIZE_URL || 'https://accounts.stockx.com/oauth/authorize';
const STOCKX_CLIENT_ID = process.env.STOCKX_CLIENT_ID;

// Auto-detect localhost for development
function getRedirectUri(request: NextRequest): string {
  const host = request.headers.get('host') || '';
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

  if (isLocalhost) {
    return `http://${host}/api/stockx/oauth/callback`;
  }

  // Use configured redirect URI or fallback to site URL
  return process.env.STOCKX_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL}/api/stockx/oauth/callback`;
}

// Generate PKCE code verifier and challenge
function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return { codeVerifier, codeChallenge };
}

export async function GET(request: NextRequest) {
  try {
    // Get the correct redirect URI based on environment
    const STOCKX_REDIRECT_URI = getRedirectUri(request);

    // Check if StockX is enabled
    if (process.env.NEXT_PUBLIC_STOCKX_ENABLE !== 'true') {
      return NextResponse.json(
        { error: 'StockX integration is not enabled' },
        { status: 400 }
      );
    }

    // Check for required config
    if (!STOCKX_CLIENT_ID) {
      return NextResponse.json(
        { error: 'StockX OAuth is not configured. Missing STOCKX_CLIENT_ID.' },
        { status: 500 }
      );
    }

    // Verify user is authenticated
    const supabase = await createClient();

    // Try to get user from session first (more reliable in PWAs)
    const { data: { session } } = await supabase.auth.getSession();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[StockX OAuth Start] Authentication failed', {
        hasError: !!authError,
        errorMessage: authError?.message,
        errorStatus: authError?.status,
        hasUser: !!user,
        hasSession: !!session,
        cookies: request.cookies.getAll().map(c => c.name),
        headers: {
          authorization: request.headers.get('authorization'),
          cookie: request.headers.get('cookie')?.substring(0, 100) + '...',
        },
      });

      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Please ensure you are logged in to Archvd before connecting StockX',
          details: authError?.message || 'No active session found',
          hint: 'Try refreshing the page and logging in again before connecting StockX',
        },
        { status: 401 }
      );
    }

    console.log('[StockX OAuth Start] User authenticated', {
      userId: user.id,
      email: user.email,
      hasSession: !!session,
    });

    // Generate PKCE parameters
    const { codeVerifier, codeChallenge } = generatePKCE();
    const state = crypto.randomBytes(16).toString('hex');

    // Store PKCE verifier and state in session/cookie
    // Note: In production, store these securely (Redis, encrypted cookie, etc.)
    // Use minimal required scopes per StockX documentation
    const scopes = 'offline_access openid'

    const response = NextResponse.redirect(
      `${STOCKX_OAUTH_AUTHORIZE_URL}?` +
      `response_type=code` +
      `&client_id=${encodeURIComponent(STOCKX_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(STOCKX_REDIRECT_URI)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&audience=gateway.stockx.com` +
      `&state=${state}` +
      `&code_challenge=${codeChallenge}` +
      `&code_challenge_method=S256`
    );

    // Set secure cookies for PKCE
    // On localhost (HTTP), use secure: false and sameSite: 'lax'
    // In production (HTTPS), use secure: true and sameSite: 'none'
    const isLocalhost = STOCKX_REDIRECT_URI.includes('localhost') || STOCKX_REDIRECT_URI.includes('127.0.0.1');
    const cookieOptions = {
      httpOnly: true,
      secure: !isLocalhost, // false on localhost, true in production
      sameSite: isLocalhost ? ('lax' as const) : ('none' as const), // 'lax' on localhost, 'none' in production
      maxAge: 600, // 10 minutes
      path: '/',
    };

    response.cookies.set('stockx_oauth_state', state, cookieOptions);
    response.cookies.set('stockx_oauth_verifier', codeVerifier, cookieOptions);
    response.cookies.set('stockx_oauth_user_id', user.id, cookieOptions);

    console.log('[StockX OAuth Start] Cookies set, redirecting to StockX', {
      state: state.substring(0, 8) + '...',
      verifier: codeVerifier.substring(0, 8) + '...',
      userId: user.id,
      redirectUrl: `${STOCKX_OAUTH_AUTHORIZE_URL}?...`,
      isLocalhost,
      cookieSettings: cookieOptions,
    });

    return response;

  } catch (error: any) {
    console.error('[StockX OAuth Start] Error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow', details: error.message },
      { status: 500 }
    );
  }
}
