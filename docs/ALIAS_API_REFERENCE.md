# Alias API Reference

**Last Updated:** 2025-11-28

This document serves as the complete reference for the Alias API integration.

---

## Table of Contents

- [Authentication](#authentication)
- [Pagination](#pagination)
- [Endpoints](#endpoints)
- [Error Codes](#error-codes)
- [Rate Limits & Throttling](#rate-limits--throttling)
- [Notes & Quirks](#notes--quirks)
- [Region IDs and Multi-Region Support](#region-ids-and-multi-region-support)
- [Numeric Enum Values](#numeric-enum-values)
- [Currency Conversion](#currency-conversion)
- [Sales History and Analytics](#sales-history-and-analytics)

---

## Authentication

Every request to the Alias API must be authenticated using bearer authentication with Personal Access Tokens (PATs).

### Bearer Authentication

Bearer authentication uses a token (bearer token) that is issued to a user or application. The bearer token must be included in the `Authorization` header of every request.

**Header Format:**
```
Authorization: Bearer <token>
```

### Personal Access Tokens (PATs)

- **Type:** Bearer token for API access
- **Characteristics:**
  - Issued to a specific user and application
  - Do not need to be refreshed
  - Ideal for applications requiring frequent API access
- **Creation:** Through the token manager page
- **Configuration:**
  - Provide a name for the PAT
  - Select the scopes the PAT will have access to
- **Management:** View and manage PATs in the dashboard

### Example Request

```javascript
const BEARER_TOKEN = 'mytoken_84cf6c5c734d4c88';

fetch('https://api.alias.org/api/v1/test', {
  headers: {Authorization: `Bearer ${BEARER_TOKEN}`}
})
  .then(resp => resp.json())
  .then(json => console.log(JSON.stringify(json)));
```

**Base URL:** `https://api.alias.org/api/v1/`

---

## Pagination

Many top-level API resources contain "list" and "search" versions for reading large datasets. These methods share a common structure with pagination controls.

### Pagination Parameters

- **limit:** Number of results per page
- **paginationToken:** Token to retrieve the next page of results

### Pagination Behavior

- **First Page:** Do not specify `paginationToken` to receive the first page
- **Subsequent Pages:** Use the `nextPaginationToken` from the previous response
- **Sequential Access:** Cannot skip ahead or make concurrent requests for different pages
- **Filtering:** Use query control parameters (filters, facets) to concentrate the dataset

### Response Structure

```json
{
  "items": [
    // Array of results
  ],
  "nextPaginationToken": "string",
  "hasMore": true
}
```

**Response Fields:**
- **items:** Array of results for the current page
- **hasMore:** Boolean indicating if more pages exist (`true` if not the last page)
- **nextPaginationToken:** Token to use for retrieving the next page (if `hasMore` is `true`)

### Example Request

```javascript
const PATH = 'search'; // API Path
const LIMIT = 50; // Results limit
const PAGINATION_TOKEN = '857f6e1f-f01e-4c88-b00d-84cf6c5c734d'; // From previous response
const BEARER_TOKEN = 'mytoken_84cf6c5c734d4c88';

fetch(`https://api.alias.org/api/v1/${PATH}?query=${QUERY}&limit=${LIMIT}&paginationToken=${PAGINATION_TOKEN}`, {
  headers: {Authorization: `Bearer ${BEARER_TOKEN}`}
})
  .then(resp => resp.json())
  .then(json => console.log(JSON.stringify(json)));
```

### Important Notes

- Most "list" and "search" requests enforce rate limits
- It is advised to record persistent IDs for re-use in other API operations
- Page order is determined by the specific resource (consult individual API reference)

---

## Endpoints

### Test

**Endpoint:** `GET /api/v1/test`

**Description:**
Test endpoint to confirm that your token is valid and requests are formatted correctly.

**Parameters:**
None

**Request Example:**

```javascript
const BEARER_TOKEN = 'mytoken_84cf6c5c734d4c88';

fetch('https://api.alias.org/api/v1/test', {
  headers: {Authorization: `Bearer ${BEARER_TOKEN}`}
})
  .then(resp => resp.json())
  .then(json => console.log(JSON.stringify(json)));
```

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "ok": true
}
```

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Search Catalog

**Endpoint:** `GET /api/v1/catalog`

**Description:**
Search the catalog for items that are relevant to you, or to match any catalog IDs returned to your inventory.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| query | string | query | Yes | The term to search. Example terms: 'Nike', 'Air Max Plus 'Baltic Blue', '555088 063' |
| limit | string($int64) | query | No | The size of the 'page' returned. The default value is the maximum limit |
| pagination_token | string | query | No | Pass the next pagination token received from a subsequent request. If not provided, the default will be the first page in the set |

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "catalog_items": [
    {
      "catalog_id": "air-jordan-5-retro-grape-2025-hq7978-100",
      "name": "Air Jordan 5 Retro 'Grape' 2025",
      "sku": "HQ7978 100",
      "brand": "Air Jordan",
      "gender": "men",
      "release_date": "2025-06-21",
      "product_category_v2": "shoes",
      "product_type": "sneakers",
      "size_unit": "SIZE_UNIT_US",
      "allowed_sizes": [
        {
          "display_name": "7",
          "value": 7,
          "us_size_equivalent": 7
        },
        {
          "display_name": "7.5",
          "value": 7.5,
          "us_size_equivalent": 7.5
        }
      ],
      "minimum_listing_price_cents": 2500,
      "maximum_listing_price_cents": 200000,
      "main_picture_url": "https://image.goat.com/glow-4-5-25/750/attachments/product_template_pictures/images/111/347/682/original/1556310_00.png.png",
      "retail_price_cents": 21000,
      "colorway": "White/New Emerald/Grape Ice/Black",
      "nickname": "Grape",
      "requires_listing_pictures": false,
      "resellable": true,
      "requested_pictures": [
        {
          "type": "PICTURE_TYPE_OUTER",
          "quantity": 1
        },
        {
          "type": "PICTURE_TYPE_EXTRA",
          "quantity": 3
        }
      ]
    }
  ],
  "next_pagination_token": "some_token",
  "has_more": true
}
```

**Response Fields:**

**catalog_items[]:**
- **catalog_id:** Unique identifier for the catalog item
- **name:** Item name
- **sku:** Stock Keeping Unit
- **brand:** Brand name
- **gender:** Target gender (e.g., "men", "women", "unisex")
- **release_date:** Release date (YYYY-MM-DD format)
- **product_category_v2:** Product category (e.g., "shoes")
- **product_type:** Product type (e.g., "sneakers")
- **size_unit:** Size unit system (e.g., "SIZE_UNIT_US")
- **allowed_sizes[]:** Array of allowed sizes
  - **display_name:** Display name for the size
  - **value:** Numeric size value
  - **us_size_equivalent:** US size equivalent
- **minimum_listing_price_cents:** Minimum listing price in cents
- **maximum_listing_price_cents:** Maximum listing price in cents
- **main_picture_url:** URL to the main product image
- **retail_price_cents:** Retail price in cents
- **colorway:** Colorway description
- **nickname:** Product nickname
- **requires_listing_pictures:** Boolean indicating if listing pictures are required
- **resellable:** Boolean indicating if the item can be resold
- **requested_pictures[]:** Array of requested picture types
  - **type:** Picture type (e.g., "PICTURE_TYPE_OUTER", "PICTURE_TYPE_EXTRA")
  - **quantity:** Number of pictures required

**next_pagination_token:** Token for next page
**has_more:** Boolean indicating if more results exist

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Get Catalog Item

**Endpoint:** `GET /api/v1/catalog/{id}`

**Description:**
Get the attributes for a single catalog item with the provided catalog ID. Returns a 404 error code if the catalog ID cannot be found.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| id | string | path | Yes | The unique ID that identifies the product in the catalog. Can be obtained from the SearchCatalog endpoint |

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "catalog_item": {
    "catalog_id": "air-jordan-5-retro-grape-2025-hq7978-100",
    "name": "Air Jordan 5 Retro 'Grape' 2025",
    "sku": "HQ7978 100",
    "brand": "Air Jordan",
    "gender": "men",
    "release_date": "2025-06-21",
    "product_category_v2": "shoes",
    "product_type": "sneakers",
    "size_unit": "SIZE_UNIT_US",
    "allowed_sizes": [
      {
        "display_name": "7",
        "value": 7,
        "us_size_equivalent": 7
      },
      {
        "display_name": "7.5",
        "value": 7.5,
        "us_size_equivalent": 7.5
      }
    ],
    "minimum_listing_price_cents": 2500,
    "maximum_listing_price_cents": 200000,
    "main_picture_url": "https://image.goat.com/glow-4-5-25/750/attachments/product_template_pictures/images/111/347/682/original/1556310_00.png.png",
    "retail_price_cents": 21000,
    "colorway": "White/New Emerald/Grape Ice/Black",
    "nickname": "Grape",
    "requires_listing_pictures": false,
    "resellable": true,
    "requested_pictures": [
      {
        "type": "PICTURE_TYPE_OUTER",
        "quantity": 1
      },
      {
        "type": "PICTURE_TYPE_EXTRA",
        "quantity": 3
      }
    ]
  }
}
```

**Response Fields:**

Same structure as **catalog_items[]** in Search Catalog endpoint.

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### List Pricing Insights

**Endpoint:** `GET /api/v1/pricing_insights/availabilities/{catalog_id}`

**Description:**
Gets comprehensive marketplace data for the provided catalog ID, across all sizes and conditions. Unlike GetAvailability which returns data for a specific variation, this endpoint returns pricing information for all available variations of an item. The response includes multiple variants organized by size, condition, and packaging, with each variant containing its own availability data. Useful for comparing pricing across different product variations.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| catalog_id | string | path | Yes | The unique ID that identifies the item in the catalog. Can be obtained from the SearchCatalog endpoint |
| region_id | string | query | No | The region given. Empty values represent all regions (global) |
| consigned | boolean | query | No | Whether the item is consigned or not. When not provided, pricing insights include both consigned and unconsigned items |

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "variants": [
    {
      "size": 0,
      "product_condition": "PRODUCT_CONDITION_INVALID",
      "packaging_condition": "PACKAGING_CONDITION_INVALID",
      "consigned": true,
      "availability": {
        "lowest_listing_price_cents": "string",
        "highest_offer_price_cents": "string",
        "last_sold_listing_price_cents": "string",
        "global_indicator_price_cents": "string"
      }
    }
  ]
}
```

**Response Fields:**

**variants[]:**
- **size:** Size value (numeric)
- **product_condition:** Product condition status
- **packaging_condition:** Packaging condition status
- **consigned:** Boolean indicating if the item is consigned
- **availability:** Availability data object
  - **lowest_listing_price_cents:** Lowest current listing price in cents
  - **highest_offer_price_cents:** Highest current offer price in cents
  - **last_sold_listing_price_cents:** Last sold price in cents
  - **global_indicator_price_cents:** Global indicator price in cents

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Get Pricing Insights

**Endpoint:** `GET /api/v1/pricing_insights/availability`

**Description:**
Gets current marketplace pricing data for the provided catalog ID, including lowest listing price, highest offer price, last sold price, and global indicator price. Use this endpoint to gauge the market going rate for a specific product variation and make informed pricing decisions. The global indicator price represents a competitive price point that accounts for regional differences and market dynamics.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| catalog_id | string | query | Yes | The unique ID that identifies the item in the catalog. Can be obtained from the SearchCatalog endpoint |
| size | number($double) | query | Yes | The US size. Refer to the size key for all supported sizes and their non-US equivalents |
| product_condition | string | query | Yes | The requested product condition |
| packaging_condition | string | query | Yes | The requested packaging condition |
| consigned | boolean | query | No | Whether the item is consigned or not. When not provided, pricing insights include both consigned and unconsigned items |
| region_id | string | query | No | The region given. Not providing this parameter will return values across all selling regions |

**Product Condition Values:**
- `PRODUCT_CONDITION_INVALID` (default)
- `PRODUCT_CONDITION_NEW`: Item is brand new with no defects
- `PRODUCT_CONDITION_USED`: Item has been previously used or worn
- `PRODUCT_CONDITION_NEW_WITH_DEFECTS`: Item is unused but contains a factory defect or imperfection

**Packaging Condition Values:**
- `PACKAGING_CONDITION_INVALID` (default)
- `PACKAGING_CONDITION_GOOD_CONDITION`: Original packaging in excellent condition with minimal wear
- `PACKAGING_CONDITION_MISSING_LID`: Original packaging with lid missing from the box
- `PACKAGING_CONDITION_BADLY_DAMAGED`: Original packaging with significant damage or defects
- `PACKAGING_CONDITION_NO_ORIGINAL_BOX`: Item does not include its original packaging

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "availability": {
    "lowest_listing_price_cents": "string",
    "highest_offer_price_cents": "string",
    "last_sold_listing_price_cents": "string",
    "global_indicator_price_cents": "string"
  }
}
```

**Response Fields:**

**availability:**
- **lowest_listing_price_cents:** Lowest current listing price in cents
- **highest_offer_price_cents:** Highest current offer price in cents
- **last_sold_listing_price_cents:** Last sold price in cents
- **global_indicator_price_cents:** Global indicator price in cents (competitive price point accounting for regional differences and market dynamics)

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Get Offer Price Distribution

**Endpoint:** `GET /api/v1/pricing_insights/offer_histogram`

**Description:**
Gets the offer spread for a given catalog ID, filterable by the provided parameters. The response contains histogram bins that represent price points and the count of offers at each price point, sorted from highest to lowest price. Bins are dynamically generated based on current market data. Use this endpoint to determine the depth and breadth of the spread of offers for a given item.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| catalog_id | string | query | Yes | The unique ID that identifies the item in the catalog. Can be obtained from the SearchCatalog endpoint |
| size | number($double) | query | Yes | The US size. Refer to the size key for all supported sizes and their non-US equivalents |
| product_condition | string | query | Yes | The requested product condition |
| packaging_condition | string | query | Yes | The requested packaging condition |
| region_id | string | query | No | The region given. Not providing this parameter will return values for all regions (global) |

**Product Condition Values:**
- `PRODUCT_CONDITION_INVALID` (default)
- `PRODUCT_CONDITION_NEW`: Item is brand new with no defects
- `PRODUCT_CONDITION_USED`: Item has been previously used or worn
- `PRODUCT_CONDITION_NEW_WITH_DEFECTS`: Item is unused but contains a factory defect or imperfection

**Packaging Condition Values:**
- `PACKAGING_CONDITION_INVALID` (default)
- `PACKAGING_CONDITION_GOOD_CONDITION`: Original packaging in excellent condition with minimal wear
- `PACKAGING_CONDITION_MISSING_LID`: Original packaging with lid missing from the box
- `PACKAGING_CONDITION_BADLY_DAMAGED`: Original packaging with significant damage or defects
- `PACKAGING_CONDITION_NO_ORIGINAL_BOX`: Item does not include its original packaging

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "offer_histogram": {
    "bins": [
      {
        "offer_price_cents": "string",
        "count": "string"
      }
    ]
  }
}
```

**Response Fields:**

**offer_histogram:**
- **bins[]:** Array of histogram bins (sorted from highest to lowest price)
  - **offer_price_cents:** Price point in cents
  - **count:** Number of offers at this price point

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### View Sales History

**Endpoint:** `GET /api/v1/pricing_insights/recent_sales`

**Description:**
Lists the recent sales of a given catalog ID. Results are ordered chronologically with the most recent sales first. Use this endpoint to determine historical pricing trends.

**Access Patterns:**

Supports two access patterns:
1. **Catalog Item Sales:** Filter by catalog_id (required), region_id (optional), and consigned (must be non-null). Use this pattern to analyze overall sales trends for a catalog item.
2. **Single Variant Sales:** Filter by catalog_id (required), size (required), product_condition (required), packaging_condition (required), consigned (optional), and region_id (optional). Use this pattern for detailed analysis of sales trends on a specific variant.

**Limits:**
- Default limit: 10 results
- Maximum limit: 200 results (only when using pattern #2 with all filters)
- These limits are subject to change

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| catalog_id | string | query | Yes | The unique ID that identifies the item in the catalog. Can be obtained from the SearchCatalog endpoint |
| size | number($double) | query | No | The US size. If not provided, returns sales across all sizes |
| limit | string($int64) | query | No | Maximum number of sold products to return. Defaults to 10. Max 200 when all filter parameters are provided, otherwise limited to 10 |
| product_condition | string | query | No | The condition of the sold product |
| packaging_condition | string | query | No | The packaging of the sold product |
| consigned | boolean | query | No | Whether the product was sold as consigned |
| region_id | string | query | No | The region in which the products were sold. Defaults to global if none specified |

**Product Condition Values:**
- `PRODUCT_CONDITION_INVALID` (default)
- `PRODUCT_CONDITION_NEW`: Item is brand new with no defects
- `PRODUCT_CONDITION_USED`: Item has been previously used or worn
- `PRODUCT_CONDITION_NEW_WITH_DEFECTS`: Item is unused but contains a factory defect or imperfection

**Packaging Condition Values:**
- `PACKAGING_CONDITION_INVALID` (default)
- `PACKAGING_CONDITION_GOOD_CONDITION`: Original packaging in excellent condition with minimal wear
- `PACKAGING_CONDITION_MISSING_LID`: Original packaging with lid missing from the box
- `PACKAGING_CONDITION_BADLY_DAMAGED`: Original packaging with significant damage or defects
- `PACKAGING_CONDITION_NO_ORIGINAL_BOX`: Item does not include its original packaging

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "recent_sales": [
    {
      "purchased_at": "2025-11-25T08:44:15.640Z",
      "price_cents": "string",
      "size": 0,
      "consigned": true,
      "catalog_id": "string"
    }
  ]
}
```

**Response Fields:**

**recent_sales[]:** Array of recent sales (ordered chronologically, most recent first)
- **purchased_at:** Timestamp when the item was purchased (ISO 8601 format)
- **price_cents:** Sale price in cents
- **size:** Size of the sold item (numeric)
- **consigned:** Boolean indicating if the item was sold as consigned
- **catalog_id:** Catalog ID of the sold item

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Search Listings

**Endpoint:** `GET /api/v1/listings`

**Description:**
Search listings by criteria. Supports faceted search, numeric filters, sorting, and pagination.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| search_term | string | query | No | Search by catalog SKU, name, or ID. Example: 'Air Jordan 1' or 'DZ5485-612' |
| facet_filters | array[string] | query | No | Filters for faceted search. Supported formats: Status ("status: active"), Consignment ("consigned: true"), Metadata ("metadata: key = value") |
| numeric_filters | array[string] | query | No | Numeric range and equality filters. Supported formats: Price ("price_cents >= 1000"), Size ("size = 7.5") |
| page_size | string($int64) | query | No | Maximum number of values returned. Default: 25, Maximum: 50 |
| pagination_token | string | query | No | Token for next page. If not provided, returns first page |
| order.sort_by | string | query | No | Sort field for listings |
| order.order_by | string | query | No | Sort order (ascending or descending) |

**Facet Filter Examples:**
- JSON: `["status: active", "consigned: true"]`
- Query params: `?facet_filters=status:active&facet_filters=consigned:false`
- Metadata: `?facet_filters=metadata:ext_tag=123`

**Numeric Filter Examples:**
- JSON: `["price_cents >= 1000"]`
- Query params: `?numeric_filters=price_cents<10000&numeric_filters=size=7.5`

**Sort By Values:**
- `SEARCH_LISTING_REQUEST_ORDER_SORT_BY_INVALID` (default)
- `SEARCH_LISTING_REQUEST_ORDER_SORT_BY_SIZE`: Sort by product size
- `SEARCH_LISTING_REQUEST_ORDER_SORT_BY_PRICE`: Sort by price
- `SEARCH_LISTING_REQUEST_ORDER_SORT_BY_UPDATED_AT`: Sort by last update time
- `SEARCH_LISTING_REQUEST_ORDER_SORT_BY_CREATED_AT`: Sort by creation time

**Order By Values:**
- `SEARCH_LISTING_REQUEST_ORDER_ORDER_BY_INVALID` (default)
- `SEARCH_LISTING_REQUEST_ORDER_ORDER_BY_ASC`: Ascending order
- `SEARCH_LISTING_REQUEST_ORDER_ORDER_BY_DESC`: Descending order

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "listings": [
    {
      "id": "string",
      "catalog_id": "string",
      "condition": "CONDITION_INVALID",
      "packaging_condition": "PACKAGING_CONDITION_INVALID",
      "size": 0,
      "size_unit": "SIZE_UNIT_INVALID",
      "sku": "string",
      "consigned": true,
      "created_at": "2025-11-25T08:44:15.642Z",
      "updated_at": "2025-11-25T08:44:15.642Z",
      "status": "LISTING_STATUS_INVALID",
      "price_cents": "string",
      "activated_at": "2025-11-25T08:44:15.642Z",
      "metadata": {},
      "defects": [
        "LISTING_DEFECT_INVALID"
      ],
      "additional_defects": "string"
    }
  ],
  "pagination": {
    "pagination_token": "string",
    "has_more": true,
    "total_count": "string"
  }
}
```

**Response Fields:**

**listings[]:**
- **id:** Listing ID
- **catalog_id:** Catalog ID of the listed item
- **condition:** Product condition enum
- **packaging_condition:** Packaging condition enum
- **size:** Size value (numeric)
- **size_unit:** Size unit system
- **sku:** Stock Keeping Unit
- **consigned:** Boolean indicating if item is consigned
- **created_at:** Creation timestamp (ISO 8601)
- **updated_at:** Last update timestamp (ISO 8601)
- **status:** Listing status enum
- **price_cents:** Listing price in cents
- **activated_at:** Activation timestamp (ISO 8601)
- **metadata:** Key-value metadata object
- **defects[]:** Array of defect enums
- **additional_defects:** Additional defects description

**pagination:**
- **pagination_token:** Token for next page
- **has_more:** Boolean indicating if more results exist
- **total_count:** Total count of results

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Create Listing

**Endpoint:** `POST /api/v1/listings`

**Description:**
Create a single listing.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| catalog_id | string | query | Yes | The catalog item ID that listing is associated to |
| price_cents | string($int64) | query | Yes | The price in USD cents. Price must be in whole dollar increments |
| condition | string | query | Yes | The condition of the listing |
| packaging_condition | string | query | Yes | The packaging condition of the product |
| size | number($float) | query | Yes | The size value of the listing. Refer to the size key for all supported sizes |
| size_unit | string | query | Yes | The size unit of the listing |
| activate | boolean | query | No | When true, activates listing immediately. When false or empty, listing remains pending. For picture-required listings, all mandatory pictures must be uploaded before activation |
| metadata | object | query | No | Metadata to associate to the listing, for identification and searching |
| defects | array[string] | query | No | Enumerated defects of the listing |
| additional_defects | string | query | No | Additional text description of defects. Should be limited to specific conditional issues |

**Condition Values:**
- `CONDITION_INVALID` (default)
- `CONDITION_NEW`: Item is brand new with no defects
- `CONDITION_USED`: Item has been previously used or worn
- `CONDITION_NEW_WITH_DEFECTS`: Item is unused but contains a factory defect or imperfection

**Packaging Condition Values:**
- `PACKAGING_CONDITION_INVALID` (default)
- `PACKAGING_CONDITION_GOOD_CONDITION`: Original packaging in excellent condition with minimal wear
- `PACKAGING_CONDITION_MISSING_LID`: Original packaging with lid missing from the box
- `PACKAGING_CONDITION_BADLY_DAMAGED`: Original packaging with significant damage or defects
- `PACKAGING_CONDITION_NO_ORIGINAL_BOX`: Item does not include its original packaging

**Size Unit Values:**
- `SIZE_UNIT_INVALID` (default)
- `SIZE_UNIT_US`: United States sizing standard
- `SIZE_UNIT_UK`: United Kingdom sizing standard
- `SIZE_UNIT_IT`: Italian sizing standard
- `SIZE_UNIT_FR`: French sizing standard
- `SIZE_UNIT_EU`: European sizing standard
- `SIZE_UNIT_JP`: Japanese sizing standard

**Defect Values:**
- `LISTING_DEFECT_INVALID`
- `LISTING_DEFECT_HAS_ODOR`: Product has noticeable odor
- `LISTING_DEFECT_HAS_DISCOLORATION`: Product has visible discoloration
- `LISTING_DEFECT_HAS_MISSING_INSOLES`: Product has missing insoles
- `LISTING_DEFECT_HAS_SCUFFS`: Product has scuffs
- `LISTING_DEFECT_HAS_TEARS`: Product has tears
- `LISTING_DEFECT_B_GRADE`: Product is B-grade

**Important Notes:**
- Price must be in whole dollar increments
- For picture-required listings, all mandatory pictures must be uploaded before activation
- If a picture-required listing fails to activate due to missing pictures, it will be set to inactive status

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "listing": {
    "id": "listing_1234567890",
    "catalog_id": "air-jordan-5-retro-grape-2025-hq7978-100",
    "price_cents": 25000,
    "condition": "CONDITION_NEW",
    "packaging_condition": "PACKAGING_CONDITION_GOOD_CONDITION",
    "size": 7.5,
    "size_unit": "SIZE_UNIT_US",
    "status": "LISTING_STATUS_ACTIVE",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

**Response Fields:**

**listing:**
- **id:** Listing ID
- **catalog_id:** Catalog ID of the listed item
- **price_cents:** Listing price in cents
- **condition:** Product condition enum
- **packaging_condition:** Packaging condition enum
- **size:** Size value (numeric)
- **size_unit:** Size unit system
- **status:** Listing status enum
- **created_at:** Creation timestamp (ISO 8601)
- **updated_at:** Last update timestamp (ISO 8601)

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Get Listing

**Endpoint:** `GET /api/v1/listings/{id}`

**Description:**
Get a single listing.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| id | string | path | Yes | The unique ID of the listing to get |

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "listing": {
    "id": "string",
    "catalog_id": "string",
    "condition": "CONDITION_INVALID",
    "packaging_condition": "PACKAGING_CONDITION_INVALID",
    "size": 0,
    "size_unit": "SIZE_UNIT_INVALID",
    "sku": "string",
    "consigned": true,
    "created_at": "2025-11-25T08:44:15.645Z",
    "updated_at": "2025-11-25T08:44:15.645Z",
    "status": "LISTING_STATUS_INVALID",
    "price_cents": "string",
    "activated_at": "2025-11-25T08:44:15.645Z",
    "metadata": {},
    "defects": [
      "LISTING_DEFECT_INVALID"
    ],
    "additional_defects": "string"
  }
}
```

**Response Fields:**

**listing:**
- **id:** Listing ID
- **catalog_id:** Catalog ID of the listed item
- **condition:** Product condition enum
- **packaging_condition:** Packaging condition enum
- **size:** Size value (numeric)
- **size_unit:** Size unit system
- **sku:** Stock Keeping Unit
- **consigned:** Boolean indicating if item is consigned
- **created_at:** Creation timestamp (ISO 8601)
- **updated_at:** Last update timestamp (ISO 8601)
- **status:** Listing status enum
- **price_cents:** Listing price in cents
- **activated_at:** Activation timestamp (ISO 8601)
- **metadata:** Key-value metadata object
- **defects[]:** Array of defect enums
- **additional_defects:** Additional defects description

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Update Listing

**Endpoint:** `POST /api/v1/listings/{id}`

**Description:**
Update a single listing.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| id | string | path | Yes | The unique ID of the listing to update |
| catalog_id | string | query | No | The catalog item ID to update |
| price_cents | string($int64) | query | No | Price in USD cents (whole dollar increments required) |
| size | number($float) | query | No | Size value to update |
| size_unit | string | query | No | Size unit (SIZE_UNIT_US, SIZE_UNIT_UK, SIZE_UNIT_IT, SIZE_UNIT_FR, SIZE_UNIT_EU, SIZE_UNIT_JP, SIZE_UNIT_INVALID) |

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "listing": {
    "id": "string",
    "catalog_id": "string",
    "condition": "CONDITION_INVALID",
    "packaging_condition": "PACKAGING_CONDITION_INVALID",
    "size": 0,
    "size_unit": "SIZE_UNIT_INVALID",
    "sku": "string",
    "consigned": true,
    "created_at": "2025-11-25T08:44:15.645Z",
    "updated_at": "2025-11-25T08:44:15.645Z",
    "status": "LISTING_STATUS_INVALID",
    "price_cents": "string",
    "activated_at": "2025-11-25T08:44:15.645Z",
    "metadata": {},
    "defects": [
      "LISTING_DEFECT_INVALID"
    ],
    "additional_defects": "string"
  }
}
```

**Response Fields:**

**listing:**
- **id:** Listing ID
- **catalog_id:** Catalog ID of the listed item
- **condition:** Product condition enum
- **packaging_condition:** Packaging condition enum
- **size:** Size value (numeric)
- **size_unit:** Size unit system
- **sku:** Stock Keeping Unit
- **consigned:** Boolean indicating if item is consigned
- **created_at:** Creation timestamp (ISO 8601)
- **updated_at:** Last update timestamp (ISO 8601)
- **status:** Listing status enum
- **price_cents:** Listing price in cents
- **activated_at:** Activation timestamp (ISO 8601)
- **metadata:** Key-value metadata object
- **defects[]:** Array of defect enums
- **additional_defects:** Additional defects description

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Activate Listing

**Endpoint:** `POST /api/v1/listings/{id}/activate`

**Description:**
Activate a created listing. Note: if the listing requires pictures, all required pictures must be uploaded for activation to succeed.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| id | string | path | Yes | The unique ID of the listing to activate |

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "listing": {
    "id": "string",
    "catalog_id": "string",
    "condition": "CONDITION_INVALID",
    "packaging_condition": "PACKAGING_CONDITION_INVALID",
    "size": 0,
    "size_unit": "SIZE_UNIT_INVALID",
    "sku": "string",
    "consigned": true,
    "created_at": "2025-11-25T08:44:15.647Z",
    "updated_at": "2025-11-25T08:44:15.647Z",
    "status": "LISTING_STATUS_INVALID",
    "price_cents": "string",
    "activated_at": "2025-11-25T08:44:15.647Z",
    "metadata": {},
    "defects": [
      "LISTING_DEFECT_INVALID"
    ],
    "additional_defects": "string"
  }
}
```

**Response Fields:**

**listing:**
- **id:** Listing ID
- **catalog_id:** Catalog ID of the listed item
- **condition:** Product condition enum
- **packaging_condition:** Packaging condition enum
- **size:** Size value (numeric)
- **size_unit:** Size unit system
- **sku:** Stock Keeping Unit
- **consigned:** Boolean indicating if item is consigned
- **created_at:** Creation timestamp (ISO 8601)
- **updated_at:** Last update timestamp (ISO 8601)
- **status:** Listing status enum
- **price_cents:** Listing price in cents
- **activated_at:** Activation timestamp (ISO 8601)
- **metadata:** Key-value metadata object
- **defects[]:** Array of defect enums
- **additional_defects:** Additional defects description

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Deactivate Listing

**Endpoint:** `POST /api/v1/listings/{id}/deactivate`

**Description:**
Deactivate a created listing.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| id | string | path | Yes | The unique ID of the listing to deactivate |

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "listing": {
    "id": "string",
    "catalog_id": "string",
    "condition": "CONDITION_INVALID",
    "packaging_condition": "PACKAGING_CONDITION_INVALID",
    "size": 0,
    "size_unit": "SIZE_UNIT_INVALID",
    "sku": "string",
    "consigned": true,
    "created_at": "2025-11-25T08:44:15.647Z",
    "updated_at": "2025-11-25T08:44:15.647Z",
    "status": "LISTING_STATUS_INVALID",
    "price_cents": "string",
    "activated_at": "2025-11-25T08:44:15.647Z",
    "metadata": {},
    "defects": [
      "LISTING_DEFECT_INVALID"
    ],
    "additional_defects": "string"
  }
}
```

**Response Fields:**

**listing:**
- **id:** Listing ID
- **catalog_id:** Catalog ID of the listed item
- **condition:** Product condition enum
- **packaging_condition:** Packaging condition enum
- **size:** Size value (numeric)
- **size_unit:** Size unit system
- **sku:** Stock Keeping Unit
- **consigned:** Boolean indicating if item is consigned
- **created_at:** Creation timestamp (ISO 8601)
- **updated_at:** Last update timestamp (ISO 8601)
- **status:** Listing status enum
- **price_cents:** Listing price in cents
- **activated_at:** Activation timestamp (ISO 8601)
- **metadata:** Key-value metadata object
- **defects[]:** Array of defect enums
- **additional_defects:** Additional defects description

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Delete Listing

**Endpoint:** `DELETE /api/v1/listings/{id}`

**Description:**
Delete a listing.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| id | string | path | Yes | The unique ID of the listing to delete |

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "id": "string"
}
```

**Response Fields:**

- **id:** ID of the deleted listing

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Add Listing Metadata

**Endpoint:** `POST /api/v1/listings/{listing_id}/metadata`

**Description:**
Create metadata for a listing.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| listing_id | string | path | Yes | The listing identifier |
| metadata | object | query | Yes | The metadata to add to the associated listing |

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "listing": {
    "id": "string",
    "catalog_id": "string",
    "condition": "CONDITION_INVALID",
    "packaging_condition": "PACKAGING_CONDITION_INVALID",
    "size": 0,
    "size_unit": "SIZE_UNIT_INVALID",
    "sku": "string",
    "consigned": true,
    "created_at": "2025-11-25T08:44:15.648Z",
    "updated_at": "2025-11-25T08:44:15.648Z",
    "status": "LISTING_STATUS_INVALID",
    "price_cents": "string",
    "activated_at": "2025-11-25T08:44:15.648Z",
    "metadata": {},
    "defects": [
      "LISTING_DEFECT_INVALID"
    ],
    "additional_defects": "string"
  }
}
```

**Response Fields:**

**listing:**
- **id:** Listing ID
- **catalog_id:** Catalog ID of the listed item
- **condition:** Product condition enum
- **packaging_condition:** Packaging condition enum
- **size:** Size value (numeric)
- **size_unit:** Size unit system
- **sku:** Stock Keeping Unit
- **consigned:** Boolean indicating if item is consigned
- **created_at:** Creation timestamp (ISO 8601)
- **updated_at:** Last update timestamp (ISO 8601)
- **status:** Listing status enum
- **price_cents:** Listing price in cents
- **activated_at:** Activation timestamp (ISO 8601)
- **metadata:** Key-value metadata object
- **defects[]:** Array of defect enums
- **additional_defects:** Additional defects description

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Remove Listing Metadata

**Endpoint:** `POST /api/v1/listings/{listing_id}/metadata_delete`

**Description:**
Deletes metadata for a listing.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| listing_id | string | path | Yes | The listing identifier |
| keys | array[string] | query | Yes | The metadata keys to remove from the associated listing |

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "listing": {
    "id": "string",
    "catalog_id": "string",
    "condition": "CONDITION_INVALID",
    "packaging_condition": "PACKAGING_CONDITION_INVALID",
    "size": 0,
    "size_unit": "SIZE_UNIT_INVALID",
    "sku": "string",
    "consigned": true,
    "created_at": "2025-11-25T08:44:15.650Z",
    "updated_at": "2025-11-25T08:44:15.650Z",
    "status": "LISTING_STATUS_INVALID",
    "price_cents": "string",
    "activated_at": "2025-11-25T08:44:15.650Z",
    "metadata": {},
    "defects": [
      "LISTING_DEFECT_INVALID"
    ],
    "additional_defects": "string"
  }
}
```

**Response Fields:**

**listing:**
- **id:** Listing ID
- **catalog_id:** Catalog ID of the listed item
- **condition:** Product condition enum
- **packaging_condition:** Packaging condition enum
- **size:** Size value (numeric)
- **size_unit:** Size unit system
- **sku:** Stock Keeping Unit
- **consigned:** Boolean indicating if item is consigned
- **created_at:** Creation timestamp (ISO 8601)
- **updated_at:** Last update timestamp (ISO 8601)
- **status:** Listing status enum
- **price_cents:** Listing price in cents
- **activated_at:** Activation timestamp (ISO 8601)
- **metadata:** Key-value metadata object
- **defects[]:** Array of defect enums
- **additional_defects:** Additional defects description

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Search Orders

**Endpoint:** `GET /api/v1/orders`

**Description:**
Queries orders.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| query | string | query | No | The full text query of the search. Example: 'Air Jordan' to search for Air Jordan products |
| facet_filters | array[string] | query | No | Filters for faceted search. Supports 'status' and 'fulfillment_status' facets, but only one facet type per request |
| page_size | string($int64) | query | No | The maximum number of values returned in the search. Default: 25, Maximum: 50 |
| pagination_token | string | query | No | Pass the next pagination token received from a subsequent request. If not provided, the default will be the first page in the set |

**Facet Filter Formats:**
- **Status:** `"status:ORDER_STATUS_CONFIRMED"`
- **Fulfillment Status:** `"fulfillment_status:FULFILLMENT_STATUS_DELIVERED"`

**Facet Filter Examples:**
- JSON: `["status:ORDER_STATUS_IN_TRANSIT"]`
- Query params: `?facet_filters=status:ORDER_STATUS_COMPLETED`
- Query params: `?facet_filters=fulfillment_status:FULFILLMENT_STATUS_DELIVERED`

**Important:** Only one facet type per request is supported.

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "results": [
    {
      "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
      "status": "ORDER_STATUS_CONFIRMED",
      "catalog_id": "air-jordan-5-retro-grape-2025-hq7978-100",
      "catalog_name": "Air Jordan 5 Retro 'Grape' 2025",
      "catalog_brand": "Air Jordan",
      "catalog_sku": "HQ7978 100",
      "size": 10.5,
      "price_cents": 22000,
      "price_cents_after_take": 20000,
      "sales_channel": "GOAT",
      "purchase_order_number": "PO-123456",
      "listing_id": "l-xyz-789",
      "label_type": "LABEL_TYPE_SHIPPING",
      "label_url": "https://example.com/labels/1a2b3c4d.pdf",
      "label_tracking_number": "1Z999AA10123456789",
      "label_courier": "UPS",
      "sold_at": "2025-07-28T10:30:00Z",
      "label_generated_at": "2025-07-28T14:00:00Z",
      "in_transit_at": "2025-07-29T09:00:00Z",
      "updated_at": "2025-07-29T09:00:00Z",
      "cancels_at": "2025-08-04T10:30:00Z",
      "customs_declaration": {
        "commercial_invoice_url": "https://example.com/invoices/1a2b3c4d.pdf",
        "declared_customs_value_cents": 22000
      }
    }
  ],
  "pagination": {
    "next_page_token": "some_token"
  }
}
```

**Response Fields:**

**results[]:**
- **id:** Order ID
- **status:** Order status enum
- **fulfillment_status:** Fulfillment status enum (optional)
- **catalog_id:** Catalog ID of the ordered item
- **catalog_name:** Name of the ordered item
- **catalog_brand:** Brand of the ordered item
- **catalog_sku:** SKU of the ordered item
- **size:** Size of the ordered item (numeric)
- **price_cents:** Order price in cents
- **price_cents_after_take:** Price after platform take in cents
- **sales_channel:** Sales channel (e.g., "GOAT", "Alias")
- **purchase_order_number:** Purchase order number
- **listing_id:** Associated listing ID
- **label_type:** Label type enum (e.g., LABEL_TYPE_SHIPPING, LABEL_TYPE_DROPOFF)
- **label_url:** URL to shipping label PDF
- **label_tracking_number:** Tracking number for shipment
- **label_courier:** Courier service (e.g., "UPS", "FedEx")
- **sold_at:** Timestamp when order was sold (ISO 8601)
- **label_generated_at:** Timestamp when label was generated (ISO 8601)
- **in_transit_at:** Timestamp when order went in transit (ISO 8601)
- **updated_at:** Last update timestamp (ISO 8601)
- **cancels_at:** Timestamp when order will be canceled if not fulfilled (ISO 8601)
- **customs_declaration:** Customs declaration object (optional)
  - **commercial_invoice_url:** URL to commercial invoice PDF
  - **declared_customs_value_cents:** Declared customs value in cents

**pagination:**
- **next_page_token:** Token for next page

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Get Order Details

**Endpoint:** `GET /api/v1/orders/{id}`

**Description:**
Get an individual order by ID.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| id | string | path | Yes | The ID of the order to retrieve |

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "order": {
    "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "status": "ORDER_STATUS_IN_TRANSIT",
    "fulfillment_status": "FULFILLMENT_STATUS_IN_TRANSIT",
    "catalog_id": "air-jordan-5-retro-grape-2025-hq7978-100",
    "catalog_name": "Air Jordan 5 Retro 'Grape' 2025",
    "catalog_brand": "Air Jordan",
    "catalog_sku": "HQ7978 100",
    "size": 10.5,
    "price_cents": 22000,
    "price_cents_after_take": 20000,
    "sales_channel": "GOAT",
    "purchase_order_number": "PO-123456",
    "listing_id": "l-xyz-789",
    "label_type": "LABEL_TYPE_SHIPPING",
    "label_url": "https://example.com/labels/1a2b3c4d.pdf",
    "label_tracking_number": "1Z999AA10123456789",
    "label_courier": "UPS",
    "sold_at": "2025-07-28T10:30:00Z",
    "label_generated_at": "2025-07-28T14:00:00Z",
    "in_transit_at": "2025-07-29T09:00:00Z",
    "updated_at": "2025-07-29T09:00:00Z",
    "cancels_at": "2025-08-04T10:30:00Z",
    "customs_declaration": {
      "commercial_invoice_url": "https://example.com/invoices/1a2b3c4d.pdf",
      "declared_customs_value_cents": 22000
    }
  }
}
```

