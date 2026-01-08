# eBay API Reference - Authenticated New Sneakers

## Quick Answer

**To get NEW sneakers with Authenticity Guarantee on eBay:**

```typescript
import { searchAuthenticatedNewSneakers } from '@/lib/services/ebay/sneakers'

const result = await searchAuthenticatedNewSneakers('Jordan 4 Black Cat', {
  limit: 50,
  soldItemsOnly: true, // for market data
})
```

This automatically applies:
- ✅ `conditionIds:{1000}` (NEW)
- ✅ `qualifiedPrograms:{AUTHENTICITY_GUARANTEE}`
- ✅ `categoryIds:{15709|95672|155194}` (sneaker categories)

---

## eBay Browse API - Filter Reference

### Base Endpoint
```
GET https://api.ebay.com/buy/browse/v1/item_summary/search
```

### Authentication
```
Authorization: Bearer {oauth_token}
X-EBAY-C-MARKETPLACE-ID: EBAY_GB  // or EBAY_US, EBAY_DE, etc.
```

### Filter Syntax

Multiple filters are **comma-separated**:
```
filter=conditionIds:{1000},qualifiedPrograms:{AUTHENTICITY_GUARANTEE},categoryIds:{15709}
```

---

## Condition IDs

| Condition | ID | Description |
|-----------|-----|-------------|
| **NEW** | **1000** | Brand new, unworn |
| New with defects | 1500 | New but has defects |
| New without box | 1750 | New but no original box |
| Pre-owned | 3000 | Used/worn |
| Very Good | 4000 | Gently used |
| Good | 5000 | Used with visible wear |
| Acceptable | 6000 | Heavily used |

**For premium sneakers, use:** `conditionIds:{1000}`

---

## Qualified Programs

| Program | Value | Description |
|---------|-------|-------------|
| **Authenticity Guarantee** | **AUTHENTICITY_GUARANTEE** | eBay's authentication service |
| eBay Refurbished | EBAY_REFURBISHED | Refurbished items |

**For authenticated sneakers, use:** `qualifiedPrograms:{AUTHENTICITY_GUARANTEE}`

---

## Sneaker Category IDs

### US Marketplace (EBAY_US)

| Category | ID | Gender |
|----------|-----|--------|
| Athletic Sneakers | 15709 | Men |
| Athletic Sneakers | 95672 | Women |
| Athletic Sneakers | 155194 | Unisex |
| Casual Sneakers | 24087 | Men |
| Casual Sneakers | 63889 | Women |

### UK Marketplace (EBAY_GB)

**Note:** Category IDs may differ by marketplace. Use the Taxonomy API to find exact IDs:
```
GET https://api.ebay.com/commerce/taxonomy/v1/category_tree/{category_tree_id}
```

**For sneakers, use:** `categoryIds:{15709|95672|155194}`

---

## Complete Example Filters

### 1. NEW + AUTHENTICATED sneakers (SOLD)
```
filter=conditionIds:{1000},qualifiedPrograms:{AUTHENTICITY_GUARANTEE},categoryIds:{15709|95672|155194},soldItemsOnly:true
```

### 2. NEW sneakers (any condition, ACTIVE listings)
```
filter=conditionIds:{1000},categoryIds:{15709|95672|155194}
```

### 3. AUTHENTICATED sneakers (any condition, SOLD)
```
filter=qualifiedPrograms:{AUTHENTICITY_GUARANTEE},categoryIds:{15709|95672|155194},soldItemsOnly:true
```

---

## Using in Your Code

### Option 1: Use the Helper (Recommended)

```typescript
import { searchAuthenticatedNewSneakers } from '@/lib/services/ebay/sneakers'

// Search sold items (for market data)
const soldItems = await searchAuthenticatedNewSneakers('DD1391-100', {
  soldItemsOnly: true,
  limit: 50,
})

// Search active listings (for current market)
const activeListings = await searchAuthenticatedNewSneakers('Jordan 4 Black Cat', {
  soldItemsOnly: false,
  limit: 50,
})
```

### Option 2: Use the Client Directly (More Control)

```typescript
import { EbayClient } from '@/lib/services/ebay/client'
import { EBAY_CONDITION, EBAY_PROGRAMS, EBAY_SNEAKER_CATEGORIES } from '@/lib/services/ebay/sneakers'

const client = new EbayClient()

const result = await client.searchSold({
  query: 'DD1391-100',
  conditionIds: [EBAY_CONDITION.NEW],
  qualifiedPrograms: [EBAY_PROGRAMS.AUTHENTICITY_GUARANTEE],
  categoryIds: [
    EBAY_SNEAKER_CATEGORIES.ATHLETIC_SNEAKERS_MEN,
    EBAY_SNEAKER_CATEGORIES.ATHLETIC_SNEAKERS_WOMEN,
  ],
  soldItemsOnly: true,
  limit: 50,
})
```

---

## Additional APIs for Advanced Use Cases

### 1. Check if Item is Authenticated

Use `getItem` to check specific item:

```typescript
GET /buy/browse/v1/item/{item_id}
```

Response includes:
```json
{
  "itemId": "v1|123456789|0",
  "qualifiedPrograms": ["AUTHENTICITY_GUARANTEE"],
  "condition": "NEW",
  "conditionId": "1000"
}
```

### 2. Check Eligibility BEFORE Listing

Use Trading API (legacy):

```xml
POST https://api.ebay.com/ws/api.dll
<!-- Trading API: IsItemEMSEligible -->
```

**Note:** This requires Trading API credentials (different from Browse API)

### 3. Find Exact Category ID

```typescript
GET /commerce/taxonomy/v1/category_tree/0/get_category_suggestions?q=sneakers
```

---

## Test It Now

Run the test script:

```bash
npx tsx scripts/test-ebay-authenticated-sneakers.ts
```

Expected output:
```
🔍 Query: "Jordan 4 Black Cat"
   ✅ Found 24 sold items

   Sample items:
   1. Nike Air Jordan 4 Retro Black Cat 2020 DD1391-100
      Price: GBP 289.99
      Sold: 2025-11-28T14:23:00Z
      Item ID: v1|334567890|0

   📊 Market Stats:
      Average: GBP 275.50
      Range: GBP 245.00 - 315.00
      Sales: 24 items
```

---

## Marketplace IDs

| Marketplace | ID | Currency |
|-------------|-----|----------|
| United States | EBAY_US | USD |
| United Kingdom | EBAY_GB | GBP |
| Germany | EBAY_DE | EUR |
| France | EBAY_FR | EUR |
| Italy | EBAY_IT | EUR |
| Spain | EBAY_ES | EUR |
| Canada | EBAY_CA | CAD |
| Australia | EBAY_AU | AUD |

**Note:** Authenticity Guarantee availability varies by marketplace. Check eBay's documentation for current coverage.

---

## Rate Limits

- **Browse API:** 5,000 calls/day (default)
- **OAuth Token:** 2 hours expiry (auto-refreshed in our implementation)

Our client automatically:
- ✅ Caches OAuth tokens
- ✅ Refreshes before expiry (60s buffer)
- ✅ Handles errors gracefully

---

## Summary

**The work we did allows you to:**

1. ✅ Search for NEW sneakers (`conditionIds:{1000}`)
2. ✅ Filter by Authenticity Guarantee (`qualifiedPrograms:{AUTHENTICITY_GUARANTEE}`)
3. ✅ Target sneaker categories (`categoryIds:{...}`)
4. ✅ Get sold items OR active listings (`soldItemsOnly:true/false`)
5. ✅ All behind feature flag (`EBAY_MARKET_DATA_ENABLED`)

**Ready to use right now!**
