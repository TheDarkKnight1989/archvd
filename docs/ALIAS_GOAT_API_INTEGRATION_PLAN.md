# Alias (GOAT) API Integration Plan
**Date:** 2025-11-13
**Status:** Architecture & Planning Phase
**Target:** Best-in-class SaaS for sneaker resellers and collectors

---

## Executive Summary

This document outlines the integration of the **Alias by GOAT Group API** into the ArchVD platform. The integration will transform the current mock-data system into a live, production-ready platform with real-time market data, automated inventory management, and advanced analytics for sneaker resellers and collectors.

### Key Benefits
- **Live Market Data**: Real-time pricing from GOAT marketplace
- **Automated Inventory Sync**: Bidirectional sync between ArchVD and GOAT listings
- **Sales Automation**: Automatic sale recording and profit tracking
- **Advanced Analytics**: Market trends, pricing optimization, portfolio insights
- **Multi-Marketplace**: Foundation for StockX, Flight Club, Stadium Goods expansion

---

## 1. Alias API Overview

### Authentication
- **Method**: Bearer token authentication
- **Headers Required**:
  - `Authorization: Bearer {access_token}`
  - `User-Agent`: Custom (recommend: `ArchVD/1.0`)
  - `Content-Type: application/json`

### Rate Limits
- **To be confirmed** from official docs (likely tiered based on plan)
- **Recommendation**: Implement exponential backoff + request queuing

### Key API Capabilities

#### A. Product Discovery & Search
- **Search Products**: Keyword search with filters (brand, size, price range)
- **Product Details**: Get full product info by SKU/slug
- **Product Variants**: Size-specific availability and pricing

#### B. Market Data
- **Live Pricing**: Current ask/bid prices per size
- **Sales History**: Recent sales with timestamps
- **Lowest Ask**: Real-time lowest ask price tracking
- **Highest Bid**: Current demand signals

#### C. Seller Operations
- **List Products**: Create new listings with price/size
- **Update Listings**: Modify prices individually or in bulk
- **Cancel Listings**: Remove products from sale
- **Query Listings**: Get all active listings
- **Sold Orders**: Fetch completed sales
- **Vacation Mode**: Pause all listings temporarily

#### D. Transaction Management
- **Order Confirmation**: Confirm pending sales
- **Shipping Labels**: Generate prepaid labels
- **Order Cancellation**: Handle cancellations/returns

#### E. User/Seller Profile
- **Get User Info**: Profile details, ratings, stats
- **Seller Analytics**: Sales volume, conversion rates, performance metrics

---

## 2. Module-by-Module Integration Map

### 2.1 **Inventory Management** (`/portfolio/inventory`)

**Current State:**
- Manual entry via `AddItemModal`
- Static product catalog (`product_catalog` table)
- Mock pricing data

**Alias API Integration:**

| Feature | Endpoint(s) | Purpose | Priority |
|---------|------------|---------|----------|
| **Product Lookup** | `GET /search/{query}` | Auto-fill product details when adding items | P0 |
| **Product Details** | `GET /product_templates/{slug}/show_v2` | Get brand, model, colorway, retail price, images | P0 |
| **Size Variants** | `GET /product_variants/buy_bar_data` | Validate sizes, get size-specific SKUs | P0 |
| **Auto-List on GOAT** | `POST /listings` | One-click list inventory items to GOAT marketplace | P1 |
| **Bulk Price Update** | `PATCH /listings/bulk` | Sync local price changes to GOAT | P1 |
| **Inventory Sync** | `GET /listings` | Pull GOAT listings → create/update local Inventory | P2 |

**New Features Enabled:**
- ✅ **Smart Add**: Search GOAT catalog, auto-populate all fields (brand, model, colorway, retail, image)
- ✅ **Cross-Post Toggle**: Checkbox to "List on GOAT" when adding items
- ✅ **Listing Status Indicator**: Show which items are live on GOAT vs local-only
- ✅ **Quick List**: Bulk select items → list all to GOAT with one click
- ✅ **Vacation Mode Widget**: Pause all GOAT listings from ArchVD dashboard

