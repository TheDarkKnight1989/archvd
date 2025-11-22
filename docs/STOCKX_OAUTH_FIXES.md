# StockX OAuth Integration - Fixes & Troubleshooting

## Problem: OAuth Login Button Redirects to StockX Home Page

### Root Cause Analysis

The StockX OAuth login was failing silently, redirecting users back to the StockX home page instead of completing the authorization flow. After investigation, we identified the following issues:

## Fixes Applied

### 1. **CRITICAL FIX: Invalid OAuth Scopes** ✅ FIXED (Commit 1695193)

**File:** `src/app/api/stockx/oauth/start/route.ts:63`

**Problem:**
- Code was requesting invalid scopes: `catalog.read` and `marketplace.read`
- These scopes don't exist in StockX's OAuth implementation
- StockX OAuth server silently rejected the authorization request

**Before:**
```typescript
const scopes = ['offline_access', 'openid', 'catalog.read', 'marketplace.read'].join(' ')
```

**After:**
```typescript
const scopes = 'offline_access openid'
```

**Why this matters:**
According to StockX OAuth documentation, the ONLY valid scopes are:
- `offline_access` - Required for refresh tokens
- `openid` - Required for OpenID Connect authentication

Any additional scopes cause the OAuth flow to fail.

**Commit:** 1695193 - "fix: use correct OAuth scopes per StockX documentation"

---

### 2. **Sync Button Not Updating Timestamp** ✅ FIXED (Commit d8c1289)

**File:** `src/app/portfolio/inventory/page.tsx:559-574`

**Problem:**
- "Sync Now" button showed loading state but didn't actually call the API
- "Last synced" timestamp never updated
- There was a TODO comment indicating incomplete implementation

**Before:**
```typescript
onSyncNow={async () => {
  // TODO: Implement actual sync
  await new Promise(resolve => setTimeout(resolve, 2000))
}}
```

**After:**
```typescript
onSyncNow={async () => {
  const response = await fetch('/api/stockx/sync/prices', {
    method: 'POST',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Sync failed')
  }

  const result = await response.json()
  console.log('[Sync] Completed:', result)

  // Refetch inventory to get updated market data
  refetch()
}}
```

---

### 3. **Currency Display Issue - Fractional Pence** ✅ FIXED (Commit d8c1289)

**File:** `src/lib/services/stockx/market.ts:115`

**Problem:**
- Market prices displayed as fractional pence (£118.42) instead of whole pounds
- API was being called with USD currency, then converted to GBP
- StockX supports direct GBP API calls

**Before:**
```typescript
export class StockxMarketService {
  static async getProductMarketData(
    productId: string,
    currencyCode: string = 'USD',  // ❌ Wrong default
    userId?: string
  ): Promise<StockxVariantMarketData[]> {
```

**After:**
```typescript
export class StockxMarketService {
  static async getProductMarketData(
    productId: string,
    currencyCode: string = 'GBP',  // ✅ Correct default
    userId?: string
  ): Promise<StockxVariantMarketData[]> {
```

---

### 4. **Next.js Image Configuration** ✅ FIXED (Commit d8c1289)

**File:** `next.config.ts`

**Problem:**
- Runtime error: "Invalid src prop on `next/image`, hostname 'images.stockx.com' is not configured"
- Product images from StockX CDN couldn't load

**Fix:**
Added StockX image hostname to Next.js image optimization config:

```typescript
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'images.stockx.com',
      pathname: '/**',
    },
  ],
},
```

---

## Current Status

### ✅ Completed
1. OAuth scopes fixed (committed and pushed)
2. Sync functionality implemented
3. Currency configuration corrected
4. Image loading configuration added
5. All changes deployed to production

### ⚠️ Pending Verification

#### Environment Variables in Vercel

The OAuth flow requires these environment variables to be set in Vercel:

**Required:**
- `NEXT_PUBLIC_STOCKX_ENABLE=true`
- `NEXT_PUBLIC_STOCKX_MOCK=false`
- `STOCKX_CLIENT_ID=P2taFnt47FKZzCUHWtavZLFoPGlA3MJq`
- `STOCKX_CLIENT_SECRET=NmZXmP-i8iGwLWtXogvJynVDbAGRv7f2KB1SOVPiuddga9hOEggy90w2KsgeY-PK`
- `STOCKX_REDIRECT_URI=https://archvdio.vercel.app/api/stockx/oauth/callback` ⚠️ **CRITICAL**
- `STOCKX_OAUTH_AUTHORIZE_URL=https://accounts.stockx.com/oauth/authorize`
- `STOCKX_OAUTH_TOKEN_URL=https://accounts.stockx.com/oauth/token`
- `STOCKX_USERINFO_URL=https://accounts.stockx.com/oauth/userinfo`

**Optional (for API key auth):**
- `STOCKX_API_KEY=HZuYFEWTYEJ1NBwyVSDg2KQYoBSLUF24xoFQJOn0`
- `STOCKX_API_BASE_URL=https://api.stockx.com`

