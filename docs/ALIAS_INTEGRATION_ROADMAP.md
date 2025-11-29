# Alias Integration Roadmap

**Personal Access Token:** `goatapi_1GFjmPCsaibJixPGmp2IfAcmVhRSdKfie0XsriE`
**Base URL:** `https://api.alias.org/api/v1/`
**Support:** open-api-support@alias.org

---

## 🎯 All Features Buildable with Alias APIs

### 1. Catalog & Product Discovery
- **Global Product Search** - Search across 500M+ items by SKU, name, brand
- **Product Details** - Get comprehensive product info including images, descriptions, retail prices
- **Size Availability Check** - View all available sizes for any product
- **Brand/Category Filtering** - Browse by brand, category, gender, color
- **Product Metadata** - Access condition types, packaging requirements, defect types

### 2. Market Intelligence & Pricing
- **Real-time Pricing** - Get current lowest ask, highest bid for any size
- **Multi-Size Pricing** - Fetch pricing for multiple sizes in one API call (unique to Alias)
- **Offer Histogram** - View market depth with price distribution at each level (unique to Alias)
- **Sales History** - View recent sales with dates and prices
- **Price Trends** - Track pricing changes over time
- **Competitive Analysis** - Compare pricing across multiple sizes/products

### 3. Listing Management (Individual)
- **Create Listings** - List items with full control over price, size, condition
- **Update Listings** - Modify price, size, condition, defects
- **Activate/Deactivate** - Control listing visibility
- **Delete Listings** - Remove listings from marketplace
- **Search My Listings** - Filter by status, product, date
- **Listing Metadata** - Add custom key-value pairs for cross-platform tracking (unique to Alias)

### 4. Batch Listing Operations
- **Batch Create** - Create up to 1,000 listings in one call
- **Batch Update** - Update up to 1,000 listings with conditional logic (unique to Alias)
- **Batch Activate/Deactivate** - Bulk visibility control
- **Batch Delete** - Remove multiple listings at once
- **Operation Tracking** - Monitor async batch jobs with status updates
- **Quota Management** - Check concurrent operation limits (unique to Alias)
- **Detailed Results** - Get per-item success/failure details with retry capability

### 5. Order Fulfillment
- **Order Sync** - Pull all orders with filtering by status, date
- **Order Details** - Get full order info including buyer details, shipping address
- **Confirm Orders** - Accept orders within required timeframe
- **Generate Shipping Labels** - Create labels for confirmed orders (SHIPPING or DROPOFF types)
- **Regenerate Labels** - Reprint labels if needed
- **Mark Shipped** - Update order status with tracking info
- **Cancel Orders** - Cancel orders with reason codes
- **Order Timeline Tracking** - Monitor order lifecycle events

### 6. Inventory Management
- **Unified Inventory View** - Combine StockX + Alias listings in one interface
- **Cross-Platform Sync** - Keep listings synchronized across platforms using metadata
- **Inventory Valuation** - Calculate total portfolio value using market prices
- **Stock Monitoring** - Track what's listed vs available to list
- **Performance Metrics** - View sell-through rates, average days to sale

### 7. Analytics & Reporting
- **Sales Analytics** - Track revenue, order volume, average sale price
- **Listing Performance** - Monitor views, favorites, conversion rates
- **Pricing Optimization** - Identify repricing opportunities using histogram data
- **Market Trends** - Analyze seasonal patterns, hot products
- **Arbitrage Detection** - Find price differences between StockX and Alias

---

## 🔄 StockX Feature Parity for Alias

### 1. **View StockX Listings → View Alias Listings**
- **Alias API:** `GET /api/v1/listings` with pagination
- **Implementation:** Separate tab/section for Alias listings
- **Display:** Product name, size, price, status (active/inactive), days listed
- **Filters:** Status, product, date range

### 2. **Create StockX Listing → Create Alias Listing**
- **Alias API:** `POST /api/v1/listings`
- **Implementation:** Separate "List on Alias" modal/flow
- **Fields:** Catalog ID (from search), size, price_cents, condition, packaging_condition, defects
- **Validation:** Check pricing insights before listing