**Response Fields:**

**order:**
- **id:** Order ID
- **status:** Order status enum
- **fulfillment_status:** Fulfillment status enum (optional)
- **catalog_id:** Catalog ID of the ordered item
- **catalog_name:** Name of the ordered item
- **catalog_brand:** Brand of the ordered item
- **catalog_sku:** SKU of the ordered item
- **size:** Size of the ordered item (numeric)
- **price_cents:** Order price in cents
- **price_cents_after_take:** Price after platform take in cents
- **sales_channel:** Sales channel (e.g., "GOAT", "Alias")
- **purchase_order_number:** Purchase order number
- **listing_id:** Associated listing ID
- **label_type:** Label type enum (e.g., LABEL_TYPE_SHIPPING, LABEL_TYPE_DROPOFF)
- **label_url:** URL to shipping label PDF
- **label_tracking_number:** Tracking number for shipment
- **label_courier:** Courier service (e.g., "UPS", "FedEx")
- **sold_at:** Timestamp when order was sold (ISO 8601)
- **label_generated_at:** Timestamp when label was generated (ISO 8601)
- **in_transit_at:** Timestamp when order went in transit (ISO 8601)
- **updated_at:** Last update timestamp (ISO 8601)
- **cancels_at:** Timestamp when order will be canceled if not fulfilled (ISO 8601)
- **customs_declaration:** Customs declaration object (optional)
  - **commercial_invoice_url:** URL to commercial invoice PDF
  - **declared_customs_value_cents:** Declared customs value in cents

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Cancel Order

