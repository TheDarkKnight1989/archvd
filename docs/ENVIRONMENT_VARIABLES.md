# Environment Variables Documentation

This document lists all environment variables used in the Archvd application, grouped by category and purpose.

## 🚨 Required Variables (Application will not function without these)

### Supabase (Database & Authentication)

| Variable | Type | Purpose | Usage Location |
|----------|------|---------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client | Supabase project URL for client-side connections | All pages using `supabase.auth` or database queries |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Supabase anonymous/public API key for client auth | All pages using `supabase.auth` or database queries |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Supabase service role key for server-side admin operations | API routes requiring elevated privileges |

**Impact if missing**: Application will fail to boot. Users cannot authenticate, and no data can be fetched.

---

## 🎛️ Feature Flags (Optional - Control Feature Availability)

### StockX Integration

| Variable | Type | Purpose | Default | Usage Location |
|----------|------|---------|---------|----------------|
| `NEXT_PUBLIC_STOCKX_ENABLE` | Client | Enable/disable StockX integration UI | `false` | Settings page, listing pages, market data components |
| `NEXT_PUBLIC_STOCKX_MOCK` | Client | Use mock StockX data instead of live API | `false` | StockX API service layer |

### Alias (GOAT) Integration

| Variable | Type | Purpose | Default | Usage Location |
|----------|------|---------|---------|----------------|
| `NEXT_PUBLIC_ALIAS_ENABLE` | Client | Enable/disable Alias (GOAT) integration UI | `false` | Settings page, listing pages |
| `NEXT_PUBLIC_ALIAS_MOCK` | Client | Use mock Alias data instead of live API | `false` | Alias API service layer |

### Shopify Import

| Variable | Type | Purpose | Default | Usage Location |
|----------|------|---------|---------|----------------|
| `NEXT_PUBLIC_SHOPIFY_IMPORT_ENABLE` | Client | Enable/disable Shopify import feature | `false` | Import pages, settings |

**Impact if missing**: Features will be disabled by default. App remains functional for core inventory/portfolio tracking.

---

## 🔌 Integration Credentials (Optional - Only required if integration is enabled)

### StockX OAuth & API

| Variable | Type | Purpose | Required When | Usage Location |
|----------|------|---------|---------------|----------------|
| `STOCKX_CLIENT_ID` | Server | StockX OAuth application client ID | `NEXT_PUBLIC_STOCKX_ENABLE=true` | `/api/stockx/oauth/start` |
| `STOCKX_CLIENT_SECRET` | Server | StockX OAuth application secret | `NEXT_PUBLIC_STOCKX_ENABLE=true` | `/api/stockx/oauth/callback` |
| `STOCKX_REDIRECT_URI` | Server | OAuth callback URL (fallback: `NEXT_PUBLIC_SITE_URL/api/stockx/oauth/callback`) | `NEXT_PUBLIC_STOCKX_ENABLE=true` | `/api/stockx/oauth/start` |
| `STOCKX_API_KEY` | Server | StockX API key for product/market data | `NEXT_PUBLIC_STOCKX_ENABLE=true` | `/api/stockx/products`, `/api/stockx/market-data` |
| `STOCKX_API_URL` | Server | StockX API base URL | `NEXT_PUBLIC_STOCKX_ENABLE=true` | All StockX API routes |

**Default Behavior**: If not set, StockX integration will be non-functional (OAuth will fail, API calls will error).

### Alias (GOAT) API

| Variable | Type | Purpose | Required When | Usage Location |
|----------|------|---------|---------------|----------------|
| `ALIAS_PAT` | Server | Alias Personal Access Token for API authentication | `NEXT_PUBLIC_ALIAS_ENABLE=true` | All `/api/alias/*` routes |
| `NEXT_PUBLIC_ALIAS_API_BASE_URL` | Client | Alias API base URL (e.g., `https://api.alias.com`) | `NEXT_PUBLIC_ALIAS_ENABLE=true` | Alias service layer, client-side API calls |

**Default Behavior**: If not set, Alias integration will be non-functional (API calls will fail with 401 Unauthorized).

### Shopify API

| Variable | Type | Purpose | Required When | Usage Location |
|----------|------|---------|---------------|----------------|
| `SHOPIFY_SHOP_DOMAIN` | Server | Shopify store domain (e.g., `yourstore.myshopify.com`) | `NEXT_PUBLIC_SHOPIFY_IMPORT_ENABLE=true` | `/api/shopify/import` |
| `SHOPIFY_ACCESS_TOKEN` | Server | Shopify Admin API access token | `NEXT_PUBLIC_SHOPIFY_IMPORT_ENABLE=true` | `/api/shopify/import` |
| `SHOPIFY_API_VERSION` | Server | Shopify API version (e.g., `2024-01`) | `NEXT_PUBLIC_SHOPIFY_IMPORT_ENABLE=true` | `/api/shopify/import` |

