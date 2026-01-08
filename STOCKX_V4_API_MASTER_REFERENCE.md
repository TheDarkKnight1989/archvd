# StockX V4 API Master Reference
**Created:** 2025-12-08
**Purpose:** Single source of truth for Inventory V4 StockX integration
**Status:** Building from validated sources

---

## 📋 Overview

This document contains **validated** information about the StockX API for use in Inventory V4.

**DO NOT add information here without verification.**

### Base Information
- **Base URL:** `https://api.stockx.com`
- **API Version:** `v2` (must be in URL path)
- **Format:** JSON only
- **Protocol:** REST with standard HTTP methods

### 🌍 Regional Configuration
- **Primary Region:** UK (GBP) ⚠️ **DEFAULT TO GBP, NOT USD**
- **Region Priority:**
  1. 🇬🇧 UK (GBP) - Primary
  2. 🇪🇺 EU (EUR) - Secondary
  3. 🇺🇸 US (USD) - Tertiary
- **Important:** All API calls with `currencyCode` parameter should default to `GBP`

### API Categories
1. **Catalog Search** - Search products
2. **Listing Management** - Place and manage listings (asks)
3. **Order Management** - Get order/sales information

---

## 🔐 Authentication

### Required Headers
```
Authorization: Bearer {access_token}
X-API-Key: {api_key}
```

### Authentication Flow
1. **API Key** - Generated after developer access approval
2. **OAuth 2.0** - Access token required for each request
3. Both required for all API calls

### Important Notes
- Listings are **asynchronous** - write requests return operations to track progress
- Operations have statuses: `PENDING`, `SUCCEEDED`, `FAILED`
- Check `operationUrl` to poll status
- StockX never updates listing amounts (seller control only)

---

## 🔄 Rate Limits & Quotas

### Standard Limits
- **Daily Quota:** 25,000 requests per 24 hours (resets at 12 AM UTC)
- **Rate Limit:** 1 request per second
- **Exceeded Response:** HTTP 429

### Batch Limits
- **Batch Size:** 500 items every 5 minutes
- **Daily Batch Limit:** 50,000 items per day
- **Calculation:** Throttled based on number of items in request

### Request Increase
Contact: developersupport@stockx.com (evaluated case-by-case)

---

## 🔑 API Endpoints

### Example Endpoint Structure
```
https://api.stockx.com/v2/selling/listings
                      └─┬─┘ └────┬────┘
                      version   resource
```

### HTTP Methods
| Method | Purpose | Success Code |
|--------|---------|--------------|
| GET | Read resource | 200 |
| POST | Create resource | 201 (create) / 200 (other) |
| PATCH | Update resource | 200 |
| PUT | Update resource | 200 |
| DELETE | Delete resource | 200 |

---

## 🔍 Catalog Search API

### Endpoint: Search Catalog
```
GET /v2/catalog/search
```

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | query | ✅ | Keyword, GTIN (UPC/EAN/ITF-14), or styleId (1-100 chars) |
| `pageNumber` | query | ❌ | Page number (≥1, default: 1) |
| `pageSize` | query | ❌ | Items per page (1-50, default: 1) |

### Search Types Supported
- **Keyword:** `query=nike`
- **GTIN (UPC/EAN):** `query=194817794556`
- **StyleId (SKU):** `query=DD1391-100`

### Response Structure (200 OK)
```json
{
  "count": 266,
  "pageSize": 10,
  "pageNumber": 1,
  "hasNextPage": true,
  "products": [
    {
      "productId": "bf364c53-eb77-4522-955c-6a6ce952cc6f",
      "urlKey": "purple-hand-bag-leather",
      "styleId": "BY9109",
      "productType": "handbags",
      "title": "Gucci Duchessa Boston Bag",
      "brand": "Nike",
      "productAttributes": {
        "gender": "women",
        "season": "SS21",
        "releaseDate": "2017-09-14",
        "retailPrice": 456,
        "colorway": "String/Black-Villain Red-Neptune Green",
        "color": "purple"
      },
      "sizeChart": {
        "availableConversions": [
          {
            "name": "US M",
            "type": "us m"
          }
        ],
        "defaultConversion": {
          "name": "US M",
          "type": "us m"
        }
      },
      "isFlexEligible": true,
      "isDirectEligible": false
    }
  ]
}
```