**Endpoint:** `POST /api/v1/orders/{id}/cancel`

**Description:**
Cancel an individual order.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| id | string | path | Yes | The ID of the order to cancel |

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "order": {
    "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "status": "ORDER_STATUS_CANCELED",
    "catalog_id": "air-jordan-5-retro-grape-2025-hq7978-100",
    "catalog_name": "Air Jordan 5 Retro 'Grape' 2025",
    "catalog_brand": "Air Jordan",
    "catalog_sku": "HQ7978 100",
    "size": 10.5,
    "price_cents": 22000,
    "price_cents_after_take": 20000,
    "sales_channel": "GOAT",
    "purchase_order_number": "PO-123456",
    "listing_id": "l-xyz-789",
    "label_type": "LABEL_TYPE_SHIPPING",
    "label_url": "https://example.com/labels/1a2b3c4d.pdf",
    "label_tracking_number": "1Z999AA10123456789",
    "label_courier": "UPS",
    "sold_at": "2025-07-28T10:30:00Z",
    "label_generated_at": "2025-07-28T14:00:00Z",
    "in_transit_at": "2025-07-29T09:00:00Z",
    "updated_at": "2025-07-29T09:00:00Z",
    "cancels_at": "2025-08-04T10:30:00Z",
    "customs_declaration": {
      "commercial_invoice_url": "https://example.com/invoices/1a2b3c4d.pdf",
      "declared_customs_value_cents": 22000
    }
  }
}
```

**Response Fields:**

**order:**
- **id:** Order ID
- **status:** Order status enum (will be ORDER_STATUS_CANCELED after cancellation)
- **fulfillment_status:** Fulfillment status enum (optional)
- **catalog_id:** Catalog ID of the ordered item
- **catalog_name:** Name of the ordered item
- **catalog_brand:** Brand of the ordered item
- **catalog_sku:** SKU of the ordered item
- **size:** Size of the ordered item (numeric)
- **price_cents:** Order price in cents
- **price_cents_after_take:** Price after platform take in cents
- **sales_channel:** Sales channel (e.g., "GOAT", "Alias")
- **purchase_order_number:** Purchase order number
- **listing_id:** Associated listing ID
- **label_type:** Label type enum (e.g., LABEL_TYPE_SHIPPING, LABEL_TYPE_DROPOFF)
- **label_url:** URL to shipping label PDF
- **label_tracking_number:** Tracking number for shipment
- **label_courier:** Courier service (e.g., "UPS", "FedEx")
- **sold_at:** Timestamp when order was sold (ISO 8601)
- **label_generated_at:** Timestamp when label was generated (ISO 8601)
- **in_transit_at:** Timestamp when order went in transit (ISO 8601)
- **updated_at:** Last update timestamp (ISO 8601)
- **cancels_at:** Timestamp when order will be canceled if not fulfilled (ISO 8601)
- **customs_declaration:** Customs declaration object (optional)
  - **commercial_invoice_url:** URL to commercial invoice PDF
  - **declared_customs_value_cents:** Declared customs value in cents

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Confirm Order

**Endpoint:** `POST /api/v1/orders/{id}/confirm`

**Description:**
Confirm an individual order. Orders need to be confirmed or they risk being canceled.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| id | string | path | Yes | The ID of the order to confirm |

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "order": {
    "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "status": "ORDER_STATUS_CONFIRMED",
    "catalog_id": "air-jordan-5-retro-grape-2025-hq7978-100",
    "catalog_name": "Air Jordan 5 Retro 'Grape' 2025",
    "catalog_brand": "Air Jordan",
    "catalog_sku": "HQ7978 100",
    "size": 10.5,
    "price_cents": 22000,
    "price_cents_after_take": 20000,
    "sales_channel": "GOAT",
    "purchase_order_number": "PO-123456",
    "listing_id": "l-xyz-789",
    "label_type": "LABEL_TYPE_SHIPPING",
    "label_url": "https://example.com/labels/1a2b3c4d.pdf",
    "label_tracking_number": "1Z999AA10123456789",
    "label_courier": "UPS",
    "sold_at": "2025-07-28T10:30:00Z",
    "label_generated_at": "2025-07-28T14:00:00Z",
    "in_transit_at": "2025-07-29T09:00:00Z",
    "updated_at": "2025-07-29T09:00:00Z",
    "cancels_at": "2025-08-04T10:30:00Z",
    "customs_declaration": {
      "commercial_invoice_url": "https://example.com/invoices/1a2b3c4d.pdf",
      "declared_customs_value_cents": 22000
    }
  }
}
```

