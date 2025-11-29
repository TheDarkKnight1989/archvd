# Vercel Deployment Checklist

**Project**: Archvd - Reseller Analytics Platform
**Framework**: Next.js 16.0.1 (App Router)
**Last Updated**: 2025-11-29

---

## 🎯 Pre-Deployment Status

✅ **Build**: Production build passes with zero errors (`npm run build`)
✅ **TypeScript**: No type errors
✅ **SSR/Hydration**: No blocking issues (see `/docs/SSR_HYDRATION_AUDIT.md`)
✅ **Environment Variables**: Documented (see `/docs/ENVIRONMENT_VARIABLES.md`)

---

## 📋 Deployment Steps

### Step 1: Verify Local Production Build

Before deploying, test the production build locally:

```bash
# Clean install dependencies
rm -rf node_modules package-lock.json
npm install

# Run production build
npm run build

# Test production server locally
npm start

# App should be running at http://localhost:3000
# Test critical flows:
# - Sign up / Sign in
# - Dashboard loads
# - Inventory page loads
# - Settings page loads
```

**Expected**: Build completes with ~96 routes, no errors, all pages load correctly.

---

### Step 2: Configure Vercel Project

1. **Import project to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Select the `main` branch for production deployments

2. **Framework Preset**: Vercel should auto-detect Next.js
   - ✅ Framework: Next.js
   - ✅ Root Directory: `.` (default)
   - ✅ Build Command: `npm run build` (default)
   - ✅ Output Directory: `.next` (default)
   - ✅ Install Command: `npm install` (default)

3. **Node.js Version**:
   - Set to `20.x` (recommended for Next.js 15+)

---

### Step 3: Configure Environment Variables

⚠️ **CRITICAL**: The app will not function without these variables.

#### 🚨 Required Variables (Must be set)

Add these in **Vercel Project Settings → Environment Variables**:

```bash
# Supabase (Database & Authentication) - REQUIRED
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Site Configuration - REQUIRED for OAuth redirects
NEXT_PUBLIC_SITE_URL=https://archvd.io  # Replace with your production domain
```

**Where to find Supabase keys**:
1. Go to your Supabase project dashboard
2. Click "Settings" → "API"
3. Copy `URL`, `anon/public key`, and `service_role key`

#### 🎛️ Optional: Feature Flags (Integrations)

Set these only if you want to enable integrations:

```bash
# StockX Integration (optional)
NEXT_PUBLIC_STOCKX_ENABLE=true  # Set to 'false' or omit to disable
NEXT_PUBLIC_STOCKX_MOCK=false   # Set to 'true' for mock mode

# Alias (GOAT) Integration (optional)
NEXT_PUBLIC_ALIAS_ENABLE=true   # Set to 'false' or omit to disable
NEXT_PUBLIC_ALIAS_MOCK=false    # Set to 'true' for mock mode

# Shopify Import (optional - coming soon)
NEXT_PUBLIC_SHOPIFY_IMPORT_ENABLE=false
```

#### 🔌 Optional: Integration Credentials

**Only set these if you enabled the corresponding integration above**.

**StockX** (only if `NEXT_PUBLIC_STOCKX_ENABLE=true`):
```bash
STOCKX_CLIENT_ID=your-stockx-client-id
STOCKX_CLIENT_SECRET=your-stockx-client-secret
STOCKX_REDIRECT_URI=https://archvd.io/api/stockx/oauth/callback  # Match your domain
STOCKX_API_KEY=your-stockx-api-key
STOCKX_API_URL=https://api.stockx.com
```

**Alias (GOAT)** (only if `NEXT_PUBLIC_ALIAS_ENABLE=true`):
```bash
ALIAS_PAT=your-alias-personal-access-token
NEXT_PUBLIC_ALIAS_API_BASE_URL=https://api.alias.com
```

**Shopify** (only if `NEXT_PUBLIC_SHOPIFY_IMPORT_ENABLE=true`):
```bash
SHOPIFY_SHOP_DOMAIN=yourstore.myshopify.com
SHOPIFY_ACCESS_TOKEN=your-shopify-admin-api-token
SHOPIFY_API_VERSION=2024-01
```

#### 🛡️ Optional: Security (Recommended)

```bash
CRON_SECRET=your-random-secret-string  # For protecting cron endpoints
```

Generate a secure random string:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Step 4: Configure Vercel Settings

#### Environment Scope

For each environment variable, select which environments it applies to:

- ✅ **Production**: Always set required variables
- ✅ **Preview**: Recommended for testing branches
- ⚠️ **Development**: Optional (prefer `.env.local` for local dev)

#### Custom Domains

1. Go to **Project Settings → Domains**
2. Add your custom domain (e.g., `archvd.io`, `www.archvd.io`)
3. Follow Vercel's DNS configuration instructions
4. **Important**: Update `NEXT_PUBLIC_SITE_URL` to match your primary domain

#### Build & Development Settings

- **Node.js Version**: `20.x`
- **Framework**: Next.js
- **Build Command**: `npm run build` (default)
- **Install Command**: `npm install` (default)

---

### Step 5: Deploy!

1. **Trigger Deployment**:
   - Push to `main` branch (triggers automatic deployment)
   - OR click "Deploy" in Vercel dashboard

2. **Monitor Build**:
   - Watch the build logs in Vercel dashboard
   - Expected build time: 2-4 minutes
   - Look for: "Build Completed" status

