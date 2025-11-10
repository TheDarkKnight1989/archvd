# StockX Integration Documentation

Complete documentation for the StockX marketplace integration in archvd.

## Overview

The StockX integration enables users to:
- ✅ Connect their StockX account via OAuth 2.0
- ✅ Automatically sync listings from StockX
- ✅ Import completed sales/orders
- ✅ Fetch real-time market prices for sneakers
- ✅ Track portfolio value with live StockX data

## Architecture

### Components

1. **OAuth Flow** (`/api/stockx/oauth/`)
   - Authorization with PKCE for security
   - Token storage in Supabase
   - Automatic token refresh

2. **Sync APIs** (`/api/stockx/sync/`)
   - Manual sync triggers from UI
   - Listings, sales, and prices
   - User-specific data access

3. **Cron Jobs** (`/api/cron/stockx/`)
   - Automated background syncing
   - Runs for all connected users
   - Hourly prices, 30-min sales, daily listings

4. **Database Schema**
   - `stockx_accounts` - OAuth tokens per user
   - `stockx_market_prices` - Market data (bid/ask/last sale)
   - `stockx_sales` - Completed sales
   - `stockx_listings` - Active listings

5. **Client Library** (`/lib/services/stockx/`)
   - HTTP client with retry logic
   - Rate limiting and backoff
   - Token management
   - Mock mode for development

### Data Flow

```
User → UI → OAuth Start → StockX Authorization → Callback → Token Storage
                                                                  ↓
User → UI → Manual Sync ←-------------------→ Sync API ←---→ StockX API
                                                   ↓
                                              Database
                                                   ↑
Cron Jobs (Background) ←----------------------→ StockX API
```

## Current Status

### ✅ Completed (Production Ready)

- OAuth 2.0 flow with PKCE
- Token refresh mechanism
- Database schema with RLS
- Manual sync endpoints (listings, sales, prices)
- Automated cron jobs
- UI for connection management
- Mock mode for development
- Error handling and logging
- Integration with portfolio views
- Market price display on product pages

### 🔧 Configuration Required

To go live, you need to:
1. Get approved StockX OAuth app
2. Configure production environment variables
3. Apply database migrations
4. Deploy to production

## Documentation

### For Going Live

- **[Quick Start Guide](./STOCKX_QUICK_START.md)** - Essential steps (10 min read)
- **[Go-Live Checklist](./STOCKX_GO_LIVE_CHECKLIST.md)** - Comprehensive guide (30 min read)

### For Developers

- **Configuration Verification**: Run `node scripts/verify-stockx-config.mjs`
- **API Endpoints**: See `/src/app/api/stockx/` directory
- **Client Library**: See `/src/lib/services/stockx/client.ts`
- **Mock Implementation**: See `/src/lib/services/stockx/products.ts`

## Quick Commands

### Verify Configuration
```bash
node scripts/verify-stockx-config.mjs
```

### Test OAuth Flow (Local)
```bash
# 1. Set environment variables in .env.local
# 2. Start dev server
npm run dev

# 3. Navigate to http://localhost:3000/portfolio/settings/integrations
# 4. Click "Connect Account"
```

### Apply Database Migrations
```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

### Test Cron Jobs Manually
```bash
# With cURL
curl -X GET "http://localhost:3000/api/cron/stockx/prices" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Check Logs
```bash
# Vercel production logs
vercel logs YOUR_PROJECT_NAME

# Or use Vercel Dashboard → Deployments → View Function Logs
```

## Environment Variables

### Required for Production

```bash
# Feature Flags
NEXT_PUBLIC_STOCKX_ENABLE=true    # Enable StockX integration
NEXT_PUBLIC_STOCKX_MOCK=false     # Disable mock mode for live API

# StockX API
STOCKX_API_BASE_URL=https://api.stockx.com
STOCKX_CLIENT_ID=your_client_id
STOCKX_CLIENT_SECRET=your_client_secret

# OAuth URLs
STOCKX_OAUTH_AUTHORIZE_URL=https://accounts.stockx.com/oauth/authorize
STOCKX_OAUTH_TOKEN_URL=https://accounts.stockx.com/oauth/token
STOCKX_USERINFO_URL=https://accounts.stockx.com/oauth/userinfo
STOCKX_REDIRECT_URI=https://archvd.vercel.app/api/stockx/oauth/callback

# Site Configuration
NEXT_PUBLIC_SITE_URL=https://archvd.vercel.app

# Cron Authentication
CRON_SECRET=your_secure_random_string
```

### Optional for Development

```bash
# Use mock mode for local development
NEXT_PUBLIC_STOCKX_ENABLE=true
NEXT_PUBLIC_STOCKX_MOCK=true  # No real API calls

# Local testing with real API
STOCKX_REDIRECT_URI=http://localhost:3000/api/stockx/oauth/callback
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## API Endpoints

### OAuth

- `GET /api/stockx/oauth/start` - Initiate OAuth flow
- `GET /api/stockx/oauth/callback` - Handle OAuth callback
- `POST /api/stockx/oauth/disconnect` - Disconnect account

### Status

- `GET /api/stockx/status` - Check connection status

### Manual Sync (User-triggered)

- `POST /api/stockx/sync/listings` - Sync user's listings
- `POST /api/stockx/sync/sales` - Sync user's sales/orders
- `POST /api/stockx/sync/prices` - Sync prices for user's inventory

### Cron Jobs (Background)

- `GET /api/cron/stockx/prices` - Sync prices for all users (hourly)
- `GET /api/cron/stockx/sales` - Sync sales for all users (every 30 min)
- `GET /api/cron/stockx/listings` - Sync listings for all users (daily 3 AM)

### Product Data

- `GET /api/stockx/products/[sku]/market` - Get market data for SKU
- `GET /api/stockx/search?q=` - Search StockX products

## Database Schema

### stockx_accounts

Stores OAuth tokens per user.

```sql
CREATE TABLE stockx_accounts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type TEXT DEFAULT 'Bearer',
  scope TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  account_email TEXT,
  account_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### stockx_market_prices