**Response Fields:**

**order:**
- **id:** Order ID
- **status:** Order status enum (will be ORDER_STATUS_CONFIRMED after confirmation)
- **fulfillment_status:** Fulfillment status enum (optional)
- **catalog_id:** Catalog ID of the ordered item
- **catalog_name:** Name of the ordered item
- **catalog_brand:** Brand of the ordered item
- **catalog_sku:** SKU of the ordered item
- **size:** Size of the ordered item (numeric)
- **price_cents:** Order price in cents
- **price_cents_after_take:** Price after platform take in cents
- **sales_channel:** Sales channel (e.g., "GOAT", "Alias")
- **purchase_order_number:** Purchase order number
- **listing_id:** Associated listing ID
- **label_type:** Label type enum (e.g., LABEL_TYPE_SHIPPING, LABEL_TYPE_DROPOFF)
- **label_url:** URL to shipping label PDF
- **label_tracking_number:** Tracking number for shipment
- **label_courier:** Courier service (e.g., "UPS", "FedEx")
- **sold_at:** Timestamp when order was sold (ISO 8601)
- **label_generated_at:** Timestamp when label was generated (ISO 8601)
- **in_transit_at:** Timestamp when order went in transit (ISO 8601)
- **updated_at:** Last update timestamp (ISO 8601)
- **cancels_at:** Timestamp when order will be canceled if not fulfilled (ISO 8601)
- **customs_declaration:** Customs declaration object (optional)
  - **commercial_invoice_url:** URL to commercial invoice PDF
  - **declared_customs_value_cents:** Declared customs value in cents

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Generate Shipping Label

