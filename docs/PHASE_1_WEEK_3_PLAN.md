# Phase 1, Week 3: Listing Creation & Management

**Goal:** Enable creating, managing, and syncing Alias listings with full user control

**Prerequisites:** ✅ Week 1 & 2 Complete (Database, API client, catalog search, pricing)

---

## 📋 Week 3 Tasks

### Task 1: Create Listing API Route

**Create:** `src/app/api/alias/listings/create/route.ts`

**Functionality:**
- Accept listing parameters (catalog_id, price, size, condition, etc.)
- Call Alias API to create listing
- Store listing in `alias_listings` table
- Create link in `inventory_alias_links` (if inventory_id provided)
- Return listing ID and status

**Request:**
```typescript
POST /api/alias/listings/create
{
  catalog_id: "air-jordan-5-retro-grape-2025-hq7978-100",
  price_cents: 25000,  // $250.00
  size: 10.5,
  size_unit: "SIZE_UNIT_US",
  condition: "CONDITION_NEW",
  packaging_condition: "PACKAGING_CONDITION_GOOD_CONDITION",
  activate: false,  // Create as inactive by default
  inventory_id?: "uuid"  // Optional link to inventory
}
```

**Response:**
```typescript
{
  success: true,
  listing: {
    id: "listing_xyz",
    alias_listing_id: "...",
    status: "LISTING_STATUS_PENDING",
    created_at: "..."
  }
}
```

---

### Task 2: Update Listing API Route

**Create:** `src/app/api/alias/listings/[listingId]/update/route.ts`

**Functionality:**
- Update listing price
- Update condition/packaging
- Update metadata
- Sync changes to Alias API
- Update database

**Request:**
```typescript
PATCH /api/alias/listings/[listingId]/update
{
  price_cents?: 24000,  // New price
  condition?: "CONDITION_NEW",
  packaging_condition?: "PACKAGING_CONDITION_GOOD_CONDITION"
}
```

**Response:**
```typescript
{
  success: true,
  listing: {
    id: "listing_xyz",
    price_cents: 24000,
    updated_at: "..."
  }
}
```

---

### Task 3: Activate/Deactivate Listing Routes

**Create:**
- `src/app/api/alias/listings/[listingId]/activate/route.ts`
- `src/app/api/alias/listings/[listingId]/deactivate/route.ts`

**Functionality:**
- Call Alias API activate/deactivate endpoints
- Update listing status in database
- Return updated status

**Request:**
```typescript
POST /api/alias/listings/[listingId]/activate
POST /api/alias/listings/[listingId]/deactivate
```

**Response:**
```typescript
{
  success: true,
  listing: {
    id: "listing_xyz",
    status: "LISTING_STATUS_ACTIVE" | "LISTING_STATUS_INACTIVE"
  }
}
```

---

### Task 4: Delete Listing API Route

**Create:** `src/app/api/alias/listings/[listingId]/delete/route.ts`

**Functionality:**
- Call Alias API to delete listing
- Remove from `alias_listings` table
- Update `inventory_alias_links` (remove listing_id reference)
- Return success confirmation

**Request:**
```typescript
DELETE /api/alias/listings/[listingId]
```

**Response:**
```typescript
{
  success: true,
  message: "Listing deleted successfully"
}
```

---

### Task 5: List User Listings API Route

**Create:** `src/app/api/alias/listings/route.ts`

**Functionality:**
- Fetch all listings for authenticated user
- Support pagination
- Filter by status (active, inactive, pending)
- Join with catalog data for display

**Request:**
```typescript
GET /api/alias/listings?status=ACTIVE&limit=50
```

**Response:**
```typescript
{
  success: true,
  listings: [
    {
      id: "...",
      alias_listing_id: "...",
      catalog_id: "...",
      price_cents: 25000,
      size: 10.5,
      status: "LISTING_STATUS_ACTIVE",
      created_at: "...",
      catalog_item?: { name, sku, brand, ... }
    }
  ],
  hasMore: false
}
```

---

### Task 6: Listing Operations Service

**Create:** `src/lib/services/alias/listings.ts`

**Functions:**
```typescript
// Create listing and store in DB
async function createAliasListing(params: CreateListingParams): Promise<ListingResult>

// Update listing price/details
async function updateAliasListing(listingId: string, updates: UpdateListingParams): Promise<ListingResult>

// Activate listing
async function activateAliasListing(listingId: string): Promise<ListingResult>

// Deactivate listing
async function deactivateAliasListing(listingId: string): Promise<ListingResult>

// Delete listing
async function deleteAliasListing(listingId: string): Promise<void>

// Sync listing from Alias API
async function syncAliasListing(listingId: string): Promise<ListingResult>

// Link listing to inventory item
async function linkListingToInventory(listingId: string, inventoryId: string): Promise<void>
```

