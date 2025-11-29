# Alias "List on Alias" Button - Testing Guide

**Created:** 2025-11-25
**Feature:** Wire up "List on Alias" button with Week 3 APIs

---

## Overview

The "List on Alias" button has been wired up to use the Week 3 Alias listing APIs. This guide will help you test the complete flow from button click to listing creation.

---

## Prerequisites

Before testing:
1. **Start dev server:** `npm run dev`
2. **Have Alias PAT configured:** Check `.env.local` has `ALIAS_PAT=...`
3. **Have an inventory item ready** with a SKU that exists on Alias (e.g., "DD1391-100" for Jordan 1)
4. **Be authenticated** in the app

---

## Test Flow Overview

```
Click "List on Alias" Button
    ↓
Check if already listed?
    ↓
Check if mapped to Alias?
    ↓
Call SKU Matcher API
    ↓
Show Confirmation Modal
    ↓
User Confirms Match
    ↓
Create inventory_alias_links
    ↓
Create Alias Listing
    ↓
Success Toast + Refetch
```

---

## Test Scenarios

### Scenario 1: Unmapped Item (First Time)

**Setup:** Item has NO Alias mapping yet

**Steps:**
1. Navigate to [http://localhost:3000/portfolio/inventory](http://localhost:3000/portfolio/inventory)
2. Find an item with a popular SKU (e.g., Air Jordan 1)
3. Click the **⋮** (three dots) button on that row
4. Click **"Place Listing"** under the **Alias** section

**Expected Result:**
- ✅ Loading state appears
- ✅ SKU matching API is called
- ✅ **"Confirm Alias Match"** modal appears showing:
  - Your inventory item (name + SKU)
  - Suggested Alias match (name + SKU)
  - Confidence score (e.g., "100% confidence")
  - Warning message about verifying the match
- ✅ Buttons: "Cancel" and "Confirm & Continue"

**Next Step:** Click "Confirm & Continue"

**Expected Result After Confirmation:**
- ✅ Modal closes
- ✅ `inventory_alias_links` is created (check database or logs)
- ✅ Listing is created via `/api/alias/listings/create`
- ✅ Success toast: "Alias listing created successfully"
- ✅ Inventory refetches
- ✅ Button state updates (see Scenario 3)

---

### Scenario 2: No Match Found

**Setup:** Item with SKU that doesn't exist on Alias

**Steps:**
1. Find an item with a non-existent or very rare SKU
2. Click **"Place Listing"** in the actions menu

**Expected Result:**
- ✅ **"No Alias Match Found"** modal appears showing:
  - Your inventory item (name + SKU)
  - Error icon
  - Message: "No match found in Alias catalog"
  - Explanation: "This item needs to be manually mapped..."
- ✅ Only one button: "Close"

**Action:** Click "Close"

**Expected Result:**
- ✅ Modal closes
- ✅ No database writes
- ✅ No listing created

---

### Scenario 3: Already Listed Item

**Setup:** Item already has an Alias listing (from Scenario 1)

**Steps:**
1. Find the same item from Scenario 1
2. Check the **⋮** (three dots) menu

**Expected Result:**
- ✅ Button shows **"Edit Listing"** instead of "Place Listing"
- OR
- ✅ "Place Listing" button is disabled/hidden
- ✅ If you click "Place Listing", toast shows: "This item already has an Alias listing."

---

### Scenario 4: Already Mapped Item (Second Time)

**Setup:** Item has Alias mapping but no listing yet

**Steps:**
1. If you have an item with `inventory_alias_links` but no listing
2. Click **"Place Listing"**

**Expected Result:**
- ✅ **Skips** the match confirmation modal
- ✅ Directly creates the listing
- ✅ Success toast: "Alias listing created successfully"
- ✅ Inventory refetches

---

## Verification Checklist

After completing the tests, verify:

### 1. Database - `inventory_alias_links`

```sql
SELECT
  inventory_id,
  alias_catalog_id,
  mapping_status,
  match_confidence,
  last_sync_at
FROM inventory_alias_links
WHERE inventory_id = '<your-test-item-id>';
```

**Expected:**
- ✅ Row exists with `alias_catalog_id` populated
- ✅ `mapping_status = 'ok'`
- ✅ `match_confidence` between 0.0 and 1.0
- ✅ `last_sync_at` is recent

---

### 2. Database - `alias_listings`

```sql
SELECT
  listing_id,
  user_id,
  catalog_id,
  inventory_id,
  price_cents,
  size,
  status,
  created_at
FROM alias_listings
WHERE inventory_id = '<your-test-item-id>';
```

**Expected:**
- ✅ Row exists with `listing_id` populated
- ✅ `catalog_id` matches the confirmed Alias catalog ID
- ✅ `inventory_id` matches your test item
- ✅ `price_cents` is a whole dollar amount (e.g., 25000 for $250)
- ✅ `status = 'LISTING_STATUS_INACTIVE'` (default)
- ✅ `size` matches your inventory item size

---

### 3. API Logs

Check console/terminal for:

**Match API:**
```
[Alias] Item not mapped, calling SKU matcher...
```

**Link API:**
```
[Alias Link] Created mapping for inventory_id: ...
```

**Create Listing API:**
```
[Alias Create Listing] Listing created: { listing_id: "...", status: "LISTING_STATUS_INACTIVE" }
```

---

### 4. UI State

After listing is created:

- ✅ "Place Listing" button changes state (if implemented)
- ✅ Inventory row shows listing indicator
- ✅ Button is disabled or shows "Edit Listing"

---

## Error Scenarios

### Test 1: API Failure

**Setup:** Temporarily break the Alias PAT in `.env.local`

**Expected:**
- ✅ Error toast: "Failed to create Alias listing"
- ✅ No database writes
- ✅ Button returns to clickable state

---

### Test 2: Price Validation Error

**Expected:** (This is automatically handled)
- ✅ Price is rounded to whole dollars (e.g., 25050 → 25000)
- ✅ No validation errors

---

### Test 3: Missing Fields

**Setup:** Item with missing `size_uk`

**Expected:**
- ✅ Listing creation may fail with error
- ✅ Error toast shows helpful message

---

## Manual API Testing (Optional)

If you want to test the APIs directly:

### 1. Match API

```bash
curl -X POST http://localhost:3000/api/alias/match \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "DD1391-100",
    "productName": "Jordan 1 Retro High OG Black White",
    "brand": "Air Jordan"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "catalogId": "jordan-1-retro-high-og-black-white-dd1391-100",
  "confidence": 1.0,
  "catalogItem": {
    "catalog_id": "...",
    "name": "...",
    "sku": "DD1391-100"
  },
  "matchMethod": "exact_sku"
}
```

---

### 2. Link API

```bash
curl -X POST http://localhost:3000/api/alias/link \
  -H "Content-Type: application/json" \
  -d '{
    "inventory_id": "<your-inventory-id>",
    "alias_catalog_id": "jordan-1-retro-high-og-black-white-dd1391-100",
    "match_confidence": 1.0
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "link": {
    "inventory_id": "...",
    "alias_catalog_id": "...",
    "mapping_status": "ok"
  },
  "message": "Alias mapping created successfully"
}
```

---

### 3. Create Listing API

```bash
curl -X POST http://localhost:3000/api/alias/listings/create \
  -H "Content-Type: application/json" \
  -d '{
    "catalog_id": "jordan-1-retro-high-og-black-white-dd1391-100",
    "price_cents": 25000,
    "size": 10.5,
    "size_unit": "US",
    "condition": "PRODUCT_CONDITION_NEW",
    "packaging_condition": "PACKAGING_CONDITION_GOOD_CONDITION",
    "activate": false,
    "inventory_id": "<your-inventory-id>"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "listing": {
    "listing_id": "...",
    "catalog_id": "...",
    "status": "LISTING_STATUS_INACTIVE"
  },
  "message": "Listing created (inactive)"
}
```

---

## Known Limitations

1. **Size Conversion:** Currently defaults to `size_unit: "US"` but item sizes are stored as UK sizes. Manual conversion needed.
2. **Condition:** Defaults to `PRODUCT_CONDITION_NEW`. Future enhancement: let user select.
3. **Price:** Uses `lowestAsk` from market data, falls back to market price. User can't customize yet.
4. **Activation:** Defaults to inactive for safety. User must manually activate later.

---

## Success Criteria

- ✅ Button click triggers the full flow
- ✅ Match confirmation modal appears for unmapped items
- ✅ User can confirm or reject match
- ✅ `inventory_alias_links` is created after confirmation
- ✅ `alias_listings` is created with correct data
- ✅ Success toast appears
- ✅ Inventory refetches and updates UI
- ✅ Button state changes appropriately
- ✅ No errors in console
- ✅ StockX code remains untouched

---

## Troubleshooting

### Problem: "Failed to match item to Alias catalog"
**Solution:** Check Alias PAT is valid and API is accessible

### Problem: "Alias API authentication failed"
**Solution:** Verify `ALIAS_PAT` in `.env.local`, refresh it if expired

### Problem: "Price must be in whole dollar increments"
**Solution:** This shouldn't happen (we round automatically), but check price calculation

### Problem: Modal doesn't appear
**Solution:** Check browser console for React errors, verify modal imports

### Problem: Listing not showing in database
**Solution:** Check API logs, verify user_id matches authenticated user

---

**Status:** Ready for Testing
**Date:** 2025-11-25
**Next Steps:** Test all scenarios and report any issues