**How to verify:**
```bash
vercel env ls
```

**How to add missing variables:**
```bash
vercel env add STOCKX_REDIRECT_URI production
# Enter: https://archvdio.vercel.app/api/stockx/oauth/callback
```

---

## Troubleshooting Guide

### Issue: Button still redirects to StockX home page

**Check 1: Vercel Deployment Status**
```bash
vercel ls
```
Verify that the latest commit (1695193) has been deployed.

**Check 2: Browser Cache**
- Hard refresh the page (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
- Or open in incognito/private window
- OAuth cookies may be cached with old state

**Check 3: Verify OAuth URL**
Open browser DevTools Network tab:
1. Click "Connect to StockX" button
2. Check the redirect URL in Network tab
3. It should contain: `scope=offline_access%20openid` (NOT catalog.read or marketplace.read)

**Expected OAuth URL format:**
```
https://accounts.stockx.com/oauth/authorize?
  response_type=code&
  client_id=P2taFnt47FKZzCUHWtavZLFoPGlA3MJq&
  redirect_uri=https://archvdio.vercel.app/api/stockx/oauth/callback&
  scope=offline_access%20openid&
  audience=gateway.stockx.com&
  state=<random>&
  code_challenge=<random>&
  code_challenge_method=S256
```

**Check 4: StockX OAuth App Configuration**
Verify in StockX Developer Portal that:
- Redirect URI whitelist includes: `https://archvdio.vercel.app/api/stockx/oauth/callback`
- Client ID matches: `P2taFnt47FKZzCUHWtavZLFoPGlA3MJq`

---

## Architecture Notes

### Multi-User OAuth
Each user gets their own OAuth tokens stored in the `stockx_accounts` table:
- `user_id` (primary key) - Supabase auth user ID
- `access_token` - User-specific access token
- `refresh_token` - For token renewal
- `expires_at` - Token expiration timestamp

This ensures each user authenticates with their own StockX account.

### PKCE Flow
We use Proof Key for Code Exchange (PKCE) for enhanced security:
1. Generate code verifier (random string)
2. Hash verifier to create code challenge
3. Send challenge with authorization request
4. Send verifier with token exchange
5. Server verifies challenge matches verifier

### Cookie Storage
OAuth state and PKCE verifier are stored in httpOnly cookies for security:
- `stockx_oauth_state` - CSRF protection
- `stockx_oauth_verifier` - PKCE verifier
- `stockx_oauth_user_id` - User identification
- All cookies: 10 minute expiration, httpOnly, secure in production

---

## Testing Steps

1. **Local Testing:**
   ```bash
   npm run dev
   # Visit http://localhost:3000/portfolio/settings/integrations
   ```
   Note: OAuth won't work locally (redirect URI mismatch) but you can verify button clicks

2. **Production Testing:**
   - Visit https://archvdio.vercel.app/portfolio/settings/integrations
   - Click "Connect to StockX"
   - Should redirect to StockX login page
   - After login, should redirect back with `?connected=stockx` parameter
   - Integration status should show "Connected"

3. **Verify Token Storage:**
   ```sql
   -- Check Supabase for stored tokens
   SELECT user_id, account_email, created_at, expires_at
   FROM stockx_accounts
   WHERE user_id = '<your-user-id>';
   ```

---

## Related Files

### OAuth Implementation
- `/src/app/api/stockx/oauth/start/route.ts` - Initiates OAuth flow
- `/src/app/api/stockx/oauth/callback/route.ts` - Handles OAuth callback
- `/src/app/api/stockx/status/route.ts` - Returns connection status

### Configuration
- `/src/lib/config/stockx.ts` - Configuration loader
- `/.env.local` - Local environment variables (NOT in git)
- Vercel dashboard → Settings → Environment Variables

### Database
- `supabase/migrations/20251120_stockx_integration.sql` - Creates `stockx_accounts` table

---

## Git Commits History

1. **d8c1289** - StockX integration improvements (sync, currency, images)
2. **00ff7b5** - Added missing components for Vercel build
3. **25d4f73** - Major StockX integration update (224 files)
4. **1695193** - Fixed OAuth scopes ✅ **CRITICAL FIX**

---

## Future Improvements

1. **Token Refresh Logic**
   - Implement automatic token refresh when access token expires
   - Current: Tokens expire after ~1 hour, user must re-authenticate
   - Todo: Use refresh token to get new access token

2. **Error Handling UI**
   - Show user-friendly error messages when OAuth fails
   - Current: Redirects with error query params
   - Todo: Parse error params and show toast notifications

3. **Sync History**
   - Track sync history in database
   - Show last sync timestamp per sync type (listings, sales, prices)

4. **StockX API Rate Limiting**
   - Implement rate limit tracking
   - Show remaining API calls to user
   - Queue requests when rate limited