**Database Changes:**
```sql
ALTER TABLE "Inventory" ADD COLUMN goat_listing_id TEXT UNIQUE;
ALTER TABLE "Inventory" ADD COLUMN goat_status TEXT CHECK (goat_status IN ('draft', 'listed', 'sold', 'cancelled'));
ALTER TABLE "Inventory" ADD COLUMN goat_price NUMERIC(10,2);
ALTER TABLE "Inventory" ADD COLUMN goat_listed_at TIMESTAMPTZ;
ALTER TABLE "Inventory" ADD COLUMN goat_sync_status TEXT DEFAULT 'synced';
ALTER TABLE "Inventory" ADD COLUMN goat_last_sync TIMESTAMPTZ;
```

---

### 2.2 **Market Intelligence** (`/portfolio/market`)

**Current State:**
- Mock pricing from `product_market_prices`
- Static price charts
- No real-time data

**Alias API Integration:**

| Feature | Endpoint(s) | Purpose | Priority |
|---------|------------|---------|----------|
| **Live Pricing** | `GET /product_variants/buy_bar_data` | Real-time ask/bid prices per size | P0 |
| **Sales History** | `GET /products/{slug}/sales` | Historical sales data for charting | P0 |
| **Lowest Ask Tracking** | `GET /products/{slug}/lowest_ask` | Monitor price floor | P1 |
| **Market Depth** | `GET /products/{slug}/market_depth` | See full order book (all asks/bids) | P1 |

**New Features Enabled:**
- ✅ **Real-Time Price Updates**: Live ask/bid prices (refresh every 60s)
- ✅ **Price Alerts 2.0**: Trigger on GOAT price changes (not just target price)
- ✅ **Sales Volume Charts**: Visualize daily/weekly sales volume
- ✅ **Market Sentiment**: Show bid/ask ratio, velocity, liquidity
- ✅ **Price Predictor**: ML model trained on historical GOAT sales
- ✅ **Comparative Pricing**: Show ArchVD price vs GOAT ask vs last sale

**Database Changes:**
```sql
-- Extend product_market_prices
ALTER TABLE product_market_prices ADD COLUMN ask_price NUMERIC(10,2);
ALTER TABLE product_market_prices ADD COLUMN bid_price NUMERIC(10,2);
ALTER TABLE product_market_prices ADD COLUMN sales_volume INT;
ALTER TABLE product_market_prices ADD COLUMN num_asks INT;
ALTER TABLE product_market_prices ADD COLUMN num_bids INT;
ALTER TABLE product_market_prices ADD COLUMN spread_pct NUMERIC(5,2);

-- New table for sales history
CREATE TABLE goat_sales_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL,
  size TEXT NOT NULL,
  sale_price NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  sold_at TIMESTAMPTZ NOT NULL,
  condition TEXT, -- 'new', 'used', 'defects'
  source TEXT DEFAULT 'goat',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_goat_sales_sku_size ON goat_sales_history(sku, size, sold_at DESC);
```

---

### 2.3 **Sales Tracking** (`/portfolio/sales`)

**Current State:**
- Manual "Mark as Sold" flow
- `sales` table auto-populated via trigger
- Platform dropdown (ebay, depop, vinted, etc.)

**Alias API Integration:**

| Feature | Endpoint(s) | Purpose | Priority |
|---------|------------|---------|----------|
| **Fetch Sold Orders** | `GET /orders/sold` | Auto-import GOAT sales | P0 |
| **Order Details** | `GET /orders/{order_id}` | Get buyer info, fees, shipping cost | P0 |
| **Confirm Sale** | `POST /orders/{order_id}/confirm` | Mark order ready to ship | P1 |
| **Generate Label** | `POST /orders/{order_id}/shipping_label` | Get prepaid shipping label | P1 |

**New Features Enabled:**
- ✅ **Auto-Import Sales**: Cron job fetches GOAT sales every 15 min → creates `sales` records
- ✅ **Unified Sales Dashboard**: All platforms (GOAT, eBay, Depop, etc.) in one view
- ✅ **Fee Breakdown**: Separate GOAT commission, payment processing, shipping
- ✅ **Label Integration**: Download/print shipping labels directly from ArchVD
- ✅ **Sale Notifications**: Toast when new GOAT sale detected
- ✅ **Auto-Status Sync**: Update inventory status when GOAT order confirmed