**Default Behavior**: If not set, Shopify import will be non-functional.

---

## 🌐 Site Configuration

| Variable | Type | Purpose | Default | Usage Location |
|----------|------|---------|---------|----------------|
| `NEXT_PUBLIC_SITE_URL` | Client | Public site URL for OAuth redirects and absolute URLs | `http://localhost:3000` (dev) | OAuth callbacks, email templates, sitemap |

**Impact if missing**:
- Development: Falls back to `http://localhost:3000` (safe)
- Production (Vercel): **MUST be set** to production domain (e.g., `https://archvd.io`) or OAuth redirects will fail

---

## ⏱️ Background Jobs & Cron

| Variable | Type | Purpose | Required When | Usage Location |
|----------|------|---------|---------------|----------------|
| `CRON_SECRET` | Server | Secret token to authenticate cron job requests | Using Vercel Cron or external schedulers | `/api/market/scheduler/run` |

**Default Behavior**: If not set, cron endpoints will be unprotected (anyone can trigger them). Recommended to set in production.

---

## 📋 Deployment Checklist for Vercel

### ✅ Minimum Required (App will not boot without these)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=https://archvd.io  # Replace with your production domain
```

### 🔧 Optional Feature Flags (Set to enable integrations)

```bash
# StockX
NEXT_PUBLIC_STOCKX_ENABLE=true
NEXT_PUBLIC_STOCKX_MOCK=false

# Alias (GOAT)
NEXT_PUBLIC_ALIAS_ENABLE=true
NEXT_PUBLIC_ALIAS_MOCK=false

# Shopify
NEXT_PUBLIC_SHOPIFY_IMPORT_ENABLE=false  # Coming soon
```

### 🔑 Optional Integration Credentials (Only if enabled above)

**StockX** (only if `NEXT_PUBLIC_STOCKX_ENABLE=true`):
```bash
STOCKX_CLIENT_ID=your-client-id
STOCKX_CLIENT_SECRET=your-client-secret
STOCKX_REDIRECT_URI=https://archvd.io/api/stockx/oauth/callback
STOCKX_API_KEY=your-api-key
STOCKX_API_URL=https://api.stockx.com
```

**Alias** (only if `NEXT_PUBLIC_ALIAS_ENABLE=true`):
```bash
ALIAS_PAT=your-personal-access-token
NEXT_PUBLIC_ALIAS_API_BASE_URL=https://api.alias.com
```

**Shopify** (only if `NEXT_PUBLIC_SHOPIFY_IMPORT_ENABLE=true`):
```bash
SHOPIFY_SHOP_DOMAIN=yourstore.myshopify.com
SHOPIFY_ACCESS_TOKEN=your-access-token
SHOPIFY_API_VERSION=2024-01
```

### 🛡️ Optional Security (Recommended for production)

```bash
CRON_SECRET=your-random-secret-string  # For protecting cron endpoints
```

---

## 🧪 Testing Configuration

For local development, copy `.env.example` to `.env.local` and fill in at minimum:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

All integrations will be disabled by default unless you set the corresponding `NEXT_PUBLIC_*_ENABLE=true` flag.

---

## ⚠️ Common Issues

### Issue: "Not authenticated" error on app boot
**Cause**: Missing Supabase environment variables
**Fix**: Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set

### Issue: StockX OAuth redirect fails
**Cause**: `NEXT_PUBLIC_SITE_URL` not set or incorrect
**Fix**: Set to production domain (e.g., `https://archvd.io`) and update `STOCKX_REDIRECT_URI` to match

### Issue: "Unauthorized" when calling Alias API
**Cause**: Missing or invalid `ALIAS_PAT`
**Fix**: Generate a new PAT from Alias dashboard and set in Vercel environment variables

### Issue: Market data scheduler failing
**Cause**: Missing `CRON_SECRET` or incorrect secret
**Fix**: Set `CRON_SECRET` in Vercel and configure the same value in your cron trigger

---

## 📝 Notes

- **Client vs Server Variables**: Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Never put secrets in `NEXT_PUBLIC_*` variables.
- **Vercel Environment Variables**: Add all variables in the Vercel project settings under "Environment Variables". Remember to set them for Production, Preview, and Development environments as needed.
- **Local Development**: Use `.env.local` (gitignored) for local development. Never commit `.env.local` to version control.
- **Fallback Behavior**: Most integration features gracefully degrade if credentials are missing (features are hidden or disabled). Core portfolio tracking remains functional.
