# Vercel Environment Variables

Set these in Vercel Dashboard → Your Project → Settings → Environment Variables

**IMPORTANT:** Set all of these for the **Production** environment.

## Required Variables

### Supabase
```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
```

### StockX Configuration
```
NEXT_PUBLIC_STOCKX_ENABLE=true
NEXT_PUBLIC_STOCKX_MOCK=false
STOCKX_API_BASE_URL=https://api.stockx.com
STOCKX_CLIENT_ID=<your-stockx-client-id>
STOCKX_CLIENT_SECRET=<your-stockx-client-secret>
STOCKX_API_KEY=<your-stockx-api-key>
STOCKX_OAUTH_AUTHORIZE_URL=https://accounts.stockx.com/oauth/authorize
STOCKX_OAUTH_TOKEN_URL=https://accounts.stockx.com/oauth/token
STOCKX_USERINFO_URL=https://accounts.stockx.com/oauth/userinfo
```

### Production URLs
```
NEXT_PUBLIC_SITE_URL=https://archvdio.vercel.app
NEXT_PUBLIC_BASE_URL=https://archvdio.vercel.app
STOCKX_REDIRECT_URI=https://archvdio.vercel.app/api/stockx/oauth/callback
```

### Cron Secret
```
CRON_SECRET=<your-cron-secret>
```

### Shopify (if using)
```
NEXT_PUBLIC_SHOPIFY_IMPORT_ENABLE=true
SHOPIFY_DOMAIN=<your-shopify-domain>
SHOPIFY_ACCESS_TOKEN=<your-shopify-access-token>
SHOPIFY_API_VERSION=2024-01
```

### Alias/GOAT (optional)
```
NEXT_PUBLIC_ALIAS_ENABLE=true
NEXT_PUBLIC_ALIAS_MOCK=true
```

## How to Set in Vercel

1. Go to https://vercel.com/dashboard
2. Select your project (archvdio)
3. Go to Settings → Environment Variables
4. For each variable above:
   - Click "Add New"
   - Enter Name (e.g., `STOCKX_API_KEY`)
   - Enter Value
   - Select **Production** environment
   - Click "Save"

## After Setting Variables

1. Redeploy your application (or push new commits)
2. Variables will be available on next deployment