**Database Changes:**
```sql
ALTER TABLE sales ADD COLUMN goat_order_id TEXT UNIQUE;
ALTER TABLE sales ADD COLUMN goat_buyer_id TEXT;
ALTER TABLE sales ADD COLUMN goat_commission NUMERIC(10,2);
ALTER TABLE sales ADD COLUMN goat_processing_fee NUMERIC(10,2);
ALTER TABLE sales ADD COLUMN goat_shipping_label_url TEXT;
ALTER TABLE sales ADD COLUMN goat_tracking_number TEXT;
ALTER TABLE sales ADD COLUMN goat_confirmed_at TIMESTAMPTZ;
ALTER TABLE sales ADD COLUMN goat_shipped_at TIMESTAMPTZ;
```

---

### 2.4 **P&L Analytics** (`/portfolio/pnl`)

**Current State:**
- P&L views aggregating `sales` table
- Manual expense tracking
- Basic profit margins

**Alias API Integration:**

| Feature | Endpoint(s) | Purpose | Priority |
|---------|------------|---------|----------|
| **Fee Schedules** | `GET /seller/fee_schedule` | Accurate commission calculation | P1 |
| **Seller Analytics** | `GET /seller/analytics` | GOAT-specific performance metrics | P2 |

**New Features Enabled:**
- ✅ **Platform-Specific P&L**: Filter by GOAT vs other platforms
- ✅ **Fee Accuracy**: Use actual GOAT fee structure (not estimates)
- ✅ **ROI by Platform**: Compare profitability across marketplaces
- ✅ **GOAT Performance Score**: Show seller rating, response time, ship time
- ✅ **Commission Forecasting**: Predict fees based on listing prices

---

### 2.5 **Watchlists & Alerts** (`/portfolio/watchlists`)

**Current State:**
- User-created watchlists
- Price alerts triggered by `refresh_watchlist_alerts()`
- Pulls from `sneaker_latest_prices`, `tcg_latest_prices`

**Alias API Integration:**

| Feature | Endpoint(s) | Purpose | Priority |
|---------|------------|---------|----------|
| **Live Price Monitoring** | `GET /product_variants/buy_bar_data` | Track GOAT ask prices for watchlist items | P0 |
| **Sales Alerts** | `GET /products/{slug}/sales` (polling) | Notify when item sells near target price | P1 |
| **Price Drop Alerts** | Derived from price history | Alert when ask drops X% in Y hours | P1 |

**New Features Enabled:**
- ✅ **Multi-Trigger Alerts**: Target price, price drop %, sales velocity spike
- ✅ **Smart Notifications**: "Similar item sold for £X 10 min ago"
- ✅ **Buy Recommendation**: "Current ask £10 below 30-day average"
- ✅ **Liquidity Alerts**: "Only 3 pairs available in your size"

**Database Changes:**
```sql
ALTER TABLE watchlist_items ADD COLUMN alert_type TEXT[] DEFAULT '{target_price}';
ALTER TABLE watchlist_items ADD COLUMN alert_threshold_pct NUMERIC(5,2); -- for drop %
ALTER TABLE watchlist_items ADD COLUMN alert_timeframe_hours INT; -- lookback window
ALTER TABLE watchlist_items ADD COLUMN goat_product_id TEXT;
```

---

### 2.6 **Releases Calendar** (`/portfolio/releases`)

**Current State:**
- Scrapes thedropdate.com for release info
- `releases` table with date, product, retail price

**Alias API Integration:**

| Feature | Endpoint(s) | Purpose | Priority |
|---------|------------|---------|----------|
| **Upcoming Releases** | `GET /releases/upcoming` | GOAT's official release calendar | P1 |
| **Hype Index** | `GET /products/{slug}/interest` | Pre-release demand signals | P2 |
| **Raffle Info** | `GET /releases/{id}/raffles` | Where to enter for pairs | P2 |

**New Features Enabled:**
- ✅ **Dual-Source Releases**: Combine thedropdate + GOAT data
- ✅ **Hype Score**: Show GOAT interest level (wishlist adds, searches)
- ✅ **Profit Estimator**: "Expected resale: £X (retail: £Y) → Profit: £Z"
- ✅ **Release Reminders**: Push notification 1 day before drop
- ✅ **One-Click Flip**: Add to inventory on release day, auto-list to GOAT

---

### 2.7 **Expenses Tracking** (`/portfolio/expenses`)

**Current State:**
- Manual expense entry (shipping, storage, etc.)
- `expenses` table

**Alias API Integration:**