Market pricing data (bid/ask/last sale).

```sql
CREATE TABLE stockx_market_prices (
  sku TEXT NOT NULL,
  size TEXT NOT NULL,
  currency TEXT DEFAULT 'USD',
  lowest_ask NUMERIC,
  highest_bid NUMERIC,
  last_sale NUMERIC,
  as_of TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (sku, size, as_of)
);
```

### stockx_sales

Completed sales from StockX.

```sql
CREATE TABLE stockx_sales (
  stockx_order_id TEXT PRIMARY KEY,
  sku TEXT NOT NULL,
  size TEXT NOT NULL,
  currency TEXT DEFAULT 'USD',
  sale_price NUMERIC NOT NULL,
  sold_at TIMESTAMPTZ NOT NULL,
  commission_amount NUMERIC,
  processing_fee NUMERIC,
  shipping_cost NUMERIC,
  net_payout NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### stockx_listings

User's active listings on StockX.

```sql
CREATE TABLE stockx_listings (
  stockx_listing_id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  sku TEXT NOT NULL,
  size TEXT NOT NULL,
  currency TEXT DEFAULT 'USD',
  price NUMERIC NOT NULL,
  quantity INTEGER DEFAULT 1,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Security

### OAuth Flow
- Uses PKCE (Proof Key for Code Exchange) for enhanced security
- State parameter prevents CSRF attacks
- Tokens stored server-side only (not in browser)
- Secure, httpOnly cookies for OAuth state

### Token Management
- Access tokens auto-refresh before expiry
- Refresh tokens stored encrypted in database
- RLS policies ensure users only access their own tokens
- Service role key used for cron jobs only

### API Security
- All endpoints require authentication
- User-specific endpoints check `auth.uid()`
- Cron endpoints require `CRON_SECRET` header
- Rate limiting with exponential backoff

## Mock Mode

For development without real StockX credentials:

```bash
NEXT_PUBLIC_STOCKX_ENABLE=true
NEXT_PUBLIC_STOCKX_MOCK=true
```

Mock mode provides:
- Fake OAuth flow (no real authorization)
- Sample market data
- Simulated sync operations
- Same UI/UX as production

## Monitoring

### Key Metrics

Track these in production:
- OAuth success/failure rate
- Token refresh success rate
- Sync operation success rate
- Cron job execution rate
- API error rate (by endpoint)
- Connected user count

### Logs to Monitor

- `[StockX OAuth Start]` - OAuth initiation
- `[StockX OAuth Callback]` - OAuth completion
- `[StockX Client]` - API requests
- `[Cron StockX *]` - Background jobs

### Alerts to Set

- OAuth callback failures > 5%
- Cron job failures > 10%
- Token refresh failures
- API rate limit exceeded

## Troubleshooting

### Common Issues

**"StockX integration is not enabled"**
- Check `NEXT_PUBLIC_STOCKX_ENABLE=true` is set
- Redeploy after changing environment variables

**"OAuth not configured"**
- Verify `STOCKX_CLIENT_ID` and `STOCKX_CLIENT_SECRET` are set
- Check they're in the correct environment (production/preview)

**"Invalid redirect_uri"**
- Must match exactly in code and StockX developer portal
- Check for trailing slashes, protocol (https), port numbers

**"Token expired"**
- Refresh token may be invalid
- User needs to reconnect their account
- Check token refresh logic in logs

**Cron jobs not running**
- Requires Vercel Pro plan or higher
- Check `CRON_SECRET` is set correctly
- Verify cron paths are correct in `vercel.json`

### Debug Mode

Enable detailed logging:

```typescript
// In client.ts, set to console.log all requests
console.log('[StockX] API Request', {
  endpoint,
  method,
  token: maskStockxToken(token),
})
```

## Testing

### Manual Testing Checklist

- [ ] OAuth flow completes successfully
- [ ] Tokens stored in database
- [ ] Manual sync listings works
- [ ] Manual sync sales works
- [ ] Manual sync prices works
- [ ] Disconnect removes tokens
- [ ] Reconnect works after disconnect
- [ ] Token refresh works when expired
- [ ] Market prices display on product pages
- [ ] Cron jobs execute successfully

### Automated Testing

```bash
# Run verification script
node scripts/verify-stockx-config.mjs

# Check database tables exist
npx supabase db diff

# Test cron endpoint
curl -X GET "https://archvd.vercel.app/api/cron/stockx/prices" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Support

### Resources

- StockX Developer Portal: https://developer.stockx.com
- Internal docs: [STOCKX_GO_LIVE_CHECKLIST.md](./STOCKX_GO_LIVE_CHECKLIST.md)
- Verification script: `scripts/verify-stockx-config.mjs`

### Getting Help

1. Check [STOCKX_GO_LIVE_CHECKLIST.md](./STOCKX_GO_LIVE_CHECKLIST.md) troubleshooting section
2. Run `node scripts/verify-stockx-config.mjs` to verify config
3. Check Vercel function logs
4. Check Supabase logs
5. Contact StockX developer support

## Changelog

- **2025-01-18**: Initial StockX integration completed
  - OAuth 2.0 with PKCE
  - Manual and automated sync
  - Database schema
  - UI integration
  - Mock mode for development

---

**Last Updated**: 2025-01-18
**Status**: Ready for production deployment