**Endpoint:** `POST /api/v1/orders/{id}/generate_label`

**Description:**
Generate a label for an individual order.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| id | string | path | Yes | The ID of the order to generate a label for |
| label_type | string | query | No | The type of label to generate, defaults to shipping. Available values: LABEL_TYPE_INVALID, LABEL_TYPE_SHIPPING, LABEL_TYPE_DROPOFF. Default: LABEL_TYPE_INVALID |

**Label Type Values:**
- `LABEL_TYPE_INVALID` (default)
- `LABEL_TYPE_SHIPPING`: Standard shipping label for package delivery through carrier services
- `LABEL_TYPE_DROPOFF`: Label for items that need to be dropped off at a designated location

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "order": {
    "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "status": "ORDER_STATUS_LABEL_GENERATED",
    "catalog_id": "air-jordan-5-retro-grape-2025-hq7978-100",
    "catalog_name": "Air Jordan 5 Retro 'Grape' 2025",
    "catalog_brand": "Air Jordan",
    "catalog_sku": "HQ7978 100",
    "size": 10.5,
    "price_cents": 22000,
    "price_cents_after_take": 20000,
    "sales_channel": "GOAT",
    "purchase_order_number": "PO-123456",
    "listing_id": "l-xyz-789",
    "label_type": "LABEL_TYPE_SHIPPING",
    "label_url": "https://example.com/labels/1a2b3c4d.pdf",
    "label_tracking_number": "1Z999AA10123456789",
    "label_courier": "UPS",
    "sold_at": "2025-07-28T10:30:00Z",
    "label_generated_at": "2025-07-28T14:00:00Z",
    "in_transit_at": "2025-07-29T09:00:00Z",
    "updated_at": "2025-07-29T09:00:00Z",
    "cancels_at": "2025-08-04T10:30:00Z",
    "customs_declaration": {
      "commercial_invoice_url": "https://example.com/invoices/1a2b3c4d.pdf",
      "declared_customs_value_cents": 22000
    }
  }
}
```

**Response Fields:**

**order:**
- **id:** Order ID
- **status:** Order status enum (will be ORDER_STATUS_LABEL_GENERATED after label generation)
- **fulfillment_status:** Fulfillment status enum (optional)
- **catalog_id:** Catalog ID of the ordered item
- **catalog_name:** Name of the ordered item
- **catalog_brand:** Brand of the ordered item
- **catalog_sku:** SKU of the ordered item
- **size:** Size of the ordered item (numeric)
- **price_cents:** Order price in cents
- **price_cents_after_take:** Price after platform take in cents
- **sales_channel:** Sales channel (e.g., "GOAT", "Alias")
- **purchase_order_number:** Purchase order number
- **listing_id:** Associated listing ID
- **label_type:** Label type enum (e.g., LABEL_TYPE_SHIPPING, LABEL_TYPE_DROPOFF)
- **label_url:** URL to shipping label PDF
- **label_tracking_number:** Tracking number for shipment
- **label_courier:** Courier service (e.g., "UPS", "FedEx")
- **sold_at:** Timestamp when order was sold (ISO 8601)
- **label_generated_at:** Timestamp when label was generated (ISO 8601)
- **in_transit_at:** Timestamp when order went in transit (ISO 8601)
- **updated_at:** Last update timestamp (ISO 8601)
- **cancels_at:** Timestamp when order will be canceled if not fulfilled (ISO 8601)
- **customs_declaration:** Customs declaration object (optional)
  - **commercial_invoice_url:** URL to commercial invoice PDF
  - **declared_customs_value_cents:** Declared customs value in cents

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Regenerate Shipping Label

**Endpoint:** `POST /api/v1/orders/{id}/regenerate_label`

**Description:**
Regenerate a label or changes the label_type.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| id | string | path | Yes | The ID of the order to regenerate a label for |
| label_type | string | query | No | The type of label to generate, defaults to the current label type. Available values: LABEL_TYPE_INVALID, LABEL_TYPE_SHIPPING, LABEL_TYPE_DROPOFF. Default: LABEL_TYPE_INVALID |

**Label Type Values:**
- `LABEL_TYPE_INVALID` (default)
- `LABEL_TYPE_SHIPPING`: Standard shipping label for package delivery through carrier services
- `LABEL_TYPE_DROPOFF`: Label for items that need to be dropped off at a designated location

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "order": {
    "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "status": "ORDER_STATUS_LABEL_GENERATED",
    "catalog_id": "air-jordan-5-retro-grape-2025-hq7978-100",
    "catalog_name": "Air Jordan 5 Retro 'Grape' 2025",
    "catalog_brand": "Air Jordan",
    "catalog_sku": "HQ7978 100",
    "size": 10.5,
    "price_cents": 22000,
    "price_cents_after_take": 20000,
    "sales_channel": "GOAT",
    "purchase_order_number": "PO-123456",
    "listing_id": "l-xyz-789",
    "label_type": "LABEL_TYPE_SHIPPING",
    "label_url": "https://example.com/labels/1a2b3c4d.pdf",
    "label_tracking_number": "1Z999AA10123456789",
    "label_courier": "UPS",
    "sold_at": "2025-07-28T10:30:00Z",
    "label_generated_at": "2025-07-28T14:00:00Z",
    "in_transit_at": "2025-07-29T09:00:00Z",
    "updated_at": "2025-07-29T09:00:00Z",
    "cancels_at": "2025-08-04T10:30:00Z",
    "customs_declaration": {
      "commercial_invoice_url": "https://example.com/invoices/1a2b3c4d.pdf",
      "declared_customs_value_cents": 22000
    }
  }
}
```

**Response Fields:**