| Feature | Endpoint(s) | Purpose | Priority |
|---------|------------|---------|----------|
| **Shipping Costs** | `GET /orders/{id}/shipping_cost` | Auto-log GOAT shipping fees | P1 |
| **Label Costs** | Derived from shipping labels | Track prepaid label expenses | P2 |

**New Features Enabled:**
- ✅ **Auto-Expense Import**: GOAT shipping fees → expenses table
- ✅ **Expense Categorization**: Separate GOAT fees, shipping, storage, etc.
- ✅ **True Profit Calc**: Deduct all GOAT-related expenses from P&L

---

### 2.8 **Analytics Dashboard** (`/portfolio/analytics`)

**Current State:**
- Portfolio overview (KPIs, charts)
- Activity feed

**Alias API Integration:**

| Feature | Endpoint(s) | Purpose | Priority |
|---------|------------|---------|----------|
| **Seller Metrics** | `GET /seller/analytics` | GOAT sales velocity, avg. ship time, ratings | P1 |
| **Inventory Turnover** | Derived from listings + sales | Days to sell, stock aging | P1 |
| **Market Share** | Derived from GOAT data | Your listings vs total market | P2 |

**New Features Enabled:**
- ✅ **GOAT Performance Widget**: Seller rating, response time, defect rate
- ✅ **Turnover Analysis**: "Avg. 12 days to sell on GOAT"
- ✅ **Velocity Heatmap**: Which SKUs/sizes sell fastest
- ✅ **Competitive Pricing**: "Your ask is 5% above market average"
- ✅ **Inventory Health Score**: Flag slow movers, overpriced items
- ✅ **ROI Leaderboard**: Best/worst performing SKUs

---

### 2.9 **NEW MODULE: Repricing Engine**

**Not Currently Built – High Value Add**

**Alias API Integration:**

| Feature | Endpoint(s) | Purpose | Priority |
|---------|------------|---------|----------|
| **Market Prices** | `GET /product_variants/buy_bar_data` | Get current ask/bid landscape | P0 |
| **Update Listings** | `PATCH /listings/{id}` or bulk | Auto-adjust prices | P0 |
| **Sales Velocity** | `GET /products/{slug}/sales` | Optimize price for speed vs margin | P1 |

**Features:**
- ✅ **Auto-Reprice**: "Keep my ask $5 below lowest competitor"
- ✅ **Dynamic Pricing**: Increase price when supply drops, decrease when stale
- ✅ **Profit Floor**: Never drop below X% margin
- ✅ **Velocity Mode**: "Sell in 3 days" → aggressive pricing
- ✅ **Rules Engine**: "If listed >7 days, drop 5%"
- ✅ **A/B Testing**: Try different price points, measure conversion

