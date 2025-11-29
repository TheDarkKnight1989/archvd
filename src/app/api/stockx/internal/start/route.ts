/**
 * INTERNAL USE ONLY - StockX App-Level OAuth Start
 *
 * ⚠️  WARNING: This route is for one-time internal use to capture a refresh token.
 * ⚠️  REMOVE or DISABLE this route after obtaining the refresh token.
 * ⚠️  This should NOT be accessible in production.
 *
 * Purpose: Initiates OAuth flow to get YOUR StockX refresh token for app-level access
 * Usage: Visit /api/stockx/internal/start once to begin OAuth flow
 *
 * GET /api/stockx/internal/start
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Force dynamic rendering - never cache this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// OAuth configuration
const STOCKX_OAUTH_AUTHORIZE_URL = process.env.STOCKX_OAUTH_AUTHORIZE_URL || 'https://accounts.stockx.com/oauth/authorize';
const STOCKX_CLIENT_ID = process.env.STOCKX_CLIENT_ID;

// Use the SAME redirect URI as regular OAuth flow
const INTERNAL_REDIRECT_URI = process.env.STOCKX_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/stockx/oauth/callback`;

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

    // Generate PKCE parameters
    const { codeVerifier, codeChallenge } = generatePKCE();
    // Embed verifier in state to bypass cookie issues
    // Format: internal_<random>_<base64url(verifier)>
    const randomPart = crypto.randomBytes(8).toString('hex');
    const state = `internal_${randomPart}_${Buffer.from(codeVerifier).toString('base64url')}`;

    // Use offline_access to get refresh token
    const scopes = 'offline_access openid';

    const response = NextResponse.redirect(
      `${STOCKX_OAUTH_AUTHORIZE_URL}?` +
      `response_type=code` +
      `&client_id=${encodeURIComponent(STOCKX_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(INTERNAL_REDIRECT_URI)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&audience=gateway.stockx.com` +
      `&state=${state}` +
      `&code_challenge=${codeChallenge}` +
      `&code_challenge_method=S256`
    );

    // Set secure cookies for PKCE - using SAME cookie names as regular flow
    // Use sameSite: 'none' to allow cross-site cookies (required for OAuth redirects)
    response.cookies.set('stockx_oauth_state', state, {
      httpOnly: true,
      secure: true, // Required with sameSite: 'none'
      sameSite: 'none', // Allow cross-site (OAuth redirect from StockX)
      maxAge: 600, // 10 minutes
      path: '/',
    });

    response.cookies.set('stockx_oauth_verifier', codeVerifier, {
      httpOnly: true,
      secure: true, // Required with sameSite: 'none'
      sameSite: 'none', // Allow cross-site (OAuth redirect from StockX)
      maxAge: 600, // 10 minutes
      path: '/',
    });

    // Special flag to indicate this is for internal token capture (not storage)
    response.cookies.set('stockx_internal_capture', 'true', {
      httpOnly: true,
      secure: true, // Required with sameSite: 'none'
      sameSite: 'none', // Allow cross-site (OAuth redirect from StockX)
      maxAge: 600, // 10 minutes
      path: '/',
    });

    console.log('[StockX Internal OAuth] Starting OAuth flow for app-level token');

    return response;

  } catch (error: any) {
    console.error('[StockX Internal OAuth Start] Error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow', details: error.message },
      { status: 500 }
    );
  }
}