### Response Fields
| Field | Type | Description |
|-------|------|-------------|
| `count` | number | Total number of matching items |
| `pageSize` | number | Items in current page |
| `pageNumber` | number | Current page number |
| `hasNextPage` | boolean | True if more pages available |
| `products` | array | List of matching products |

### Product Object Fields
| Field | Type | Description |
|-------|------|-------------|
| `productId` | string | ✅ Unique identifier (needed for market data API) |
| `urlKey` | string | URL-friendly product name |
| `styleId` | string\|null | ✅ Style ID (SKU like "DD1391-100") |
| `productType` | string | Category (sneakers, handbags, etc.) |
| `title` | string\|null | Display name |
| `brand` | string\|null | Brand name |
| `productAttributes.gender` | string\|null | Target gender |
| `productAttributes.season` | string\|null | Release season |
| `productAttributes.releaseDate` | string\|null | Release date (YYYY-MM-DD) |
| `productAttributes.retailPrice` | number\|null | Original retail price |
| `productAttributes.colorway` | string\|null | Color description |
| `productAttributes.color` | string\|null | Primary color |
| `sizeChart` | object | Available size conversions |
| `isFlexEligible` | boolean | Flex program eligible |
| `isDirectEligible` | boolean | Direct fulfillment eligible |

### Important Notes
- Use `productId` from search results to call market data API
- `styleId` is the SKU (may be null for some products)
- Pagination required for large result sets
- Retail price is a number, not a string (unlike market data)

---

## 📊 Response Formats

### Standard HTTP Response Codes
| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | Success - No content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 413 | Request too large |
| 415 | Unsupported media type |
| 429 | Rate limit exceeded |
| 500 | Internal Server Error |
| 503 | Service Unavailable |
| 504 | Gateway Timeout |

### Operation Response Structure
```json
{
  "listingId": "1384fba7-abde-4986-b06c-2e9887ff0f33",
  "operationId": "218720db-afc9-41d6-9a76-d3993e2de8fb",
  "operationType": "ACTIVATE",
  "operationStatus": "PENDING|SUCCEEDED|FAILED",
  "operationUrl": "https://api.stockx.com/v2/selling/listings/{listingId}/operations/{operationId}",
  "operationInitiatedBy": "USER|SYSTEM",
  "createdAt": "2022-10-19T20:27:55.323Z",
  "updatedAt": "2022-10-19T20:27:55.323Z",
  "error": null,
  "changes": {
    "additions": {},
    "updates": {},
    "removals": {}
  }
}
```

---

## 📦 Product Details API

### Endpoint: Get Single Product Details
```
GET /v2/catalog/products/{productId}
```

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `productId` | path | ✅ | Unique identifier for product |

### Response Structure (200 OK)
```json
{
  "productId": "bf364c53-eb77-4522-955c-6a6ce952cc6f",
  "urlKey": "purple-hand-bag-leather",
  "styleId": "BY9109",
  "productType": "handbags",
  "title": "Gucci Duchessa Boston Bag",
  "brand": "Nike",
  "productAttributes": {
    "gender": "women",
    "season": "SS21",
    "releaseDate": "2017-09-14",
    "retailPrice": 456,
    "colorway": "String/Black-Villain Red-Neptune Green",
    "color": "purple"
  },
  "sizeChart": {
    "availableConversions": [
      {
        "name": "US M",
        "type": "us m"
      }
    ],
    "defaultConversion": {
      "name": "US M",
      "type": "us m"
    }
  },
  "isFlexEligible": true,
  "isDirectEligible": false
}
```

### Response Fields
Same as Catalog Search product object (see above)

### Use Case
- Get detailed information for a specific product
- Fetch after Catalog Search to get full product details
- Use `productId` from search results

### Important Notes
- Shows size chart conversions but NOT variantIds
- Need separate API call to get market data per variant
- Retail price is a number (not string like market data)

### Error Responses
| Code | Meaning |
|------|---------|
| 401 | Unauthorized |
| 404 | Not found |
| 500 | Internal Server Error |

---

## 🔍 Variant by GTIN API