**Database Changes:**
```sql
CREATE TABLE repricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  rule_type TEXT CHECK (rule_type IN ('undercut', 'velocity', 'margin', 'aging')),
  params JSONB NOT NULL, -- {undercut_amount: 5, min_margin_pct: 15, ...}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE repricing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES "Inventory"(id),
  old_price NUMERIC(10,2),
  new_price NUMERIC(10,2),
  reason TEXT,
  rule_id UUID REFERENCES repricing_rules(id),
  applied_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 2.10 **NEW MODULE: Demand Forecasting**

**Not Currently Built – Premium Feature**

**Alias API Integration:**

| Feature | Endpoint(s) | Purpose | Priority |
|---------|------------|---------|----------|
| **Historical Sales** | `GET /products/{slug}/sales` | Train ML model on sales patterns | P2 |
| **Search Trends** | `GET /products/{slug}/searches` (if available) | Measure demand | P2 |
| **Wishlist Adds** | `GET /products/{slug}/wishlists` (if available) | Future demand signal | P2 |

**Features:**
- ✅ **Price Prediction**: "Expected to hit £X in 30 days"
- ✅ **Sell Now vs Hold**: "If you hold 2 weeks, gain £15 (82% confidence)"
- ✅ **Demand Heatmap**: Calendar showing predicted price peaks
- ✅ **Trend Detection**: "This SKU trending up 3 weeks straight"
- ✅ **Seasonal Patterns**: "Jordans spike in Q4"

---

### 2.11 **NEW MODULE: Competitor Intelligence**

**Not Currently Built – Advanced Feature**

**Alias API Integration:**

| Feature | Endpoint(s) | Purpose | Priority |
|---------|------------|---------|----------|
| **Market Depth** | `GET /products/{slug}/market_depth` | See all active listings | P2 |
| **Seller Profiles** | `GET /sellers/{id}` (if available) | Track competitor strategies | P3 |

**Features:**
- ✅ **Pricing Matrix**: Table showing all asks by size + seller
- ✅ **Competitor Tracker**: Monitor specific sellers' listings
- ✅ **Undercut Alerts**: "Competitor dropped price by £10"
- ✅ **Market Gap Finder**: "No asks for UK9 – opportunity!"
- ✅ **Bulk Listing Detector**: "Seller just listed 50 pairs – potential price drop"

---

## 3. New Premium Features (Best-in-Class)

### 3.1 **Multi-Marketplace Arbitrage**
- Compare prices across GOAT, StockX, Flight Club, Stadium Goods
- Auto-route listings to platform with highest net profit
- Cross-marketplace repricing

### 3.2 **Consignment Management**
- Track items on consignment (not owned yet)
- GOAT consignment automation
- Commission splits with suppliers

### 3.3 **Portfolio Optimizer**
- "You should sell {X} and buy {Y} to maximize returns"
- Risk diversification suggestions
- Capital allocation recommendations

### 3.4 **Tax Reporting**
- Auto-generate P&L for tax filing
- VAT/GST compliance reports
- Inventory valuation snapshots

### 3.5 **Team Collaboration**
- Multi-user accounts (owner, staff, accountant)
- Role-based access control
- Activity audit log

### 3.6 **Mobile App**
- Barcode scanner for quick adds
- Push notifications for sales/alerts
- Quick price adjustments on the go

### 3.7 **Bulk Import/Export**
- CSV import from GOAT, StockX, eBay
- One-click migration from competitor platforms
- Export for accounting software (QuickBooks, Xero)

### 3.8 **Social Proof & Reviews**
- Embed GOAT seller rating in ArchVD
- Customer review aggregation
- Automated thank-you messages

### 3.9 **Smart Photography**
- AI-powered defect detection
- Auto-enhance product photos
- 360° photo builder

### 3.10 **Financing Integration**
- Connect to business bank accounts
- Cash flow forecasting
- Loan eligibility calculator

---

## 4. Technical Architecture

### 4.1 Service Layer Structure

```typescript
// src/lib/services/goat/
├── client.ts          // Base API client with auth
├── products.ts        // Product search, details, variants
├── listings.ts        // Create, update, delete listings
├── orders.ts          // Sold orders, confirmations
├── pricing.ts         // Market data, buy bar, sales history
├── seller.ts          // Seller profile, analytics
├── webhooks.ts        // GOAT webhook handlers (if available)
└── types.ts           // TypeScript interfaces
```

### 4.2 API Client Base (`client.ts`)

```typescript
import { createClient as createSupabaseClient } from '@/lib/supabase/server';

interface GoatConfig {
  apiKey: string;
  apiUrl: string;
  timeout: number;
  retries: number;
}

export class GoatClient {
  private config: GoatConfig;
  private accessToken: string | null = null;

  constructor(config: GoatConfig) {
    this.config = config;
  }

  async authenticate(email: string, password: string): Promise<string> {
    // POST /auth/login → get access token
    // Store in user's profile or encrypted env var
  }

  async request<T>(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<T> {
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'ArchVD/1.0',
    };

    const response = await fetch(`${this.config.apiUrl}${endpoint}`, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new GoatApiError(response.status, await response.text());
    }

    return response.json();
  }

  // Exponential backoff wrapper
  async requestWithRetry<T>(
    method: string,
    endpoint: string,
    data?: any,
    retries = this.config.retries
  ): Promise<T> {
    try {
      return await this.request<T>(method, endpoint, data);
    } catch (error) {
      if (retries > 0 && this.isRetryable(error)) {
        await this.sleep(2 ** (this.config.retries - retries) * 1000);
        return this.requestWithRetry<T>(method, endpoint, data, retries - 1);
      }
      throw error;
    }
  }

  private isRetryable(error: any): boolean {
    return error.status >= 500 || error.status === 429;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class GoatApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`GOAT API Error ${status}: ${body}`);
  }
}
```

### 4.3 Products Service (`products.ts`)

```typescript
import { GoatClient } from './client';

export interface GoatProduct {
  slug: string;
  sku: string;
  name: string;
  brand: string;
  colorway: string;
  retailPrice: number;
  releaseDate: string;
  mainPictureUrl: string;
  category: string;
}

