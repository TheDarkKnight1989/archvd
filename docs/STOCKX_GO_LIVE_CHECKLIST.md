# StockX Integration Go-Live Checklist

This document outlines all steps required to take your StockX integration from development/mock mode to production with live API access.

## Overview

Your app currently has:
- ✅ Complete OAuth 2.0 flow with PKCE
- ✅ Token management (access + refresh)
- ✅ Database schema for OAuth tokens and market data
- ✅ Sync APIs (listings, sales, prices)
- ✅ Cron jobs for automated syncing
- ✅ UI for connection management
- ✅ Mock mode for development

## Prerequisites

Before going live, ensure you have:
- [ ] StockX Developer Account created at https://developer.stockx.com
- [ ] OAuth Application created and approved by StockX
- [ ] Production credentials (Client ID + Client Secret)
- [ ] Production redirect URI whitelisted by StockX
- [ ] Vercel production environment set up
- [ ] Supabase production database ready

---

## Part 1: StockX Developer Portal Setup

### 1.1 Create OAuth Application

1. Go to https://developer.stockx.com/portal
2. Navigate to **Applications** or **OAuth Apps**
3. Click **Create New Application**
4. Fill in application details:
   - **Application Name**: `archvd` (or your app name)
   - **Description**: Portfolio management app for sneaker collectors
   - **Website URL**: Your production URL (e.g., `https://archvd.vercel.app`)
   - **Redirect URIs**:
     - Production: `https://archvd.vercel.app/api/stockx/oauth/callback`
     - Local (optional): `http://localhost:3000/api/stockx/oauth/callback`

5. Request the following **OAuth Scopes**:
   - `openid` - User identification
   - `profile` - User profile information
   - `email` - User email address
   - `inventory:read` - Read user's inventory/listings
   - `sales:read` - Read user's sales/orders
   - `market:read` - (if available) Read market prices

6. Submit application for review
7. Wait for approval (may take 1-3 business days)

### 1.2 Retrieve Production Credentials

Once approved:

1. Navigate to your application in the developer portal
2. Copy your **Client ID** (public identifier)
3. Generate and copy your **Client Secret** (private key)
4. **IMPORTANT**: Store these securely - never commit to git

### 1.3 Verify API Endpoints

StockX typically uses these endpoints (confirm in their docs):

- **Authorization URL**: `https://accounts.stockx.com/oauth/authorize`
- **Token URL**: `https://accounts.stockx.com/oauth/token`
- **API Base URL**: `https://api.stockx.com`
- **UserInfo URL**: `https://accounts.stockx.com/oauth/userinfo`

Note: URLs may differ - check StockX documentation for exact endpoints.

---

## Part 2: Environment Configuration

### 2.1 Local Development (.env.local)

Update your `.env.local` for testing with real credentials:

```bash
# =============================================================================
# StockX Configuration (LIVE MODE)
# =============================================================================

# Feature flags
NEXT_PUBLIC_STOCKX_ENABLE=true
NEXT_PUBLIC_STOCKX_MOCK=false  # IMPORTANT: Set to false for live mode

# API Configuration
STOCKX_API_BASE_URL=https://api.stockx.com
STOCKX_CLIENT_ID=your_client_id_from_developer_portal
STOCKX_CLIENT_SECRET=your_client_secret_from_developer_portal

# OAuth URLs (verify these with StockX docs)
STOCKX_OAUTH_AUTHORIZE_URL=https://accounts.stockx.com/oauth/authorize
STOCKX_OAUTH_TOKEN_URL=https://accounts.stockx.com/oauth/token
STOCKX_USERINFO_URL=https://accounts.stockx.com/oauth/userinfo

# Redirect URI (must match developer portal)
STOCKX_REDIRECT_URI=http://localhost:3000/api/stockx/oauth/callback

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Security Notes**:
- Never commit `.env.local` to git (already in `.gitignore`)
- Use different credentials for local vs production
- Rotate secrets regularly

### 2.2 Vercel Production Environment

In Vercel Dashboard → Your Project → Settings → Environment Variables:

**Add the following variables for Production environment**:

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `NEXT_PUBLIC_STOCKX_ENABLE` | `true` | Production |
| `NEXT_PUBLIC_STOCKX_MOCK` | `false` | Production |
| `STOCKX_API_BASE_URL` | `https://api.stockx.com` | Production |
| `STOCKX_CLIENT_ID` | Your production Client ID | Production |
| `STOCKX_CLIENT_SECRET` | Your production Client Secret | Production |
| `STOCKX_OAUTH_AUTHORIZE_URL` | `https://accounts.stockx.com/oauth/authorize` | Production |
| `STOCKX_OAUTH_TOKEN_URL` | `https://accounts.stockx.com/oauth/token` | Production |
| `STOCKX_USERINFO_URL` | `https://accounts.stockx.com/oauth/userinfo` | Production |
| `STOCKX_REDIRECT_URI` | `https://archvd.vercel.app/api/stockx/oauth/callback` | Production |
| `NEXT_PUBLIC_SITE_URL` | `https://archvd.vercel.app` | Production |
| `CRON_SECRET` | Generate random string | Production |