### 3. **Update StockX Listing Price → Update Alias Listing**
- **Alias API:** `POST /api/v1/listings/{id}` (update)
- **Implementation:** Inline editing or repricing modal
- **Features:** Price adjustment with market data reference
- **Validation:** Show current lowest ask when repricing

### 4. **Delete StockX Listing → Delete Alias Listing**
- **Alias API:** `DELETE /api/v1/listings/{id}`
- **Implementation:** Delete button with confirmation
- **Safety:** Confirm deletion, prevent if order pending

### 5. **Sync StockX Listings → Sync Alias Listings**
- **Alias API:** `GET /api/v1/listings` (fetch all)
- **Implementation:** Background job to sync listing status
- **Features:** Detect sold items, update status, pull new orders

### 6. **View StockX Orders → View Alias Orders**
- **Alias API:** `GET /api/v1/orders` with filters
- **Implementation:** Separate Alias orders section
- **Display:** Order ID, product, buyer, status, ship-by date
- **Filters:** Status, date range, fulfillment status

### 7. **Confirm StockX Order → Confirm Alias Order**
- **Alias API:** `POST /api/v1/orders/{id}/confirm`
- **Implementation:** Confirm button on order detail page
- **Workflow:** Confirm → Generate label → Ship
- **Deadline:** Track confirmation window

### 8. **Generate Shipping Label → Generate Alias Label**
- **Alias API:** `POST /api/v1/orders/{id}/generate_label`
- **Implementation:** Generate label button after confirmation
- **Features:** Choose label type (SHIPPING vs DROPOFF), download PDF
- **Regenerate:** Support label regeneration if needed

### 9. **Mark Order Shipped → Mark Alias Order Shipped**
- **Alias API:** `POST /api/v1/orders/{id}/ship`
- **Implementation:** Ship button with carrier/tracking input
- **Validation:** Ensure label generated before shipping
- **Notification:** Update user on shipping deadline

### 10. **View Market Data (StockX) → View Alias Market Data**
- **Alias API:** `GET /api/v1/pricing_insights/availability`
- **Implementation:** Display lowest ask, highest bid for each size
- **Enhanced:** Show offer histogram for market depth
- **Use Case:** Pricing decisions, market analysis

---

## 🚀 Alias-Specific Features (Beyond StockX)

### 1. **Offer Histogram (Market Depth Analysis)**
- **API:** `GET /api/v1/pricing_insights/offer_histogram`
- **Capability:** See how many offers exist at each price point
- **Use Case:**
  - Price competitively by seeing where offers cluster
  - Identify gaps in market where you can list strategically
  - Understand true market depth beyond just "lowest ask"
- **UI:** Bar chart showing price levels and quantity of offers

### 2. **Multi-Size Pricing in One Call**
- **API:** `GET /api/v1/pricing_insights/availabilities/{catalog_id}`
- **Capability:** Get pricing for ALL sizes of a product in single request
- **Use Case:**
  - Fast pricing lookup when listing multiple sizes
  - Size comparison view for buyers
  - Efficient batch pricing analysis
- **Performance:** 10x faster than individual size calls

### 3. **Conditional Batch Updates**
- **API:** `POST /api/v1/listings/batch_update` with condition operators
- **Capability:** Update listings ONLY if current values match conditions
- **Use Case:**
  - "Drop price by $5 but only if current price > $100"
  - "Update size but only if current size = 10.5"
  - Prevent overwriting recent manual changes
- **Operators:** EQ, GT, LT, GTE, LTE

### 4. **Listing Metadata (Cross-Platform Linking)**
- **API:** `POST /api/v1/listings/{listing_id}/metadata`
- **Capability:** Attach custom key-value pairs to listings
- **Use Case:**
  - Store StockX listing ID on Alias listing
  - Track which inventory item this listing represents
  - Link to internal SKU/warehouse location
  - Store acquisition cost for profit tracking
- **Implementation:** `{ "stockx_listing_id": "...", "inventory_item_id": "...", "cost_cents": 15000 }`

