# Phase 1, Week 2: Product Search & Catalog Mapping

**Goal:** Enable searching Alias catalog, automatic SKU matching, and market data synchronization

**Prerequisites:** ✅ Week 1 Complete (Database tables, API client, authentication)

---

## 📋 Week 2 Tasks

### Task 1: Catalog Search API Route

**Create:** `src/app/api/alias/search/route.ts`

**Functionality:**
- Search Alias catalog by query (SKU, name, brand)
- Support pagination
- Return formatted catalog items
- Handle errors gracefully

**Request:**
```typescript
GET /api/alias/search?query=Air+Jordan+5+Grape&limit=10
```

**Response:**
```typescript
{
  success: true,
  items: AliasCatalogItem[],
  hasMore: boolean,
  nextToken?: string
}
```

---

### Task 2: Get Catalog Item API Route

**Create:** `src/app/api/alias/catalog/[id]/route.ts`

**Functionality:**
- Fetch single catalog item by ID
- Return full product details
- Handle 404 errors

**Request:**
```typescript
GET /api/alias/catalog/air-jordan-5-retro-grape-2025-hq7978-100
```

**Response:**
```typescript
{
  success: true,
  item: AliasCatalogItem
}
```

---

### Task 3: Pricing Insights API Route

**Create:** `src/app/api/alias/pricing/[catalogId]/route.ts`

**Functionality:**
- Fetch pricing for all sizes/variations
- Return lowest ask, highest bid, last sold
- Cache results in `alias_market_snapshots`

**Request:**
```typescript
GET /api/alias/pricing/air-jordan-5-retro-grape-2025-hq7978-100
```

**Response:**
```typescript
{
  success: true,
  variants: AliasPricingVariant[]
}
```

---

### Task 4: Automatic SKU Matching Service

**Create:** `src/lib/services/alias/matching.ts`

**Features:**
- Match inventory SKU to Alias catalog
- Confidence scoring algorithm
- Handle variations (spacing, dashes, etc.)
- Fallback to fuzzy search

**Algorithm:**
```typescript
1. Exact match on SKU → confidence: 1.0
2. Normalized match (remove spaces/dashes) → confidence: 0.95
3. Search by SKU, pick best result → confidence: 0.85
4. Search by product name → confidence: 0.70
5. Manual mapping required → confidence: 0.0
```

**Function Signature:**
```typescript
async function matchInventoryToAliasCatalog(
  inventoryItem: InventoryItem
): Promise<{
  catalogId: string | null;
  confidence: number;
  catalogItem?: AliasCatalogItem;
}>
```

---

### Task 5: Market Data Sync Service

**Create:** `src/lib/services/alias/sync.ts`

**Features:**
- Fetch pricing insights for catalog item
- Store snapshots in `alias_market_snapshots`
- Update inventory links with latest data
- Batch processing for multiple items

**Functions:**
```typescript
// Sync single item
async function syncAliasMarketData(catalogId: string, size: number): Promise<void>

// Sync all mapped inventory items
async function syncAllAliasMarketData(): Promise<{ synced: number; errors: number }>

// Sync specific inventory item
async function syncInventoryAliasData(inventoryId: string): Promise<void>
```

**Database Updates:**
```sql
-- Insert/update market snapshot
INSERT INTO alias_market_snapshots (
  catalog_id, size, currency,
  lowest_ask_cents, highest_bid_cents,
  last_sold_price_cents, global_indicator_price_cents,
  snapshot_at
) VALUES (...)
ON CONFLICT (catalog_id, size, currency, snapshot_at)
DO UPDATE SET ...;

-- Update inventory link sync status
UPDATE inventory_alias_links
SET last_sync_success_at = NOW(),
    last_sync_error = NULL
WHERE inventory_id = ?;
```

---

### Task 6: Bulk Mapping API Route (Optional)

**Create:** `src/app/api/alias/map-inventory/route.ts`

**Functionality:**
- Accept inventory ID
- Attempt automatic SKU matching
- Fetch and store market data
- Create `inventory_alias_links` entry

**Request:**
```typescript
POST /api/alias/map-inventory
{
  inventoryId: "uuid",
  catalogId?: "optional-manual-override"
}
```

**Response:**
```typescript
{
  success: true,
  mapping: {
    inventoryId: string,
    catalogId: string,
    confidence: number,
    marketData: AliasPricingVariant[]
  }
}
```

---

## 🎯 Deliverables

By end of Week 2:

1. ✅ **API Routes**
   - `/api/alias/search` - Catalog search
   - `/api/alias/catalog/[id]` - Get catalog item
   - `/api/alias/pricing/[catalogId]` - Pricing insights
   - `/api/alias/map-inventory` - Map inventory to catalog

2. ✅ **Services**
   - `matching.ts` - SKU matching algorithm
   - `sync.ts` - Market data synchronization

3. ✅ **Testing**
   - All API routes tested
   - SKU matching validated
   - Market data sync verified

---

## 🚀 Implementation Order

**Day 1-2: API Routes**
1. Create search route
2. Create catalog item route
3. Create pricing route
4. Test all routes

**Day 3-4: Matching & Sync**
1. Build SKU matching algorithm
2. Implement market data sync
3. Create bulk mapping route

**Day 5: Testing & Refinement**
1. Integration testing
2. Error handling
3. Documentation

---

## 📊 Testing Strategy

### Unit Tests
- SKU matching algorithm accuracy
- Confidence scoring logic
- Data transformation functions

### Integration Tests
- API routes with real Alias API
- Database inserts/updates
- Error handling scenarios

### Manual Testing
```bash
# Test catalog search
curl http://localhost:3000/api/alias/search?query=Air+Jordan

# Test get catalog item
curl http://localhost:3000/api/alias/catalog/air-jordan-5-retro-grape-2025-hq7978-100

# Test pricing
curl http://localhost:3000/api/alias/pricing/air-jordan-5-retro-grape-2025-hq7978-100

# Test mapping
curl -X POST http://localhost:3000/api/alias/map-inventory \
  -H "Content-Type: application/json" \
  -d '{"inventoryId": "uuid-here"}'
```

---

## 🔗 Dependencies

- ✅ Alias API client (Week 1)
- ✅ Database tables (Week 1)
- ✅ Type definitions (Week 1)
- ✅ Authentication (Week 1)

---

## 📝 Notes

- **Caching Strategy:** Market data snapshots stored with timestamps
- **Rate Limiting:** Be mindful of Alias API rate limits
- **Error Recovery:** Graceful degradation if Alias API unavailable
- **Confidence Threshold:** Only auto-map if confidence >= 0.85

---

**Ready to start implementation!** 🚀