**To generate a secure CRON_SECRET**:
```bash
# Run locally:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2.3 Vercel Preview/Staging (Optional)

Repeat the same for Preview environment if you want to test OAuth on deployed preview branches:

- Set `STOCKX_REDIRECT_URI` to match your preview URL format
- May need to whitelist `*.vercel.app` in StockX developer portal

---

## Part 3: Database Migrations

### 3.1 Verify Migrations Exist

Check that these migrations are present:

```bash
ls -la supabase/migrations/ | grep stockx
```

Expected files:
- `20251118_stockx_accounts_oauth.sql` - OAuth tokens table
- `20251118_integrate_stockx_prices.sql` - Market price integration

### 3.2 Apply Migrations to Production

If using Supabase hosted:

```bash
# Login to Supabase CLI
npx supabase login

# Link to production project
npx supabase link --project-ref YOUR_PRODUCTION_PROJECT_REF

# Apply migrations
npx supabase db push

# Verify tables exist
npx supabase db diff
```

### 3.3 Verify Database Schema

Connect to your production Supabase and verify these tables exist:

- `stockx_accounts` - OAuth tokens per user
- `stockx_market_prices` - StockX market prices
- `stockx_sales` - StockX sales data
- `stockx_listings` - User listings on StockX

Check RLS policies are enabled:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'stockx%';
```

All should show `rowsecurity = true`.

---

## Part 4: Testing OAuth Flow

### 4.1 Local Testing

1. Start dev server:
   ```bash
   npm run dev
   ```

2. Navigate to Settings → Integrations
3. Click **Connect Account** on StockX card
4. Verify redirect to StockX OAuth page
5. Grant permissions
6. Verify redirect back to your app with success message
7. Check database for stored tokens:
   ```sql
   SELECT user_id, account_email, expires_at, created_at
   FROM stockx_accounts
   WHERE user_id = 'YOUR_USER_ID';
   ```

### 4.2 Test Token Refresh

Wait for token to expire (or manually set `expires_at` to past):

```sql
-- Force token expiration for testing
UPDATE stockx_accounts
SET expires_at = NOW() - INTERVAL '1 hour'
WHERE user_id = 'YOUR_USER_ID';
```

Then trigger a sync operation and verify token is auto-refreshed.

### 4.3 Test Sync Operations

Click each sync button in the Integrations page:

- **Sync Listings** → Fetches your active listings from StockX
- **Sync Sales** → Fetches completed sales/orders
- **Sync Prices** → Fetches market prices for your inventory

Verify data appears in database and UI.

---

## Part 5: Deploy to Production

### 5.1 Pre-Deploy Checklist

- [ ] All environment variables set in Vercel
- [ ] Database migrations applied to production
- [ ] StockX OAuth app approved and active
- [ ] Redirect URI whitelisted matches production URL exactly
- [ ] Code tested locally with real credentials
- [ ] Error handling tested (disconnect, expired tokens, API failures)

### 5.2 Deploy to Vercel

```bash
# Commit changes
git add .
git commit -m "feat: enable StockX live integration"

# Push to main (triggers Vercel deploy)
git push origin main
```