### 5. **Batch Operation Quota Monitoring**
- **API:** `GET /api/v1/listings/batch_operation/quota`
- **Capability:** Check how many concurrent batch operations allowed
- **Use Case:**
  - Prevent API errors from exceeding limits
  - Queue batch jobs intelligently
  - Show user capacity status
- **UI:** "2 of 5 batch operations in progress"

### 6. **Detailed Batch Results**
- **API:** `GET /api/v1/listings/batch_operations/{id}`
- **Capability:** Per-item success/failure details with error messages
- **Use Case:**
  - Retry only failed items
  - Debug why specific listings failed
  - Show detailed progress to user
- **Response:** Array of results with status, IDs, error messages

### 7. **Recent Sales History**
- **API:** `GET /api/v1/pricing_insights/recent_sales`
- **Capability:** View actual sale dates and prices
- **Use Case:**
  - Validate pricing trends
  - See if item is hot or slow-moving
  - Calculate average sale price over time
- **Display:** Timeline of sales with dates and prices

### 8. **Advanced Condition & Defect Options**
- **API:** Rich condition types in listing creation
- **Capability:** More granular than StockX
  - Product condition: NEW, USED, NEW_WITH_DEFECTS
  - Packaging condition: GOOD_CONDITION, MISSING_LID, BADLY_DAMAGED, NO_ORIGINAL_BOX
  - Specific defects: HAS_ODOR, HAS_DISCOLORATION, HAS_SCUFFS, etc.
- **Use Case:** More accurate condition representation, better buyer expectations

---

## 📋 Full Alias Integration Roadmap

### **Phase 1: Foundation (Week 1-2)**

#### Week 1: Database Schema & Infrastructure
1. **Create Alias-specific tables:**
   ```sql
   CREATE TABLE alias_listings (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID REFERENCES auth.users NOT NULL,
     alias_listing_id TEXT UNIQUE NOT NULL,
     catalog_id TEXT NOT NULL,
     product_name TEXT NOT NULL,
     sku TEXT,
     size NUMERIC,
     size_unit TEXT,
     price_cents INTEGER NOT NULL,
     condition TEXT NOT NULL,
     packaging_condition TEXT,
     defects TEXT[],
     status TEXT NOT NULL, -- active, inactive, sold
     metadata JSONB, -- for cross-platform linking
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE TABLE alias_orders (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID REFERENCES auth.users NOT NULL,
     alias_order_id TEXT UNIQUE NOT NULL,
     alias_listing_id TEXT REFERENCES alias_listings(alias_listing_id),
     order_status TEXT NOT NULL,
     fulfillment_status TEXT,
     buyer_name TEXT,
     shipping_address JSONB,
     total_cents INTEGER NOT NULL,
     payout_cents INTEGER,
     ship_by_date TIMESTAMPTZ,
     tracking_number TEXT,
     carrier TEXT,
     label_url TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE TABLE alias_batch_operations (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID REFERENCES auth.users NOT NULL,
     alias_batch_id TEXT UNIQUE NOT NULL,
     operation_type TEXT NOT NULL, -- create, update, delete, activate, deactivate
     status TEXT NOT NULL, -- pending, in_progress, completed, failed
     total_items INTEGER NOT NULL,
     succeeded_items INTEGER DEFAULT 0,
     failed_items INTEGER DEFAULT 0,
     results JSONB,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     completed_at TIMESTAMPTZ
   );
   ```

2. **Authentication & Token Management:**
   - Store Alias PAT securely: `goatapi_1GFjmPCsaibJixPGmp2IfAcmVhRSdKfie0XsriE`
   - Create `alias_credentials` table similar to StockX
   - Build token encryption/decryption utilities
   - Add Alias connection status to user settings

#### Week 2: Core Service Layer
3. **Create Alias API client:**
   - Base client with authentication: `src/lib/services/alias/client.ts`
   - Request/response types: `src/lib/services/alias/types.ts`
   - Error handling with Alias-specific error codes
   - Rate limiting & retry logic (sequential pagination)

