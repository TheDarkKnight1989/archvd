# StockX Integration Setup Guide

## Current Status

✅ **StockX integration is properly configured** with valid environment variables
✅ **OAuth flow is fully implemented** and ready to use
⚠️ **User account NOT connected yet** - OAuth connection required

## Issue Diagnosis

The 401 errors you're seeing are **expected behavior** because:

1. StockX requires OAuth user authentication (not app-level credentials)
2. Your StockX app is correctly configured for `authorization_code` grant type only
3. The test endpoints (`/api/stockx/test`, `/api/stockx/debug`) check if:
   - User is authenticated with Supabase ✅
   - User has connected their StockX account via OAuth ❌ (not done yet)

## Error Details

When testing credentials with `client_credentials` grant type, StockX returns:
```
{
  "error": "unauthorized_client",
  "error_description": "Grant type 'client_credentials' not allowed for the client."
}
```

This confirms your app is correctly configured for OAuth user flow, not app-level access.

## How to Connect Your StockX Account

### Step 1: Navigate to Integrations Page
```
http://localhost:3000/portfolio/settings/integrations
```

### Step 2: Click "Connect Account"
- Find the StockX card (green gradient with "Sx" logo)
- Click the "Connect Account" button
- This redirects to: `/api/stockx/oauth/start`

### Step 3: Authorize on StockX
- You'll be redirected to `https://accounts.stockx.com/oauth/authorize`
- Log in with your StockX account
- Review permissions requested:
  - `openid profile email`
  - `offline_access` (for refresh tokens)
  - `inventory:read` (view your listings)
  - `sales:read` (view your sales)
- Click "Authorize"

### Step 4: Complete Connection
- StockX redirects back to: `/api/stockx/oauth/callback`
- Your tokens are stored in the `stockx_accounts` table
- You're redirected to: `/portfolio/settings/integrations?connected=stockx`
- ✅ Connection complete!

### Step 5: Verify Connection
After connecting, these endpoints will work:
- `/api/stockx/test` - Tests various StockX API endpoints
- `/api/stockx/debug` - Shows configuration and connection status
- `/api/stockx/sync/listings` - Syncs your active listings
- `/api/stockx/sync/sales` - Syncs your sales history
- `/api/stockx/sync/prices` - Syncs market prices

## Environment Variables Reference

Your current configuration:
```bash
# Enable StockX integration
NEXT_PUBLIC_STOCKX_ENABLE=true

# StockX API Configuration
STOCKX_API_BASE_URL=https://api.stockx.com
STOCKX_CLIENT_ID=P2taFnt47FKZzCUHWtavZLFoPGlA3MJq
STOCKX_CLIENT_SECRET=NmZXmP-i8iGwLWtXogvJynVDbAGRv7f2KB1SOVPiuddga9hOEggy90w2KsgeY-PK
STOCKX_API_KEY=HZuYFEWTYEJ1NBwyVSDg2KQYoBSLUF24xoFQJOn0

# OAuth URLs
STOCKX_OAUTH_TOKEN_URL=https://accounts.stockx.com/oauth/token
STOCKX_OAUTH_AUTHORIZE_URL=https://accounts.stockx.com/oauth/authorize
STOCKX_REDIRECT_URI=https://archvdio.vercel.app/api/stockx/oauth/callback
```

## OAuth Flow Technical Details

### PKCE (Proof Key for Code Exchange)
The implementation uses PKCE for security:
1. Generate `code_verifier` (random 32-byte string)
2. Generate `code_challenge` (SHA-256 hash of verifier)
3. Store verifier in secure cookie
4. Send challenge to StockX
5. Exchange code + verifier for tokens

### Token Storage
Tokens are stored in `stockx_accounts` table:
- `user_id` - Links to your Supabase user
- `access_token` - Used for API requests
- `refresh_token` - Used to get new access tokens
- `expires_at` - Token expiration timestamp
- `account_email` - Your StockX account email
- `account_id` - StockX user ID

### Automatic Token Refresh
The `StockxClient` automatically:
- Checks token expiration before each request
- Refreshes tokens if expiring within 1 minute
- Updates database with new tokens
- Handles refresh failures gracefully

## Troubleshooting

### "StockX account not connected" error
**Solution**: Go to `/portfolio/settings/integrations` and connect your account

### OAuth callback fails
**Possible causes**:
1. Redirect URI mismatch - Ensure `STOCKX_REDIRECT_URI` matches your StockX app settings
2. Client credentials invalid - Verify `STOCKX_CLIENT_ID` and `STOCKX_CLIENT_SECRET`
3. App not approved - Check your app status in StockX developer portal

### API calls return 403
**Possible causes**:
1. Missing scopes - Your app may not have required permissions
2. Invalid x-api-key - Verify `STOCKX_API_KEY` is correct
3. App not approved for production - May be in sandbox mode

## Next Steps

1. **Connect your StockX account** via `/portfolio/settings/integrations`
2. **Test the connection** by clicking "Sync Listings" or "Sync Sales"
3. **Monitor sync status** - Check last sync timestamps
4. **Review synced data** in your portfolio

## Support

If OAuth flow fails:
1. Check browser console for errors
2. Review server logs for callback errors
3. Verify StockX app configuration in developer portal
4. Contact StockX support at: https://stockx.com/help

---

**Created**: 2025-11-11
**Status**: Ready for OAuth connection