export interface GoatSearchResult {
  results: GoatProduct[];
  total: number;
  page: number;
}

export class GoatProductsService {
  constructor(private client: GoatClient) {}

  async search(query: string, options?: {
    page?: number;
    limit?: number;
    brand?: string;
    priceMin?: number;
    priceMax?: number;
  }): Promise<GoatSearchResult> {
    const params = new URLSearchParams({
      q: query,
      page: (options?.page || 1).toString(),
      limit: (options?.limit || 20).toString(),
      ...(options?.brand && { brand: options.brand }),
      ...(options?.priceMin && { price_min: options.priceMin.toString() }),
      ...(options?.priceMax && { price_max: options.priceMax.toString() }),
    });

    return this.client.requestWithRetry<GoatSearchResult>(
      'GET',
      `/search?${params}`
    );
  }

  async getDetails(slug: string): Promise<GoatProduct> {
    return this.client.requestWithRetry<GoatProduct>(
      'GET',
      `/product_templates/${slug}/show_v2`
    );
  }

  async getVariants(productTemplateId: string, countryCode = 'GB'): Promise<any> {
    const params = new URLSearchParams({
      productTemplateId,
      countryCode,
    });

    return this.client.requestWithRetry(
      'GET',
      `/product_variants/buy_bar_data?${params}`
    );
  }
}
```

### 4.4 Listings Service (`listings.ts`)

```typescript
export interface GoatListing {
  id: string;
  sku: string;
  size: string;
  price: number;
  condition: 'new' | 'used';
  status: 'active' | 'sold' | 'cancelled';
  listedAt: string;
}

export class GoatListingsService {
  constructor(private client: GoatClient) {}

  async getAll(): Promise<GoatListing[]> {
    return this.client.requestWithRetry<GoatListing[]>('GET', '/listings');
  }

  async create(data: {
    sku: string;
    size: string;
    price: number;
    condition?: 'new' | 'used';
  }): Promise<GoatListing> {
    return this.client.requestWithRetry<GoatListing>('POST', '/listings', data);
  }

  async updatePrice(listingId: string, newPrice: number): Promise<GoatListing> {
    return this.client.requestWithRetry<GoatListing>(
      'PATCH',
      `/listings/${listingId}`,
      { price: newPrice }
    );
  }

  async bulkUpdatePrices(updates: Array<{ listingId: string; price: number }>): Promise<void> {
    return this.client.requestWithRetry('PATCH', '/listings/bulk', { updates });
  }

  async cancel(listingId: string): Promise<void> {
    return this.client.requestWithRetry('DELETE', `/listings/${listingId}`);
  }

  async setVacationMode(enabled: boolean): Promise<void> {
    return this.client.requestWithRetry('POST', '/seller/vacation_mode', { enabled });
  }
}
```

### 4.5 Worker/Cron Jobs

```typescript
// src/app/api/workers/goat-sync/route.ts