4. **Core service modules:**
   - `src/lib/services/alias/catalog.ts` - Product search & details
   - `src/lib/services/alias/listings.ts` - Individual listing CRUD
   - `src/lib/services/alias/orders.ts` - Order management
   - `src/lib/services/alias/batch.ts` - Batch operations
   - `src/lib/services/alias/pricing.ts` - Market data & insights

---

### **Phase 2: Listing Management (Week 3-4)**

#### Week 3: Individual Listing CRUD
5. **Create Listing Flow:**
   - Add "List on Alias" button in inventory
   - Build `<ListOnAliasModal>` component
   - Catalog search integration
   - Size/condition/price selection
   - API endpoint: `POST /api/items/list-on-alias`
   - Backend: Call Alias `POST /api/v1/listings`
   - Store metadata linking Alias listing to inventory item

6. **View Alias Listings:**
   - New route: `/portfolio/alias-listings`
   - Table component: `<AliasListingsTable>`
   - Display: Product, size, price, status, days listed
   - Filters: Status (active/inactive/sold), date range
   - Hook: `useAliasListings()` with pagination

7. **Update/Reprice Listings:**
   - Inline price editing in listings table
   - `<RepriceAliasListingModal>` component
   - Show current market data (lowest ask) when repricing
   - API endpoint: `POST /api/alias/listings/[id]/update`
   - Backend: Call Alias `POST /api/v1/listings/{id}`

#### Week 4: Listing Actions & Sync
8. **Activate/Deactivate/Delete:**
   - Action buttons in listings table
   - Confirmation modals for destructive actions
   - API endpoints:
     - `POST /api/alias/listings/[id]/activate`
     - `POST /api/alias/listings/[id]/deactivate`
     - `DELETE /api/alias/listings/[id]`
   - Update local DB on success

9. **Listing Sync:**
   - Background job: Sync Alias listings every 15 minutes
   - API endpoint: `POST /api/alias/listings/sync`
   - Fetch all listings from Alias
   - Update local DB with status changes
   - Detect sold items → create orders
   - Show sync status in UI

---

### **Phase 3: Market Data Integration (Week 5)**

10. **Pricing Intelligence:**
    - `<AliasPricingInsights>` component
    - Show lowest ask, highest bid for selected size
    - Multi-size pricing table (all sizes at once)
    - Recent sales history timeline
    - API endpoint: `GET /api/alias/pricing/insights`
    - Use when: Creating listing, repricing, market research

11. **Offer Histogram Visualization:**
    - `<AliasOfferHistogram>` chart component
    - Bar chart showing price levels and offer quantities
    - Identify pricing sweet spots
    - API endpoint: `GET /api/alias/pricing/histogram`
    - Show in product detail modal

12. **Market Comparison:**
    - Side-by-side StockX vs Alias pricing
    - `<PlatformPriceComparison>` component
    - Highlight arbitrage opportunities
    - Suggest optimal listing platform

---

### **Phase 4: Order Fulfillment (Week 6)**

13. **View Alias Orders:**
    - New route: `/portfolio/alias-orders`
    - Table component: `<AliasOrdersTable>`
    - Display: Order ID, product, buyer, status, ship-by date
    - Filters: Status, fulfillment status, date range
    - Hook: `useAliasOrders()` with pagination

14. **Order Workflow:**
    - Order detail page: `/portfolio/alias-orders/[id]`
    - Action buttons: Confirm → Generate Label → Mark Shipped
    - `<ConfirmAliasOrderModal>` - Confirm within deadline
    - `<GenerateAliasLabelModal>` - Choose label type (SHIPPING/DROPOFF)
    - `<MarkAliasShippedModal>` - Enter tracking info
    - API endpoints:
      - `POST /api/alias/orders/[id]/confirm`
      - `POST /api/alias/orders/[id]/generate-label`
      - `POST /api/alias/orders/[id]/ship`