**order:**
- **id:** Order ID
- **status:** Order status enum (will be ORDER_STATUS_LABEL_GENERATED after label regeneration)
- **fulfillment_status:** Fulfillment status enum (optional)
- **catalog_id:** Catalog ID of the ordered item
- **catalog_name:** Name of the ordered item
- **catalog_brand:** Brand of the ordered item
- **catalog_sku:** SKU of the ordered item
- **size:** Size of the ordered item (numeric)
- **price_cents:** Order price in cents
- **price_cents_after_take:** Price after platform take in cents
- **sales_channel:** Sales channel (e.g., "GOAT", "Alias")
- **purchase_order_number:** Purchase order number
- **listing_id:** Associated listing ID
- **label_type:** Label type enum (e.g., LABEL_TYPE_SHIPPING, LABEL_TYPE_DROPOFF)
- **label_url:** URL to shipping label PDF
- **label_tracking_number:** Tracking number for shipment
- **label_courier:** Courier service (e.g., "UPS", "FedEx")
- **sold_at:** Timestamp when order was sold (ISO 8601)
- **label_generated_at:** Timestamp when label was generated (ISO 8601)
- **in_transit_at:** Timestamp when order went in transit (ISO 8601)
- **updated_at:** Last update timestamp (ISO 8601)
- **cancels_at:** Timestamp when order will be canceled if not fulfilled (ISO 8601)
- **customs_declaration:** Customs declaration object (optional)
  - **commercial_invoice_url:** URL to commercial invoice PDF
  - **declared_customs_value_cents:** Declared customs value in cents

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Mark Order Shipped

**Endpoint:** `POST /api/v1/orders/{id}/ship`

**Description:**
Denotes that an order has been shipped. This will update the order status to in_transit.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| id | string | path | Yes | The ID of the order to ship |

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "order": {
    "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "status": "ORDER_STATUS_IN_TRANSIT",
    "fulfillment_status": "FULFILLMENT_STATUS_SELLER_SHIPPED",
    "catalog_id": "air-jordan-5-retro-grape-2025-hq7978-100",
    "catalog_name": "Air Jordan 5 Retro 'Grape' 2025",
    "catalog_brand": "Air Jordan",
    "catalog_sku": "HQ7978 100",
    "size": 10.5,
    "price_cents": 22000,
    "price_cents_after_take": 20000,
    "sales_channel": "GOAT",
    "purchase_order_number": "PO-123456",
    "listing_id": "l-xyz-789",
    "label_type": "LABEL_TYPE_SHIPPING",
    "label_url": "https://example.com/labels/1a2b3c4d.pdf",
    "label_tracking_number": "1Z999AA10123456789",
    "label_courier": "UPS",
    "sold_at": "2025-07-28T10:30:00Z",
    "label_generated_at": "2025-07-28T14:00:00Z",
    "in_transit_at": "2025-07-29T09:00:00Z",
    "updated_at": "2025-07-29T09:00:00Z",
    "cancels_at": "2025-08-04T10:30:00Z",
    "customs_declaration": {
      "commercial_invoice_url": "https://example.com/invoices/1a2b3c4d.pdf",
      "declared_customs_value_cents": 22000
    }
  }
}
```

**Response Fields:**

**order:**
- **id:** Order ID
- **status:** Order status enum (will be ORDER_STATUS_IN_TRANSIT after marking as shipped)
- **fulfillment_status:** Fulfillment status enum (will be FULFILLMENT_STATUS_SELLER_SHIPPED after marking as shipped)
- **catalog_id:** Catalog ID of the ordered item
- **catalog_name:** Name of the ordered item
- **catalog_brand:** Brand of the ordered item
- **catalog_sku:** SKU of the ordered item
- **size:** Size of the ordered item (numeric)
- **price_cents:** Order price in cents
- **price_cents_after_take:** Price after platform take in cents
- **sales_channel:** Sales channel (e.g., "GOAT", "Alias")
- **purchase_order_number:** Purchase order number
- **listing_id:** Associated listing ID
- **label_type:** Label type enum (e.g., LABEL_TYPE_SHIPPING, LABEL_TYPE_DROPOFF)
- **label_url:** URL to shipping label PDF
- **label_tracking_number:** Tracking number for shipment
- **label_courier:** Courier service (e.g., "UPS", "FedEx")
- **sold_at:** Timestamp when order was sold (ISO 8601)
- **label_generated_at:** Timestamp when label was generated (ISO 8601)
- **in_transit_at:** Timestamp when order went in transit (ISO 8601)
- **updated_at:** Last update timestamp (ISO 8601)
- **cancels_at:** Timestamp when order will be canceled if not fulfilled (ISO 8601)
- **customs_declaration:** Customs declaration object (optional)
  - **commercial_invoice_url:** URL to commercial invoice PDF
  - **declared_customs_value_cents:** Declared customs value in cents

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

## Batch Listing Management

### List Batch Operations

**Endpoint:** `GET /api/v1/listings/batch`

**Description:**
Returns a paginated list of batches, and can be filtered based on status.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| status | string | query | No | The status of the batch to filter. Available values: BATCH_STATUS_INVALID, BATCH_STATUS_PENDING, BATCH_STATUS_IN_PROGRESS, BATCH_STATUS_COMPLETED. Default: BATCH_STATUS_INVALID |
| pagination_token | string | query | No | Pass the next pagination token received from a subsequent request. If not provided, the default will be the first page in the set |

**Batch Status Values:**
- `BATCH_STATUS_INVALID` (default)
- `BATCH_STATUS_PENDING`: Batch is queued and waiting to be processed
- `BATCH_STATUS_IN_PROGRESS`: Batch is actively being processed
- `BATCH_STATUS_COMPLETED`: Batch has completed successfully without errors

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "batches": [
    {
      "id": "string",
      "status": "BATCH_STATUS_INVALID",
      "type": "BATCH_TYPE_INVALID",
      "queued": "string",
      "processed": "string",
      "failed": "string"
    }
  ],
  "next_pagination_token": "string",
  "has_more": true
}
```

**Response Fields:**

**batches[]:**
- **id:** Batch ID
- **status:** Batch status enum
- **type:** Batch type enum
- **queued:** Number of items queued in the batch
- **processed:** Number of items processed in the batch
- **failed:** Number of items that failed in the batch

**next_pagination_token:** Token for next page
**has_more:** Boolean indicating if more results exist

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Get Batch Details

**Endpoint:** `GET /api/v1/listings/batch/{id}`

**Description:**
Get a specified batch with details.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| id | string | path | Yes | The unique id of the batch |

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "id": "string",
  "status": "BATCH_STATUS_INVALID",
  "type": "BATCH_TYPE_INVALID",
  "queued": "string",
  "processed": "string",
  "failed": "string",
  "created_at": "2025-11-25T08:44:15.657Z",
  "processed_at": "2025-11-25T08:44:15.657Z",
  "completed_at": "2025-11-25T08:44:15.657Z"
}
```

**Response Fields:**

- **id:** Batch ID
- **status:** Batch status enum
- **type:** Batch type enum
- **queued:** Number of items queued in the batch
- **processed:** Number of items processed in the batch
- **failed:** Number of items that failed in the batch
- **created_at:** Timestamp when batch was created (ISO 8601)
- **processed_at:** Timestamp when batch processing started (ISO 8601)
- **completed_at:** Timestamp when batch was completed (ISO 8601)

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Batch Activate Listings

**Endpoint:** `POST /api/v1/listings/batch_activate`

**Description:**
Activate a batch of listings. Will activate existing listings asynchronously. Please note that there are internal limits on how many batch operations can be processed concurrently. If too many are submitted at once, you may receive an error indicating that your request cannot be processed at this time. In such cases, we recommend allowing some time for ongoing operations to complete before retrying.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| ids | array[string] | query | Yes | The list of listing ids to activate, max size 1,000. Note: if the listing requires pictures, all required pictures must be uploaded for activation to succeed |

**Important Notes:**
- Maximum batch size: 1,000 listings
- Operations are processed asynchronously
- Internal limits on concurrent batch operations exist
- If too many batches are submitted at once, you may receive an error
- Recommendation: Allow time for ongoing operations to complete before retrying
- For picture-required listings, all required pictures must be uploaded for activation to succeed

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "batch_id": "string",
  "status": "BATCH_STATUS_INVALID"
}
```

**Response Fields:**

- **batch_id:** ID of the created batch operation
- **status:** Current status of the batch (BATCH_STATUS_INVALID, BATCH_STATUS_PENDING, BATCH_STATUS_IN_PROGRESS, BATCH_STATUS_COMPLETED)

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Batch Create Listings

**Endpoint:** `POST /api/v1/listings/batch_create`

**Description:**
Create a new batch of listings. Will create listings asynchronously. The number of total listings created in your request cannot exceed 1000. The metadata_list field applies metadata individually to each listing under the specified catalog_id, maintaining a one-to-one relationship. Please note that there are internal limits on how many batch operations can be processed concurrently. If too many are submitted at once, you may receive an error indicating that your request cannot be processed at this time. In such cases, we recommend allowing some time for ongoing operations to complete before retrying. Important: For listings that require pictures, all mandatory pictures must be uploaded before activation can succeed. If a picture-required listing fails to activate due to missing pictures, it will be set to inactive status.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| body | object | body | Yes | Request body containing batch listing items |

**Request Body Schema:**

```json
{
  "items": [
    {
      "catalog_id": "some-catalog-id",
      "activate": true,
      "size_unit": "SIZE_UNIT_US",
      "condition": "CONDITION_NEW",
      "packaging_condition": "PACKAGING_CONDITION_GOOD_CONDITION",
      "metadata_list": [
        {
          "key1": "value1"
        },
        {
          "key2": "value2"
        }
      ],
      "price_cents": 2500,
      "size": 10.5,
      "quantity": 2
    }
  ]
}
```

**Request Body Fields:**

**items[]:** Array of listing items to create
- **catalog_id:** Catalog ID for the item (required)
- **activate:** Boolean to activate listings immediately (optional)
- **size_unit:** Size unit system (required)
- **condition:** Product condition enum (required)
- **packaging_condition:** Packaging condition enum (required)
- **metadata_list[]:** Array of metadata objects to apply individually to each listing (optional)
- **price_cents:** Price in cents (required)
- **size:** Size value (required)
- **quantity:** Number of listings to create with these parameters (required)

**Important Notes:**
- Maximum total listings: 1,000 per request
- Operations are processed asynchronously
- Internal limits on concurrent batch operations exist
- If too many batches are submitted at once, you may receive an error
- Recommendation: Allow time for ongoing operations to complete before retrying
- The metadata_list field applies metadata individually to each listing, maintaining a one-to-one relationship
- For picture-required listings, all mandatory pictures must be uploaded before activation can succeed
- If a picture-required listing fails to activate due to missing pictures, it will be set to inactive status

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "batch_id": "batch_1234567890",
  "status": "BATCH_STATUS_PENDING"
}
```

**Response Fields:**

- **batch_id:** ID of the created batch operation
- **status:** Current status of the batch (BATCH_STATUS_PENDING, BATCH_STATUS_IN_PROGRESS, BATCH_STATUS_COMPLETED)

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Batch Deactivate Listings

**Endpoint:** `POST /api/v1/listings/batch_deactivate`

**Description:**
Deactivate a batch of listings. Will deactivate existing listings asynchronously. Please note that there are internal limits on how many batch operations can be processed concurrently. If too many are submitted at once, you may receive an error indicating that your request cannot be processed at this time. In such cases, we recommend allowing some time for ongoing operations to complete before retrying.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| ids | array[string] | query | Yes | The list of listing ids to deactivate, max size 1,000 |

**Important Notes:**
- Maximum batch size: 1,000 listings
- Operations are processed asynchronously
- Internal limits on concurrent batch operations exist
- If too many batches are submitted at once, you may receive an error
- Recommendation: Allow time for ongoing operations to complete before retrying

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "batch_id": "string",
  "status": "BATCH_STATUS_INVALID"
}
```