### 5.3 Post-Deploy Verification

1. Visit production URL: `https://archvd.vercel.app`
2. Login to your account
3. Navigate to Settings → Integrations
4. Verify StockX card shows "Not Connected" (not Mock Mode)
5. Click **Connect Account**
6. Complete OAuth flow
7. Verify success message
8. Test all sync operations
9. Check Vercel logs for any errors

---

## Part 6: Configure Cron Jobs

### 6.1 Verify Cron Configuration

Check `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/stockx/prices",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/stockx/sales",
      "schedule": "*/30 * * * *"
    },
    {
      "path": "/api/cron/stockx/listings",
      "schedule": "0 3 * * *"
    }
  ]
}
```

**Schedule Breakdown**:
- **Prices**: Hourly (every hour at :00)
- **Sales**: Every 30 minutes
- **Listings**: Daily at 3 AM UTC

### 6.2 Enable Vercel Cron

Cron jobs are automatically enabled on Vercel Pro+ plans. If you see errors:

1. Go to Vercel Dashboard → Project → Settings → Cron Jobs
2. Verify crons are listed and enabled
3. Check execution logs

### 6.3 Test Cron Jobs

Manually trigger a cron:

```bash
# Use cURL with CRON_SECRET
curl -X GET \
  "https://archvd.vercel.app/api/cron/stockx/prices" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Or use Vercel Dashboard → Deployments → Cron → Run Now

### 6.4 Monitor Cron Execution

Check logs in Vercel Dashboard for cron job results:
- Success counts
- Error rates
- Execution duration

---

## Part 7: Security Hardening

### 7.1 Secrets Management

- [ ] Use Vercel environment variables (encrypted at rest)
- [ ] Never log access tokens or refresh tokens
- [ ] Rotate `CRON_SECRET` regularly
- [ ] Use different credentials for dev/staging/production

### 7.2 Rate Limiting

StockX likely has rate limits. Implement client-side throttling:

- Current implementation has retry logic with exponential backoff
- Monitor 429 responses in logs
- Adjust cron frequency if hitting limits

### 7.3 Token Security

- Tokens are stored in `stockx_accounts` table
- RLS policies ensure users only see their own tokens
- Tokens auto-refresh before expiry
- Consider encrypting tokens at rest (Supabase Vault or application-level encryption)

### 7.4 Error Monitoring

Set up error tracking:

- Add Sentry or similar for production error monitoring
- Alert on OAuth failures
- Alert on cron job failures
- Monitor token refresh failures

---

## Part 8: User Communication

### 8.1 Feature Announcement

Inform users about StockX integration:

- Add banner or toast notification
- Send email announcement
- Update changelog/release notes
- Provide integration guide

### 8.2 Support Documentation

Create help docs covering:

- How to connect StockX account
- What data is synced
- Sync frequency
- How to disconnect
- Privacy and data handling
- Troubleshooting common issues

### 8.3 Privacy Policy Update

Update privacy policy to include:

- StockX data collection
- OAuth token storage
- Data retention policies
- User data deletion process

---

## Part 9: Monitoring & Observability

### 9.1 Key Metrics to Track

Set up dashboards for:

- **OAuth Metrics**:
  - Connection success rate
  - Token refresh success rate
  - Disconnection rate

- **Sync Metrics**:
  - Cron job success/failure rate
  - Data sync counts (listings, sales, prices)
  - Sync duration
  - API error rates

- **Usage Metrics**:
  - Total connected users
  - Active users (syncing data)
  - API call volume
  - Rate limit hits

### 9.2 Set Up Alerts

Configure alerts for:

- OAuth callback failures (> 5% failure rate)
- Cron job failures (> 10% failure rate)
- API rate limit exceeded
- Token refresh failures
- Database errors

### 9.3 Logging

Ensure comprehensive logging:

- OAuth flow events (start, callback, success, failure)
- Sync operations (start, count, duration, errors)
- Token refresh events
- API rate limit warnings

Current implementation uses `logger` utility - verify it's configured for production.

---

## Part 10: Post-Launch

### 10.1 First Week Monitoring

Daily checks:

- Review error logs
- Check sync success rates
- Monitor user connections
- Verify cron jobs running
- Check for API issues

### 10.2 Performance Optimization

After initial data:

- Review database query performance
- Optimize slow queries
- Add indexes if needed
- Consider caching frequently accessed data

### 10.3 User Feedback

Collect feedback on:

- OAuth flow experience
- Sync reliability
- Data accuracy
- Feature requests

---

## Rollback Plan

If issues occur in production:

### Immediate Rollback

```bash
# Disable StockX in production
# Vercel Dashboard → Environment Variables → NEXT_PUBLIC_STOCKX_ENABLE = false