15. **Order Sync & Notifications:**
    - Background job: Sync orders every 10 minutes
    - Detect new orders → notify user
    - Track ship-by deadlines → send reminders
    - Update order status automatically

---

### **Phase 5: Advanced Batch Operations (Week 7-8)**

#### Week 7: Batch Infrastructure
16. **Batch Operation UI:**
    - New route: `/portfolio/alias-listings/batch`
    - `<AliasBatchDashboard>` component
    - View all batch operations with status
    - Show quota usage: "2 of 5 operations in progress"
    - Hook: `useAliasBatchOperations()` for tracking

17. **Batch Create/Update:**
    - `<BatchListOnAliasModal>` - Upload CSV or select items
    - Support up to 1,000 items per batch
    - CSV template with required fields
    - Progress tracking with polling
    - API endpoint: `POST /api/alias/listings/batch-create`
    - Backend: Call Alias `POST /api/v1/listings/batch_create`

#### Week 8: Advanced Batch Features
18. **Conditional Batch Updates:**
    - `<BatchRepriceModal>` with conditions
    - UI for condition builder:
      - "Drop price by $5 IF current price > $100"
      - "Update size IF current size = 10.5"
    - Operator selection: EQ, GT, LT, GTE, LTE
    - API endpoint: `POST /api/alias/listings/batch-update`
    - Use Alias conditional update operators

19. **Batch Results & Retry:**
    - `<BatchOperationResults>` component
    - Per-item success/failure display
    - Download results as CSV
    - "Retry Failed" button for partial failures
    - Show detailed error messages per item

20. **Smart Batch Manager:**
    - Queue batch operations when quota full
    - Auto-retry failed operations
    - Optimize batch sizes for performance
    - Show estimated completion time

---

### **Phase 6: Multi-Platform Intelligence (Week 9-10)**

#### Week 9: Unified Views
21. **Combined Inventory Dashboard:**
    - Unified view of StockX + Alias listings
    - `<UnifiedInventoryTable>` component
    - Platform badges (StockX/Alias)
    - Filter by platform, status, product
    - Compare same item across platforms

22. **Cross-Platform Sync:**
    - Use Alias listing metadata to store StockX listing ID
    - Use StockX webhook metadata to store Alias listing ID
    - Detect when same item listed on both platforms
    - Auto-update prices across platforms (optional)
    - API endpoint: `POST /api/listings/cross-platform-sync`

#### Week 10: Analytics & Intelligence
23. **Arbitrage Detection:**
    - Scan for price differences between platforms
    - Alert when StockX price > Alias price + fees
    - Suggest buying on Alias, selling on StockX
    - `<ArbitrageOpportunities>` component
    - API endpoint: `GET /api/analytics/arbitrage`

24. **Platform Performance Comparison:**
    - Compare sell-through rates: StockX vs Alias
    - Average days to sale per platform
    - Fee comparison per transaction
    - Recommend optimal platform per product
    - `<PlatformPerformance>` dashboard

25. **Unified Order Management:**
    - Combined order view across platforms
    - `<UnifiedOrdersTable>` component
    - Single workflow for all orders
    - Bulk label generation across platforms

---

### **Phase 7: Alias-Specific Advanced Features (Week 11-12)**

#### Week 11: Intelligent Pricing
26. **Histogram-Based Price Optimizer:**
    - Analyze offer histogram to find optimal price
    - Identify gaps in market where you can win
    - Suggest repricing based on offer density
    - `<AliasSmartPricer>` component
    - Algorithm: Find lowest price with least competition
    - API endpoint: `GET /api/alias/pricing/optimize`

27. **Market Depth Dashboard:**
    - Visualize market depth for tracked products
    - Track how offer distribution changes over time
    - Alert when market becomes saturated/thin
    - `<MarketDepthTracker>` component
    - Use for strategic listing timing

#### Week 12: Automation & Polish
28. **Auto-Pricing Rules:**
    - Set rules: "Always price $5 below lowest ask"
    - Use histogram data for smarter rules
    - "Price at X% of median offer"
    - Background job to auto-reprice
    - `<AliasPricingRules>` settings page