**Response Fields:**

- **batch_id:** ID of the created batch operation
- **status:** Current status of the batch (BATCH_STATUS_INVALID, BATCH_STATUS_PENDING, BATCH_STATUS_IN_PROGRESS, BATCH_STATUS_COMPLETED)

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Batch Delete Listings

**Endpoint:** `DELETE /api/v1/listings/batch_delete`

**Description:**
Delete a batch of listings. Will delete existing listings asynchronously. Please note that there are internal limits on how many batch operations can be processed concurrently. If too many are submitted at once, you may receive an error indicating that your request cannot be processed at this time. In such cases, we recommend allowing some time for ongoing operations to complete before retrying.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| ids | array[string] | query | Yes | The list of listing ids to delete, max size 1,000 |

**Important Notes:**
- Maximum batch size: 1,000 listings
- Operations are processed asynchronously
- Internal limits on concurrent batch operations exist
- If too many batches are submitted at once, you may receive an error
- Recommendation: Allow time for ongoing operations to complete before retrying

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "batch_id": "string",
  "status": "BATCH_STATUS_INVALID"
}
```

**Response Fields:**

- **batch_id:** ID of the created batch operation
- **status:** Current status of the batch (BATCH_STATUS_INVALID, BATCH_STATUS_PENDING, BATCH_STATUS_IN_PROGRESS, BATCH_STATUS_COMPLETED)

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Get Batch Quota Status

**Endpoint:** `GET /api/v1/listings/batch_operation/quota`

**Description:**
Get the current count of operations across all your active batches as well as the current max quota allowed. Due to internal limits, there is a maximum number of concurrent operations that can be processed at any given time and is subject to change. If you exceed this limit, you will receive an error indicating that your request cannot be processed at this time. In such cases, we recommend allowing some time for ongoing operations to complete before retrying.

**Parameters:**
None

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "used_operation_quota": "string",
  "max_operation_quota": "string"
}
```

**Response Fields:**

- **used_operation_quota:** Current count of operations across all active batches
- **max_operation_quota:** Maximum number of concurrent operations allowed

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Get Batch Operation Details

**Endpoint:** `GET /api/v1/listings/batch_operations/{id}`

**Description:**
Get the operations performed by the specified batch with details. The "result" and "request" fields in the response will only return one of each specified type, i.e. a create_listing_result and a create_listing_request.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| id | string | path | Yes | The unique id of the batch |
| status | string | query | No | Batch operation status you want to retrieve records for, if empty, will default to retrieving all operations up to pagination limit. Available values: BATCH_OPERATION_STATUS_INVALID, BATCH_OPERATION_STATUS_PENDING, BATCH_OPERATION_STATUS_IN_PROGRESS, BATCH_OPERATION_STATUS_COMPLETED, BATCH_OPERATION_STATUS_FAILED. Default: BATCH_OPERATION_STATUS_INVALID |
| limit | string($int64) | query | No | The maximum number of operations to return. Default: 25, Maximum: 500 |
| pagination_token | string | query | No | Pass the next pagination token received from a prior request. If not provided, the default will be the first page in the set |