### Endpoint: Get Variant by Barcode (GTIN)
```
GET /v2/catalog/products/variants/gtins/{gtin}
```

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `gtin` | path | ✅ | GTIN/UPC/EAN barcode identifier |

**Example:** `194817794556`

### Response Structure (200 OK)
```json
{
  "productId": "bf364c53-eb77-4522-955c-6a6ce952cc6f",
  "variantId": "586c3334-4dac-4ee0-bce3-eea845581a08",
  "variantName": "Auston-Matthews-2016-Upper-Deck-Series-1-Young-Guns-Rookie-201:0",
  "variantValue": "PSA 10",
  "sizeChart": {
    "availableConversions": [
      {
        "size": "5",
        "type": "us m"
      }
    ],
    "defaultConversion": {
      "size": "5",
      "type": "us m"
    }
  },
  "gtins": [
    {
      "identifier": "887231059577",
      "type": "UPC"
    }
  ],
  "isFlexEligible": true,
  "isDirectEligible": false
}
```

### Response Fields
| Field | Type | Description |
|-------|------|-------------|
| `productId` | string | ✅ Product identifier |
| `variantId` | string | ✅ Variant identifier (size-specific) |
| `variantName` | string | SKU of the variant |
| `variantValue` | string | ✅ Display size (e.g., "10.5") |
| `sizeChart` | object | Size conversions |
| `gtins` | array | All GTINs for this variant |
| `isFlexEligible` | boolean | Flex eligible |
| `isDirectEligible` | boolean | Direct eligible |

### Use Case
**🚀 FASTEST PATH - Use with barcode scanner:**
1. Scan barcode → Get GTIN
2. Call this API → Get `productId` + `variantId` in one call
3. Call Market Data → Get prices
4. Done! (No need for Catalog Search or Product Variants)

### Important Notes
- ⚡ **Most efficient** - Gets exact variant without searching
- Returns SINGLE variant (the one with that barcode)
- Returns both `productId` AND `variantId` together
- Perfect for warehouse/inventory scanning workflows

### Error Responses
| Code | Meaning |
|------|---------|
| 400 | Invalid GTIN format |
| 401 | Unauthorized |
| 404 | GTIN not found |
| 500 | Internal Server Error |

---

## 📐 Product Variants API

### Endpoint: Get All Product Variants
```
GET /v2/catalog/products/{productId}/variants
```

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `productId` | path | ✅ | Unique identifier for product |

### Response Structure (200 OK)
Returns an **array** of variants:

```json
[
  {
    "productId": "bf364c53-eb77-4522-955c-6a6ce952cc6f",
    "variantId": "586c3334-4dac-4ee0-bce3-eea845581a08",
    "variantName": "Auston-Matthews-2016-Upper-Deck-Series-1-Young-Guns-Rookie-201:0",
    "variantValue": "PSA 10",
    "sizeChart": {
      "availableConversions": [
        {
          "size": "5",
          "type": "us m"
        }
      ],
      "defaultConversion": {
        "size": "5",
        "type": "us m"
      }
    },
    "gtins": [
      {
        "identifier": "887231059577",
        "type": "UPC"
      }
    ],
    "isFlexEligible": true,
    "isDirectEligible": false
  }
]
```

### Response Fields (per variant)
| Field | Type | Description |
|-------|------|-------------|
| `productId` | string | ✅ Parent product identifier |
| `variantId` | string | ✅ Unique variant identifier (for market data API) |
| `variantName` | string | SKU of the variant |
| `variantValue` | string\|null | ✅ Display value (size like "10.5" or "PSA 10") |
| `sizeChart` | object | Size conversions for this variant |
| `sizeChart.defaultConversion.size` | string | ✅ The actual size value |
| `gtins` | array | GTINs (UPC/EAN) associated with this variant |
| `isFlexEligible` | boolean | Flex program eligible |
| `isDirectEligible` | boolean | Direct fulfillment eligible |

### Use Case
**CRITICAL API** - Use this to get variantIds for market data fetching:
1. Call Catalog Search → get `productId`
2. Call Product Variants → get array of all `variantId` + sizes
3. Call Market Data for each `variantId` → get prices per size

