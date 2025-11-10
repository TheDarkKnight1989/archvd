# StockX Integration - Quick Start Guide

**TL;DR**: Essential steps to go live with StockX integration.

## 1. Get StockX Credentials (5-10 minutes + approval time)

1. Go to https://developer.stockx.com/portal
2. Create new OAuth application:
   - **Name**: archvd
   - **Redirect URI**: `https://archvd.vercel.app/api/stockx/oauth/callback`
   - **Scopes**: `openid profile email inventory:read sales:read`
3. Submit for approval (1-3 business days)
4. Copy **Client ID** and **Client Secret** when approved

## 2. Configure Vercel Environment (5 minutes)

Go to Vercel Dashboard → Settings → Environment Variables, add for **Production**:

```bash
NEXT_PUBLIC_STOCKX_ENABLE=true
NEXT_PUBLIC_STOCKX_MOCK=false

STOCKX_API_BASE_URL=https://api.stockx.com
STOCKX_CLIENT_ID=your_client_id
STOCKX_CLIENT_SECRET=your_client_secret

STOCKX_OAUTH_AUTHORIZE_URL=https://accounts.stockx.com/oauth/authorize
STOCKX_OAUTH_TOKEN_URL=https://accounts.stockx.com/oauth/token
STOCKX_USERINFO_URL=https://accounts.stockx.com/oauth/userinfo

STOCKX_REDIRECT_URI=https://archvd.vercel.app/api/stockx/oauth/callback
NEXT_PUBLIC_SITE_URL=https://archvd.vercel.app

# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CRON_SECRET=your_random_secret_here
```

## 3. Apply Database Migrations (2 minutes)

```bash
# Link to production Supabase
npx supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
npx supabase db push
```

Verify tables created:
- `stockx_accounts`
- `stockx_market_prices`
- `stockx_sales`
- `stockx_listings`

## 4. Deploy (2 minutes)

```bash
git add .
git commit -m "feat: enable StockX live integration"
git push origin main
```

## 5. Test (5 minutes)

1. Go to your production site
2. Navigate to Settings → Integrations
3. Click **Connect Account** on StockX card
4. Complete OAuth flow
5. Test sync buttons:
   - Sync Listings
   - Sync Sales
   - Sync Prices

## 6. Monitor

Check Vercel logs for:
- OAuth callback success
- Cron job execution
- API errors

---

## Critical URLs to Verify

These must match **exactly** between code and StockX portal:

**Redirect URI in Code**:
- Environment variable: `STOCKX_REDIRECT_URI`
- Must be: `https://archvd.vercel.app/api/stockx/oauth/callback`

**Redirect URI in StockX Portal**:
- Must match exactly (including protocol, no trailing slash)

**OAuth Endpoints** (verify in StockX docs):
- Authorize: `https://accounts.stockx.com/oauth/authorize`
- Token: `https://accounts.stockx.com/oauth/token`
- API: `https://api.stockx.com`

---

## Cron Jobs (Auto-configured)

These run automatically once deployed:

- **Prices**: Hourly (0 * * * *)
- **Sales**: Every 30 minutes (*/30 * * * *)
- **Listings**: Daily at 3 AM UTC (0 3 * * *)

Requires Vercel Pro plan.

---

## Emergency Rollback

If something breaks:

```bash
# Option 1: Disable via environment variable
# Vercel Dashboard → NEXT_PUBLIC_STOCKX_ENABLE = false

# Option 2: Revert code
git revert HEAD
git push origin main
```

---

## Common Issues

**"OAuth not configured"**
→ Check Client ID/Secret are set in Vercel env vars

**"Invalid redirect_uri"**
→ Verify redirect URI matches exactly in code and StockX portal

**"Cron jobs not running"**
→ Requires Vercel Pro plan, check dashboard logs

**"Token expired"**
→ User needs to reconnect account

---

**Full documentation**: [STOCKX_GO_LIVE_CHECKLIST.md](./STOCKX_GO_LIVE_CHECKLIST.md)