import { GoatClient } from '@/lib/services/goat/client';
import { GoatListingsService } from '@/lib/services/goat/listings';
import { GoatOrdersService } from '@/lib/services/goat/orders';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();

  // 1. Sync sold orders → sales table
  const ordersService = new GoatOrdersService(goatClient);
  const soldOrders = await ordersService.getSold({ since: '24h' });

  for (const order of soldOrders) {
    // Find matching inventory item by goat_listing_id
    const { data: inventoryItem } = await supabase
      .from('Inventory')
      .select('*')
      .eq('goat_listing_id', order.listingId)
      .single();

    if (!inventoryItem) continue;

    // Create sale record (trigger will handle rest)
    await supabase.from('Inventory').update({
      status: 'sold',
      sold_price: order.salePrice,
      sales_fee: order.commission,
      platform: 'goat',
      sold_date: order.soldAt,
    }).eq('id', inventoryItem.id);
  }

  // 2. Sync listings status changes
  const listingsService = new GoatListingsService(goatClient);
  const goatListings = await listingsService.getAll();

  for (const listing of goatListings) {
    await supabase
      .from('Inventory')
      .update({
        goat_status: listing.status,
        goat_last_sync: new Date().toISOString(),
      })
      .eq('goat_listing_id', listing.id);
  }

  return Response.json({ success: true, synced: soldOrders.length });
}
```

---

## 5. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Set up GOAT API client base class
- [ ] Implement authentication flow
- [ ] Add `goat_*` columns to `Inventory` table
- [ ] Create products/listings services
- [ ] Build product search UI component

### Phase 2: Core Features (Week 3-5)
- [ ] Inventory→GOAT listing sync (one-way)
- [ ] Live market pricing integration
- [ ] Auto-import sold orders
- [ ] Update watchlist alerts with GOAT data
- [ ] Build repricing rules engine

### Phase 3: Analytics & Automation (Week 6-8)
- [ ] GOAT performance dashboard
- [ ] Auto-repricing workers
- [ ] Sales velocity analysis
- [ ] Profit forecasting

### Phase 4: Premium Features (Week 9-12)
- [ ] Multi-marketplace comparison
- [ ] Demand forecasting ML model
- [ ] Competitor intelligence
- [ ] Consignment tracking

### Phase 5: Polish & Scale (Week 13+)
- [ ] Mobile app (React Native + Expo)
- [ ] Team collaboration features
- [ ] Advanced tax reporting
- [ ] White-label reseller tools

---

## 6. Competitive Advantages

By integrating Alias/GOAT API, ArchVD will offer:

1. **Unified Dashboard**: Manage GOAT + other platforms in one place
2. **Automation**: Auto-list, auto-price, auto-sync sales
3. **Intelligence**: AI-powered pricing, forecasting, and recommendations
4. **Speed**: Real-time market data vs manual entry
5. **Scalability**: Bulk operations for high-volume sellers
6. **Trust**: Accurate P&L with true GOAT fees
7. **Insights**: Advanced analytics not available on GOAT alone

---

## 7. Pricing Model Suggestions

**Free Tier:**
- Manual GOAT listing (no auto-sync)
- Up to 10 items
- Basic market data (daily refresh)

**Pro Tier ($29/mo):**
- Auto-sync up to 100 items
- Real-time pricing
- Auto-repricing (basic rules)
- Sales alerts
- Analytics dashboard

**Business Tier ($99/mo):**
- Unlimited items
- Advanced repricing (velocity mode, A/B testing)
- Multi-marketplace support
- Demand forecasting
- Team collaboration (3 users)

**Enterprise Tier ($299+/mo):**
- White-label
- Custom integrations
- Dedicated support
- Advanced ML models
- API access

---

## 8. Risk Mitigation

### API Dependency
- **Risk**: GOAT changes API, rate limits, or pricing
- **Mitigation**: Maintain mock data fallback, build caching layer, negotiate enterprise API agreement

### Data Sync Issues
- **Risk**: Out-of-sync inventory between ArchVD and GOAT
- **Mitigation**: Webhook listeners (if available), frequent polling (every 5 min), conflict resolution UI

### Authentication
- **Risk**: Storing user GOAT credentials securely
- **Mitigation**: Use OAuth if available, encrypt tokens with user's master password, vault storage

### Rate Limits
- **Risk**: Hitting API limits with many users
- **Mitigation**: Request queue with backoff, tiered plans with usage limits, enterprise partnership

---

## 9. Success Metrics

**Technical KPIs:**
- API uptime: >99.5%
- Sync latency: <60s for sales, <5min for listings
- Error rate: <0.1%

**Business KPIs:**
- User adoption: 50% of users connect GOAT in first week
- Auto-listing rate: 30% of inventory auto-listed
- Repricing engagement: 40% enable auto-repricing
- Revenue lift: 20% increase from Pro/Business upgrades

**User Experience:**
- Time to list: <30s (vs 5min manual)
- Pricing accuracy: ±2% of market optimal
- Sale notification delay: <1min

---

## 10. Next Steps

1. **Secure API Access**: Contact Alias/GOAT for partnership or API key
2. **Technical Spike**: Build proof-of-concept with 1-2 endpoints
3. **User Research**: Survey existing users on desired GOAT features
4. **Design Mockups**: UI for GOAT sync settings, listing manager
5. **Database Migration**: Add `goat_*` columns to Inventory
6. **Build API Client**: Implement base client + products service
7. **Alpha Test**: Internal testing with 5-10 items
8. **Beta Launch**: Invite 20 users to test GOAT integration
9. **Full Rollout**: GA with marketing push

---

**Document Owner:** Claude Code
**Last Updated:** 2025-11-13
**Version:** 1.0
**Status:** Pending stakeholder review