### Important Notes
- Returns ALL variants (all sizes) for a product
- Each variant has unique `variantId` needed for market data API
- `variantValue` is the display size (e.g., "10.5" for sneakers)
- For sneakers: One variant per size (UK 9, UK 9.5, UK 10, etc.)

### Error Responses
| Code | Meaning |
|------|---------|
| 401 | Unauthorized |
| 404 | Product not found |
| 500 | Internal Server Error |

---

## 💰 Market Data API

### Endpoint: Get Market Data for Variant
```
GET /v2/catalog/products/{productId}/variants/{variantId}/market-data
```

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `productId` | path | ✅ | Unique identifier for product |
| `variantId` | path | ✅ | Unique identifier for variant (size-specific) |
| `currencyCode` | query | ❌ | Currency code (defaults to USD) |
| `country` | query | ⚠️ DEPRECATED | ISO Alpha-2 country code |

### Supported Currencies
`AUD`, `BRL`, `CAD`, `CHF`, `CLP`, `CNY`, `DKK`, `EUR`, `GBP`, `HKD`, `HUF`, `IDR`, `ILS`, `JPY`, `KRW`, `KWD`, `MOP`, `MXN`, `MYR`, `NOK`, `NZD`, `PEN`, `PHP`, `PLN`, `SEK`, `SGD`, `THB`, `TWD`, `USD`, `VND`

### Response Structure (200 OK)
```json
{
  "productId": "35d76ac8-a112-4d75-b44f-c8ef04a87c93",
  "variantId": "35d76ac8-a112-4d75-b44f-c8ef04a87c93",
  "currencyCode": "USD",
  "lowestAskAmount": "100",
  "highestBidAmount": "150",
  "sellFasterAmount": "150",
  "earnMoreAmount": "151",
  "flexLowestAskAmount": "100",
  "standardMarketData": {
    "beatUS": "152",
    "earnMore": "151",
    "sellFaster": "150",
    "highestBidAmount": "150",
    "lowestAsk": "100"
  },
  "flexMarketData": {
    "beatUS": "152",
    "earnMore": "151",
    "sellFaster": "150",
    "highestBidAmount": "150",
    "lowestAsk": "100"
  },
  "directMarketData": {
    "beatUS": "152",
    "earnMore": "151",
    "sellFaster": "150",
    "highestBidAmount": "150",
    "lowestAsk": "100"
  }
}
```

### Response Fields
| Field | Type | Description |
|-------|------|-------------|
| `productId` | string | Unique product identifier |
| `variantId` | string | Unique variant identifier |
| `currencyCode` | string | Currency code for all amounts |
| `lowestAskAmount` | string\|null | ✅ Lowest ask in market (MAJOR UNITS) |
| `highestBidAmount` | string\|null | ✅ Highest bid in market (MAJOR UNITS) |
| `sellFasterAmount` | string\|null | Price to become lowest ask in US |
| `earnMoreAmount` | string\|null | Price to maximize earnings |
| `flexLowestAskAmount` | string\|null | Flex program lowest ask |
| `standardMarketData` | object | Standard market pricing |
| `flexMarketData` | object | Flex market pricing |
| `directMarketData` | object | Direct market pricing |

### 🚨 CRITICAL: Data Units
- **All amounts are STRINGS** (`"100"` not `100`)
- **All amounts in MAJOR UNITS** (`"100"` = $100.00, NOT cents)
- **Must parse as numbers:** `parseFloat(lowestAskAmount)`
- **No conversion needed** - already in dollars/pounds/euros

### Market Data Types
**Standard Market:** Regular StockX marketplace
**Flex Market:** StockX Flex program (consignment)
**Direct Market:** Direct-to-consumer sales

### Important Notes
- ⚠️ **Undercut protection disabled** - System may auto-set price below yours
- ⚠️ **Country param deprecated** - Market data based on your region
- Response structure varies by region
- Validation error if variant doesn't belong to product

### Error Responses
| Code | Meaning |
|------|---------|
| 400 | Variant does not belong to product |
| 401 | Unauthorized |
| 500 | Internal Server Error |

---

## 🧪 Test Cases

_(To be filled)_

---

## ⚠️ Known Issues

_(To be filled)_

---

**Last Updated:** 2025-12-08
**Contributors:** Building collaboratively