29. **Bulk Condition Updates:**
    - Batch update conditions/defects
    - Support advanced Alias condition options
    - Update packaging condition separately
    - API endpoint: `POST /api/alias/listings/batch-update-conditions`

30. **Mobile App Polish:**
    - Responsive Alias listing views
    - Quick-add to Alias from mobile
    - Push notifications for Alias orders
    - Mobile-optimized batch operations

---

## 🎯 Implementation Priority Matrix

### **Must Have (MVP - Weeks 1-6)**
✅ Required for basic Alias integration

1. Database schema & auth (Phase 1)
2. Individual listing CRUD (Phase 2)
3. View/manage Alias listings (Phase 2)
4. Listing sync (Phase 2)
5. View Alias orders (Phase 4)
6. Order workflow (confirm/ship) (Phase 4)
7. Basic market data (pricing insights) (Phase 3)
8. Catalog search (Phase 2)

### **Should Have (V1 - Weeks 7-10)**
🎯 Important for power users

9. Batch create/update operations (Phase 5)
10. Batch operation tracking (Phase 5)
11. Offer histogram visualization (Phase 3)
12. Market comparison (StockX vs Alias) (Phase 3)
13. Unified inventory view (Phase 6)
14. Cross-platform sync (Phase 6)
15. Order sync & notifications (Phase 4)

### **Nice to Have (V2 - Weeks 11-12)**
💡 Advanced optimizations

16. Conditional batch updates (Phase 5)
17. Batch quota monitoring (Phase 5)
18. Arbitrage detection (Phase 6)
19. Histogram-based price optimizer (Phase 7)
20. Auto-pricing rules (Phase 7)
21. Market depth tracking (Phase 7)
22. Platform performance analytics (Phase 6)

---

## 📊 Key Differences: StockX vs Alias

| Feature | StockX | Alias | Winner |
|---------|--------|-------|--------|
| **Batch Size** | 100 items | 1,000 items | ✅ Alias (10x) |
| **Conditional Updates** | ❌ Not supported | ✅ 5 operators (EQ, GT, LT, GTE, LTE) | ✅ Alias |
| **Market Depth** | Lowest ask only | ✅ Full offer histogram | ✅ Alias |
| **Multi-Size Pricing** | Individual calls | ✅ Single call for all sizes | ✅ Alias |
| **Listing Metadata** | Webhook metadata | ✅ Custom key-value pairs | ✅ Alias |
| **Batch Quota Visibility** | ❌ No API | ✅ Dedicated endpoint | ✅ Alias |
| **Batch Results Detail** | Basic status | ✅ Per-item errors | ✅ Alias |
| **Order Confirmation** | Automatic | ✅ Manual (more control) | Tie |
| **Shipping Labels** | Integrated | ✅ Integrated + Dropoff option | ✅ Alias |
| **Condition Granularity** | Basic | ✅ Advanced (packaging, defects) | ✅ Alias |

**Summary:** Alias provides superior batch operations, market intelligence, and flexibility. StockX has stronger brand recognition and higher liquidity.

---

## 🚀 Getting Started

### Immediate Next Steps:
1. **Phase 1, Week 1:** Set up database schema for Alias tables
2. **Phase 1, Week 1:** Create Alias API client with authentication
3. **Phase 1, Week 2:** Build core service layer for catalog, listings, orders
4. **Phase 2, Week 3:** Implement "List on Alias" flow with catalog search

### Key Implementation Notes:
- Use the metadata feature to link Alias listings to inventory items
- Store `stockx_listing_id` in Alias metadata for cross-platform tracking
- Implement sequential pagination (no concurrent requests to Alias API)
- Monitor batch quotas before submitting large operations
- Use histogram data for intelligent pricing recommendations

### Testing Strategy:
- Test with small batches (<10 items) first
- Validate catalog search returns correct products
- Test full order workflow: confirm → label → ship
- Verify pricing insights match Alias dashboard
- Test conditional updates with various operators

---

**Next Action:** Begin Phase 1, Week 1 - Database Schema & Infrastructure