# Or redeploy previous version
git revert HEAD
git push origin main
```

### Partial Rollback

To disable only cron jobs:

```bash
# Comment out StockX crons in vercel.json
# Commit and deploy

# Or set NEXT_PUBLIC_STOCKX_ENABLE=false
```

### Data Cleanup (if needed)

```sql
-- Remove all StockX connections (extreme case)
DELETE FROM stockx_accounts;
DELETE FROM stockx_market_prices;
DELETE FROM stockx_sales;
DELETE FROM stockx_listings;
```

---

## Checklist Summary

### Before Going Live

- [ ] StockX OAuth app created and approved
- [ ] Production credentials obtained
- [ ] Redirect URI whitelisted
- [ ] Environment variables set in Vercel
- [ ] Database migrations applied to production
- [ ] Local testing completed successfully
- [ ] Code reviewed and tested
- [ ] Security audit completed
- [ ] Privacy policy updated
- [ ] Support documentation prepared

### During Deployment

- [ ] Deploy to production
- [ ] Verify OAuth flow works end-to-end
- [ ] Test all sync operations
- [ ] Verify cron jobs are running
- [ ] Check logs for errors
- [ ] Test on multiple browsers/devices

### After Launch

- [ ] Monitor error rates
- [ ] Track user connections
- [ ] Review sync success rates
- [ ] Collect user feedback
- [ ] Optimize performance
- [ ] Document lessons learned

---

## Troubleshooting Common Issues

### "OAuth not configured" Error

**Cause**: Missing `STOCKX_CLIENT_ID` or `STOCKX_CLIENT_SECRET`

**Fix**:
1. Verify environment variables are set in Vercel
2. Check variable names match exactly (case-sensitive)
3. Redeploy after adding variables

### "Invalid redirect_uri" Error

**Cause**: Redirect URI mismatch between code and StockX portal

**Fix**:
1. Verify `STOCKX_REDIRECT_URI` env var matches exactly what's in StockX developer portal
2. Must be absolute URL (include `https://`)
3. No trailing slash
4. Port number must match (or omit for 443)

### "Token expired" Error

**Cause**: Access token expired and refresh failed

**Fix**:
1. Check refresh token is stored in database
2. Verify `STOCKX_OAUTH_TOKEN_URL` is correct
3. Check StockX API is accessible
4. User may need to reconnect

### Cron Jobs Not Running

**Cause**: Vercel plan doesn't support crons, or cron auth failing

**Fix**:
1. Upgrade to Vercel Pro if on Hobby plan
2. Verify `CRON_SECRET` is set correctly
3. Check cron job logs in Vercel dashboard
4. Verify cron paths are correct

### RLS Policy Errors

**Cause**: User can't access their own StockX data

**Fix**:
1. Verify RLS policies are enabled
2. Check `auth.uid()` matches `user_id` in queries
3. Ensure user is authenticated
4. Review Supabase logs

---

## Support Resources

- **StockX Developer Portal**: https://developer.stockx.com
- **StockX API Docs**: Check developer portal for latest docs
- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **Your App Logs**: Vercel Dashboard → Deployments → Functions

---

## Contact for Issues

If you encounter issues during go-live:

1. Check this document's troubleshooting section
2. Review Vercel deployment logs
3. Check Supabase logs for database errors
4. Contact StockX developer support
5. Review your OAuth app status in StockX portal

---

**Last Updated**: 2025-01-18

**Next Review**: After first production deployment