**Database Operations:**
```sql
-- Insert listing
INSERT INTO alias_listings (
  user_id, alias_listing_id, alias_product_id,
  price_cents, size, size_unit, condition,
  packaging_condition, status, metadata
) VALUES (...)

-- Update inventory link
UPDATE inventory_alias_links
SET alias_listing_id = ?
WHERE inventory_id = ?

-- Sync listing status
UPDATE alias_listings
SET status = ?, updated_at = NOW()
WHERE id = ?
```

---

## 🎯 Deliverables

By end of Week 3:

1. ✅ **API Routes (6)**
   - Create listing
   - Update listing
   - Activate/deactivate listing
   - Delete listing
   - List user listings

2. ✅ **Listing Service**
   - `listings.ts` - Listing operations with DB sync

3. ✅ **Database Integration**
   - Write to `alias_listings` table
   - Update `inventory_alias_links`
   - Track listing status

4. ✅ **Testing**
   - All routes tested
   - Database operations verified
   - Error handling validated

---

## 🚀 Implementation Order

**Day 1: Core Listing Routes**
1. Create listing route
2. Listing operations service
3. Test create listing flow

**Day 2: Listing Management**
1. Update listing route
2. Activate/deactivate routes
3. Test status changes

**Day 3: Listing Lifecycle**
1. Delete listing route
2. List user listings route
3. Integration testing

**Day 4: Refinement**
1. Error handling
2. Edge cases
3. Documentation

---

## 🔒 Safety & Manual Control

**Important Policies:**

### ⚠️ Manual Creation Only
- ❌ NO automatic listing creation from inventory
- ✅ User must explicitly create each listing
- ✅ All parameters provided by user
- ✅ No background jobs creating listings

### ✅ Explicit User Actions Required
- Creating a listing → User clicks "Create Listing" button
- Activating → User clicks "Activate" button
- Updating price → User enters new price and submits
- Deleting → User confirms deletion

### 🔗 Inventory Linking
- Optional `inventory_id` parameter when creating
- If provided, creates link in `inventory_alias_links`
- User chooses which inventory item to link (if any)
- Can create listings without inventory link

---

## 📊 Testing Strategy

### Unit Tests
- Listing creation with valid params
- Price validation (whole dollars only)
- Status transitions
- Database writes

### Integration Tests
- Full create → activate → update → delete flow
- Inventory linking
- Error scenarios (API failures, invalid params)

### Manual Testing
```bash
# Create listing
curl -X POST http://localhost:3000/api/alias/listings/create \
  -H "Content-Type: application/json" \
  -d '{
    "catalog_id": "air-jordan-5-retro-grape-2025-hq7978-100",
    "price_cents": 25000,
    "size": 10.5,
    "size_unit": "SIZE_UNIT_US",
    "condition": "CONDITION_NEW",
    "packaging_condition": "PACKAGING_CONDITION_GOOD_CONDITION"
  }'

# Activate listing
curl -X POST http://localhost:3000/api/alias/listings/[id]/activate

# Update price
curl -X PATCH http://localhost:3000/api/alias/listings/[id]/update \
  -H "Content-Type: application/json" \
  -d '{"price_cents": 24000}'

# Delete listing
curl -X DELETE http://localhost:3000/api/alias/listings/[id]

# List all listings
curl http://localhost:3000/api/alias/listings
```

---

## 🔗 Dependencies

- ✅ Alias API client (Week 1)
- ✅ `alias_listings` table (Week 1)
- ✅ `inventory_alias_links` table (Week 1)
- ✅ Catalog search (Week 2)
- ✅ Type definitions (Week 1)

---

## 📝 Database Schema Reference

### alias_listings Table
```sql
CREATE TABLE alias_listings (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  alias_listing_id TEXT UNIQUE NOT NULL,
  alias_product_id TEXT,
  price_cents INTEGER NOT NULL,
  size NUMERIC NOT NULL,
  size_unit TEXT NOT NULL,
  condition TEXT,
  packaging_condition TEXT,
  status TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### inventory_alias_links Table
```sql
-- Links inventory to Alias catalog AND listing
CREATE TABLE inventory_alias_links (
  id UUID PRIMARY KEY,
  inventory_id UUID REFERENCES "Inventory",
  alias_catalog_id TEXT NOT NULL,
  alias_listing_id TEXT,  -- ← Updated when listing created
  mapping_status TEXT,
  last_sync_success_at TIMESTAMPTZ,
  ...
);
```

---

## ⚠️ Important Notes

### Price Validation
- Alias requires prices in whole dollar increments
- Must validate: `price_cents % 100 === 0`
- Example: `25000` ($250) ✅, `25050` ($250.50) ❌

### Picture Requirements
- Some items require pictures before activation
- Check `catalog_item.requires_listing_pictures`
- If required and no pictures, listing stays `PENDING`

### Status Flow
```
PENDING → (add pictures if required) → ACTIVE
ACTIVE → INACTIVE → (reactivate) → ACTIVE
ACTIVE/INACTIVE → DELETED
```

---

**Ready to start implementation!** 🚀