3. **Verify Deployment**:
   - Visit your production URL (e.g., `https://archvd.io`)
   - Test critical flows:
     - ✅ Home page loads
     - ✅ Sign up / Sign in works
     - ✅ Dashboard loads with data
     - ✅ Settings page loads
     - ✅ Inventory page works

---

## 🧪 Post-Deployment Testing

### Critical User Flows

Test these flows in production to ensure everything works:

1. **Authentication**:
   - [ ] Sign up with new account
   - [ ] Sign in with existing account
   - [ ] Password reset flow
   - [ ] Sign out

2. **Core Features**:
   - [ ] Dashboard loads and displays metrics
   - [ ] Inventory page loads and displays items
   - [ ] Add new item to inventory
   - [ ] Edit existing item
   - [ ] Mark item as sold
   - [ ] View sales history
   - [ ] View P&L reports

3. **Settings**:
   - [ ] Settings page loads
   - [ ] Can change base currency (Accounting tab)
   - [ ] Integrations page loads (Integrations tab)

4. **Integrations** (if enabled):
   - [ ] StockX OAuth flow works
   - [ ] Alias connection works
   - [ ] Market data syncs

---

## 🚨 Troubleshooting

### Build Fails with "Module not found"

**Cause**: Missing dependencies or incorrect import paths
**Fix**:
```bash
# Clean install locally and test
rm -rf node_modules package-lock.json .next
npm install
npm run build
```

### App Loads but Shows "Not authenticated" Error

**Cause**: Missing Supabase environment variables
**Fix**:
1. Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in Vercel
2. Redeploy after adding variables

### OAuth Redirects Fail (404 or wrong URL)

**Cause**: `NEXT_PUBLIC_SITE_URL` not set or incorrect
**Fix**:
1. Set `NEXT_PUBLIC_SITE_URL=https://your-domain.com` in Vercel
2. Update `STOCKX_REDIRECT_URI=https://your-domain.com/api/stockx/oauth/callback`
3. Update StockX OAuth app settings to allow this redirect URI
4. Redeploy

### "500 Internal Server Error" on API Routes

**Cause**: Missing server-side environment variables (e.g., `SUPABASE_SERVICE_ROLE_KEY`)
**Fix**:
1. Check Vercel Function Logs (Project → Deployments → [Deployment] → Functions)
2. Add missing environment variables
3. Redeploy

### Hydration Errors in Console

**Cause**: Server/client render mismatch
**Status**: ✅ Should not occur - see `/docs/SSR_HYDRATION_AUDIT.md`
**Fix**: If this happens, check browser console for specific component causing issue

---

## 📊 Monitoring & Logs

### Vercel Dashboard

- **Deployments**: View all deployments and their status
- **Analytics**: Monitor page views, Core Web Vitals
- **Functions**: View serverless function logs
- **Insights**: Performance metrics

### Enable Error Tracking (Optional)

Consider integrating:
- **Sentry**: Error tracking and performance monitoring
- **LogRocket**: Session replay and error tracking
- **PostHog**: Product analytics

---

## 🔄 Continuous Deployment

Vercel automatically deploys when you push to GitHub:

- **Production**: Pushes to `main` branch → Production deployment
- **Preview**: Pushes to other branches → Preview deployment
- **Pull Requests**: Automatic preview deployments with unique URLs

**Recommended Git Workflow**:
```bash
# Feature development
git checkout -b feature/new-feature
# ... make changes ...
git push origin feature/new-feature
# Create PR → Vercel creates preview deployment

# After review, merge to main
git checkout main
git merge feature/new-feature
git push origin main
# Vercel automatically deploys to production
```

---

## 📝 Environment Variables Summary

See `/docs/ENVIRONMENT_VARIABLES.md` for full details.

**Minimum Required (Names Only - No Values)**:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL
```

**Optional Feature Flags**:
```
NEXT_PUBLIC_STOCKX_ENABLE
NEXT_PUBLIC_ALIAS_ENABLE
NEXT_PUBLIC_SHOPIFY_IMPORT_ENABLE
```

**Optional Integration Credentials** (only if features enabled):
```
STOCKX_CLIENT_ID
STOCKX_CLIENT_SECRET
STOCKX_API_KEY
ALIAS_PAT
SHOPIFY_SHOP_DOMAIN
SHOPIFY_ACCESS_TOKEN
```

---

## ✅ Final Checklist

Before clicking "Deploy":

- [ ] Production build passes locally (`npm run build`)
- [ ] All required environment variables set in Vercel
- [ ] `NEXT_PUBLIC_SITE_URL` matches production domain
- [ ] Supabase credentials tested and working
- [ ] Custom domain configured in Vercel (if applicable)
- [ ] OAuth redirect URIs updated in third-party platforms (StockX, etc.)
- [ ] Node.js version set to 20.x in Vercel

After deployment:

- [ ] Verify production URL loads
- [ ] Test authentication flow
- [ ] Test core features (dashboard, inventory, sales)
- [ ] Check Vercel Function Logs for errors
- [ ] Monitor Analytics for traffic

---

## 🎉 Success!

If all checks pass, your app is now live on Vercel! 🚀

**Next Steps**:
1. Share the URL with users
2. Monitor Vercel Analytics
3. Set up error tracking (Sentry, etc.)
4. Configure domain email (if needed)
5. Enable cron jobs (if using scheduled tasks)

For questions or issues, check:
- **Vercel Docs**: https://vercel.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Supabase Docs**: https://supabase.com/docs

---

**Last Build Verified**: 2025-11-29
**Build Status**: ✅ PASS (96 routes)
**TypeScript**: ✅ PASS
**SSR/Hydration**: ✅ PASS