**Batch Operation Status Values:**
- `BATCH_OPERATION_STATUS_INVALID` (default)
- `BATCH_OPERATION_STATUS_PENDING`: Batch operation is queued and waiting to be processed
- `BATCH_OPERATION_STATUS_IN_PROGRESS`: Batch operation is currently being processed
- `BATCH_OPERATION_STATUS_COMPLETED`: Batch operation has completed successfully
- `BATCH_OPERATION_STATUS_FAILED`: Batch operation encountered an error and did not complete successfully

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "id": "string",
  "operations": [
    {
      "type": "BATCH_TYPE_INVALID",
      "create_listing_result": {
        "listing": {
          "id": "string",
          "catalog_id": "string",
          "condition": "CONDITION_INVALID",
          "packaging_condition": "PACKAGING_CONDITION_INVALID",
          "size": 0,
          "size_unit": "SIZE_UNIT_INVALID",
          "sku": "string",
          "consigned": true,
          "created_at": "2025-11-25T08:44:15.659Z",
          "updated_at": "2025-11-25T08:44:15.659Z",
          "status": "LISTING_STATUS_INVALID",
          "price_cents": "string",
          "activated_at": "2025-11-25T08:44:15.659Z",
          "metadata": {},
          "defects": [
            "LISTING_DEFECT_INVALID"
          ],
          "additional_defects": "string"
        }
      },
      "update_listing_result": {
        "to": {
          "catalog_id": "string",
          "price_cents": "string",
          "size": 0
        },
        "id": "string"
      },
      "activate_listing_result": {
        "id": "string"
      },
      "deactivate_listing_result": {
        "id": "string"
      },
      "delete_listing_result": {
        "id": "string"
      },
      "errors": [
        "string"
      ],
      "success": true,
      "created_at": "2025-11-25T08:44:15.660Z",
      "processed_at": "2025-11-25T08:44:15.660Z",
      "completed_at": "2025-11-25T08:44:15.660Z",
      "status": "BATCH_OPERATION_STATUS_INVALID",
      "create_listing_request": {
        "catalog_id": "string",
        "activate": true,
        "size_unit": "SIZE_UNIT_INVALID",
        "condition": "CONDITION_INVALID",
        "packaging_condition": "PACKAGING_CONDITION_INVALID",
        "metadata_list": [
          {}
        ],
        "price_cents": "string",
        "size": 0,
        "quantity": "string"
      },
      "update_listing_request": {
        "id": "string",
        "price_cents_change": {
          "new_value": "string",
          "conditional_value": "string",
          "condition_operator": "CONDITION_OPERATOR_INVALID"
        },
        "size_change": {
          "new_value": 0,
          "conditional_value": 0,
          "condition_operator": "CONDITION_OPERATOR_INVALID"
        },
        "catalog_id_change": {
          "new_value": "string",
          "conditional_value": "string",
          "condition_operator": "CONDITION_OPERATOR_INVALID"
        }
      },
      "activate_listing_request": {
        "id": "string"
      },
      "deactivate_listing_request": {
        "id": "string"
      },
      "delete_listing_request": {
        "id": "string"
      }
    }
  ],
  "pagination_token": "string"
}
```

**Response Fields:**

- **id:** Batch ID
- **operations[]:** Array of batch operations
  - **type:** Batch type enum
  - **create_listing_result:** Result for create listing operation (if applicable)
    - **listing:** Created listing object
  - **update_listing_result:** Result for update listing operation (if applicable)
    - **to:** Updated values (catalog_id, price_cents, size)
    - **id:** Listing ID
  - **activate_listing_result:** Result for activate listing operation (if applicable)
    - **id:** Listing ID
  - **deactivate_listing_result:** Result for deactivate listing operation (if applicable)
    - **id:** Listing ID
  - **delete_listing_result:** Result for delete listing operation (if applicable)
    - **id:** Listing ID
  - **errors[]:** Array of error messages (if any)
  - **success:** Boolean indicating if operation succeeded
  - **created_at:** Timestamp when operation was created (ISO 8601)
  - **processed_at:** Timestamp when operation processing started (ISO 8601)
  - **completed_at:** Timestamp when operation was completed (ISO 8601)
  - **status:** Operation status enum
  - **create_listing_request:** Original create listing request (if applicable)
  - **update_listing_request:** Original update listing request (if applicable)
  - **activate_listing_request:** Original activate listing request (if applicable)
  - **deactivate_listing_request:** Original deactivate listing request (if applicable)
  - **delete_listing_request:** Original delete listing request (if applicable)
- **pagination_token:** Token for next page

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

### Batch Update Listings

**Endpoint:** `POST /api/v1/listings/batch_update`

**Description:**
Update a batch of listings conditionally. Will update existing listings asynchronously. Please note that there are internal limits on how many batch operations can be processed concurrently. If too many are submitted at once, you may receive an error indicating that your request cannot be processed at this time. In such cases, we recommend allowing some time for ongoing operations to complete before retrying.

**Parameters:**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| body | object | body | Yes | A request to update multiple listings in a batch |

**Request Body Schema:**

```json
{
  "items": [
    {
      "id": "listing-id-1",
      "price_cents_change": {
        "new_value": 3000,
        "condition_operator": "CONDITION_OPERATOR_EQ"
      },
      "size_change": {
        "new_value": 10.5,
        "condition_operator": "CONDITION_OPERATOR_EQ"
      }
    }
  ]
}
```

**Request Body Fields:**

**items[]:** Array of listing updates
- **id:** Listing ID to update (required)
- **price_cents_change:** Price update with conditional logic (optional)
  - **new_value:** New price value in cents
  - **conditional_value:** Condition value to check against (optional)
  - **condition_operator:** Condition operator enum
- **size_change:** Size update with conditional logic (optional)
  - **new_value:** New size value
  - **conditional_value:** Condition value to check against (optional)
  - **condition_operator:** Condition operator enum
- **catalog_id_change:** Catalog ID update with conditional logic (optional)
  - **new_value:** New catalog ID
  - **conditional_value:** Condition value to check against (optional)
  - **condition_operator:** Condition operator enum

**Important Notes:**
- Operations are processed asynchronously
- Internal limits on concurrent batch operations exist
- If too many batches are submitted at once, you may receive an error
- Recommendation: Allow time for ongoing operations to complete before retrying
- Updates support conditional logic based on current values

**Responses:**

| Code | Description |
|------|-------------|
| 200 | A successful response |
| default | An unexpected error response |

**Response Schema - Success (200):**

```json
{
  "batch_id": "string",
  "status": "BATCH_STATUS_INVALID"
}
```

**Response Fields:**

- **batch_id:** ID of the created batch operation
- **status:** Current status of the batch (BATCH_STATUS_INVALID, BATCH_STATUS_PENDING, BATCH_STATUS_IN_PROGRESS, BATCH_STATUS_COMPLETED)

**Response Schema - Error (default):**

```json
{
  "code": 0,
  "message": "string",
  "details": [
    {
      "@type": "string",
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  ]
}
```

---

---

## Error Codes

Alias API uses conventional HTTP response codes to indicate the success or failure of an API request.

### HTTP Response Code Ranges

- **2xx:** Success - Request completed successfully
- **4xx:** Client Error - Error in the provided information (missing parameter, resource not found, etc.)
- **5xx:** Server Error - Error with Alias servers

### Error Handling

**4xx errors** include:
- An error code that briefly explains the error
- A helpful error message

**Important:** Handle errors based on the **error code**, not the error message.
- Error messages may change between versions or be translated based on language preferences
- Error codes remain consistent between versions

### HTTP Status Codes

| Code | Status | Description |
|------|--------|-------------|
| **200** | OK | Everything worked as expected |
| **400** | Bad Request | The request was unacceptable, often due to missing a required parameter or malformed request |
| **401** | Unauthorized | No valid API key provided |
| **402** | Request Failed | The parameters were valid but the request failed |
| **403** | Forbidden | The PAT token doesn't have permissions to perform the request |
| **404** | Not Found | The requested resource doesn't exist |
| **409** | Conflict | The request conflicts with another request or process. Generally happens when attempting to modify a resource already being modified by another process |
| **429** | Too Many Requests | Too many requests hit the API too quickly. Contact support if you require a higher rate limit |
| **500, 502, 503, 504** | Server Errors | Something is wrong with Alias servers. Try again later or contact support |

---

## Rate Limits & Throttling

*Rate limiting and throttling information will be documented here*

---

## Notes & Quirks

### Request IDs

Every API request returns a universally unique request ID that can be used for troubleshooting and tracking.

**Purpose:**
- Identify specific requests
- Help resolve support issues
- Track historical status and resolution of requests

**Retrieval:**
Request IDs are available in the `x-request-id` response header returned after each request.

**Support:**
When filing a support ticket or contacting support, include relevant request IDs to facilitate a prompt and accurate response.

**Example - Retrieving Request ID:**

```javascript
const PATH = 'search'; // API Path
const BEARER_TOKEN = 'mytoken_84cf6c5c734d4c88';

fetch(`https://api.alias.org/api/v1/${PATH}?query=${QUERY}&limit=${LIMIT}&paginationToken=${PAGINATION_TOKEN}`, {
  headers: {Authorization: `Bearer ${BEARER_TOKEN}`}
})
  .then(resp => resp.headers.get('x-request-id'))
  .then(console.log);
```

---

## Endpoint Relationships

*How endpoints relate to each other and typical workflows will be documented here*

---

## Region IDs and Multi-Region Support

**Last Updated:** 2025-11-28

The Alias API supports multiple regional markets through the `region_id` parameter. This allows you to query market data (pricing, listings, offers) specific to different geographical regions.

### Confirmed Region IDs

| Region ID | Code | Region Name | Currency | Status |
|-----------|------|-------------|----------|--------|
| 1 | US | United States | USD | ✅ Active |
| 2 | EU | Europe | EUR | ✅ Active |
| 3 | UK | United Kingdom | GBP | ✅ Active |
| 4 | AUS | Australia | AUD | ✅ Active |
| 5 | CAD | Canada | CAD | ⚠️ Limited data |
| 6 | JPN | Japan | JPY | ⚠️ Limited data |

### Usage

The `region_id` parameter is accepted on pricing and market data endpoints:

```javascript
// Get EU pricing for a specific product
const params = new URLSearchParams({
  catalog_id: 'air-jordan-1-retro-high-og-dz5485-612',
  size: '10',
  product_condition: '1',
  packaging_condition: '1',
  region_id: '2'  // EU region
});

fetch(`https://api.alias.org/api/v1/pricing_insights/availability?${params}`, {
  headers: { Authorization: `Bearer ${BEARER_TOKEN}` }
});
```

### Important Notes

1. **All prices returned in USD**: Regardless of which region you query, the API returns all prices normalized to USD
2. **Regional market differences**: The `region_id` affects which regional market's supply/demand you're seeing, not the currency
3. **Currency conversion**: Alias uses the **payout conversion rate** to convert between currencies
4. **Price comparison**: You can directly compare prices across regions since they're all in USD

### Example Regional Pricing Differences

For Air Jordan 4 'Black Cat' (Size US 10):
- **US (region_id=1)**: $239 ask / $236 bid
- **EU (region_id=2)**: $259 ask / $227 bid (+8.4% higher)
- **UK (region_id=3)**: $279 ask / $272 bid (+16.7% higher)

---

## Numeric Enum Values

**Last Updated:** 2025-11-28

The Alias API accepts **both string and numeric formats** for enum parameters. The numeric format is more concise and follows protobuf conventions.

### Product Condition Enums

| Numeric | String Enum | Description |
|---------|-------------|-------------|
| 0 | `PRODUCT_CONDITION_INVALID` | Invalid (rejected by API) |
| 1 | `PRODUCT_CONDITION_NEW` | New/unworn condition |
| 2 | `PRODUCT_CONDITION_USED` | Used/worn condition |
| 3 | `PRODUCT_CONDITION_NEW_WITH_DEFECTS` | New but has defects |

### Packaging Condition Enums

| Numeric | String Enum | Description |
|---------|-------------|-------------|
| 0 | `PACKAGING_CONDITION_INVALID` | Invalid (rejected by API) |
| 1 | `PACKAGING_CONDITION_GOOD_CONDITION` | Box in good condition |
| 2 | `PACKAGING_CONDITION_MISSING_LID` | Box missing lid |
| 3 | `PACKAGING_CONDITION_BADLY_DAMAGED` | Box badly damaged |
| 4 | `PACKAGING_CONDITION_NO_ORIGINAL_BOX` | No original box |

### Both Formats Are Valid

**String format** (verbose):
```javascript
{
  product_condition: 'PRODUCT_CONDITION_NEW',
  packaging_condition: 'PACKAGING_CONDITION_GOOD_CONDITION',
  region_id: '2'
}
```

**Numeric format** (concise):
```javascript
{
  product_condition: 1,  // NEW
  packaging_condition: 1, // GOOD_CONDITION
  region_id: 2           // EU
}
```

Both formats return identical results. The numeric format is recommended for:
- Cleaner, more readable code
- Reduced payload size
- Consistency with protobuf/gRPC conventions

### Testing Results

- ✅ `product_condition=1` → Returns NEW condition pricing
- ✅ `product_condition=2` → Returns USED condition pricing (often no data)
- ✅ `packaging_condition=1` → Returns GOOD_CONDITION pricing
- ✅ Mixed formats work (string product + numeric packaging)
- ❌ `product_condition=0` → 400 Bad Request (INVALID enum)

---

## Currency Conversion

**Last Updated:** 2025-11-28

### Payout Conversion Rate

Alias uses the **payout conversion rate** to handle currency conversions between different regional markets. This ensures consistent pricing across regions while accounting for exchange rates.

### How It Works

1. **All API responses in USD**: Pricing data is returned in USD regardless of the `region_id` parameter
2. **Regional market filtering**: The `region_id` parameter filters which regional market's supply/demand you're querying
3. **Conversion at payout**: Currency conversion happens when sellers receive payouts, not at the API level
4. **Exchange rate timing**: The payout conversion rate is applied at the time of transaction/payout

### Example

```javascript
// Query EU market pricing
GET /pricing_insights/availability?catalog_id=xxx&size=10&region_id=2

// Response (all in USD)
{
  "availability": {
    "lowest_listing_price_cents": "14000",  // $140.00 USD
    "highest_offer_price_cents": "11100"     // $111.00 USD
  }
}

// When a EU seller receives payout for a $140 sale:
// - Payout conversion rate applied: $140 × 0.92 = €128.80
// - Seller receives €128.80 in their EUR account
```

### Key Takeaways

- ✅ API prices are **normalized to USD** for easy comparison
- ✅ `region_id` controls **which market** you're viewing
- ✅ Currency conversion uses **payout conversion rate**
- ✅ Actual currency conversion happens **at transaction time**, not at API query time

---


---

## Sales History and Analytics

**Last Updated:** 2025-11-28

### Recent Sales Endpoint

The `/pricing_insights/recent_sales` endpoint returns historical sales data for a product. This is how market analytics tools calculate sales volume metrics.

**Endpoint:** `GET /api/v1/pricing_insights/recent_sales`

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| catalog_id | string | Yes | Product catalog ID |
| size | number | Yes | US shoe size |
| product_condition | string/number | Yes | Use `1` or `PRODUCT_CONDITION_NEW` |
| packaging_condition | string/number | Yes | Use `1` or `PACKAGING_CONDITION_GOOD_CONDITION` |
| region_id | string/number | No | Region filter (e.g., `2` for EU) |
| limit | number | No | Max results (default: 10, max: 200) |

### Response Structure

```javascript
{
  "recent_sales": [
    {
      "purchased_at": "2025-11-27T11:46:29.335Z",
      "price_cents": "29500",
      "size": 10,
      "consigned": false,
      "catalog_id": "air-jordan-1-retro-high-og-dz5485-612"
    },
    // ... up to 200 sales
  ]
}
```

### Single Size Example

Get sales history for a specific size to calculate "monthly sales":

```javascript
const params = new URLSearchParams({
  catalog_id: 'air-jordan-1-retro-high-og-dz5485-612',
  size: '10',
  product_condition: '1',      // NEW
  packaging_condition: '1',     // GOOD_CONDITION
  region_id: '2',              // EU
  limit: '200'
});

const response = await fetch(
  `https://api.alias.org/api/v1/pricing_insights/recent_sales?${params}`,
  { headers: { Authorization: `Bearer ${BEARER_TOKEN}` }}
);

const data = await response.json();

// Calculate monthly sales (last 30 days)
const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
const monthlySales = data.recent_sales.filter(sale => 
  new Date(sale.purchased_at).getTime() >= thirtyDaysAgo
);

console.log(`Monthly sales for size 10: ${monthlySales.length}`);
```

### Multi-Size Aggregation Example

To get aggregate stats across all sizes (like "Day/Week/Month/Total"):

```javascript
const sizes = [8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12];
const allSales = [];

// Fetch sales for each size
for (const size of sizes) {
  const params = new URLSearchParams({
    catalog_id: 'air-jordan-1-retro-high-og-dz5485-612',
    size: size.toString(),
    product_condition: '1',
    packaging_condition: '1',
    region_id: '2',
    limit: '200'
  });

  const response = await fetch(
    `https://api.alias.org/api/v1/pricing_insights/recent_sales?${params}`,
    { headers: { Authorization: `Bearer ${BEARER_TOKEN}` }}
  );

  const data = await response.json();
  allSales.push(...data.recent_sales);
}

// Calculate aggregate stats
const now = Date.now();
const stats = {
  day: allSales.filter(s => now - new Date(s.purchased_at).getTime() <= 24 * 60 * 60 * 1000).length,
  week: allSales.filter(s => now - new Date(s.purchased_at).getTime() <= 7 * 24 * 60 * 60 * 1000).length,
  month: allSales.filter(s => now - new Date(s.purchased_at).getTime() <= 30 * 24 * 60 * 60 * 1000).length,
  total: allSales.length
};

console.log(`Day: ${stats.day}, Week: ${stats.week}, Month: ${stats.month}, Total: ${stats.total}`);
```

### Use Cases

1. **Per-Size Sales Volume**: Call once per size with `limit=200` to get monthly sales count
2. **Aggregate Analytics**: Call for all sizes and combine client-side for total market activity
3. **Price Trend Analysis**: Track `price_cents` over time to see pricing trends
4. **Regional Comparison**: Compare sales volume across different `region_id` values

### Important Notes

- ✅ **API Limit**: Maximum 200 sales per request
- ✅ **Sales Ordering**: Results ordered by `purchased_at` (most recent first)
- ✅ **Date Filtering**: Client-side filtering required for time periods
- ✅ **Multi-Size Strategy**: Make parallel requests for better performance
- ⚠️ **Rate Limits**: Be mindful when fetching many sizes (consider batching/throttling)

### Real-World Example

Market analysis tools (like price comparison tools) use this endpoint to display:
- **"Monthly Sales" column**: Per-size sales in last 30 days
- **"Day/Week/Month" stats**: Aggregated sales across all sizes
- **Sales trends**: Historical price points over time

---

