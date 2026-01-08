# ALIAS V4 API MASTER REFERENCE

**Complete API documentation for Alias market data integration**
**Version:** V4 (Inventory V4 architecture)
**Date:** 2025-12-09

---

## Authentication

Every request to this API must be authenticated using bearer authentication and authorized using personal access tokens (PATs).

**Implementation:**
- Base URL: `https://api.alias.org/api/v1`
- Authentication: Bearer token
- Token Source: `ALIAS_PAT` environment variable

**Request Headers:**
```
Authorization: Bearer {ALIAS_PAT}
Content-Type: application/json  // Only for POST/PATCH/PUT with body
```

**Token Management:**
- Phase 1: Single PAT from environment variable for all requests
- Phase 2: Per-user tokens from `alias_credentials` table

---

## Pagination

Many top-level API resources contain "list" and "search" versions to be used for reading large data sets. Often times, these list versions of the resource cannot be queried in a single request, and need to be paged over to obtain the entire set. For instance, you can search catalog items in an effort to create listings or analyze pricing insights. These list API methods share a common structure, taking at least two pagination control parameters: `limit` and `pagination_token`.

**Pagination Behavior:**
- The response of a paged API method represents a single page in an order determined by the specific resource
- If you do not specify a `pagination_token`, you will receive the first page of the dataset
- You can specify `pagination_token` equal to the returned `next_pagination_token` of the first page of the queried dataset
- You cannot "skip ahead" of pages or send concurrent requests to receive the entire dataset at once
- Please use the appropriate query control parameters (such as filters and facets) to concentrate your queried dataset to only relevant information

**Response Format:**
- If a given page is not the last page in the dataset, the response will contain:
  - `has_more` boolean field with value `true`
  - `next_pagination_token` to be used in a subsequent paged request
- Most "list" and "search" requests enforce rate limits, so it is advised to record persistent IDs for re-use in other API operations

**Type Note:**
- `limit` is documented as `string($int64)` in OpenAPI spec, but in TypeScript/JavaScript code it's treated as `number` and serialized to querystring

**Example Request:**
```javascript
const PATH = 'search'; // My API Path
const LIMIT = 50; // My results limit
const PAGINATION_TOKEN = '857f6e1f-f01e-4c88-b00d-84cf6c5c734d'; // Pagination token received from previous call
const BEARER_TOKEN = 'mytoken_84cf6c5c734d4c88';

fetch(`https://api.alias.org/api/v1/${PATH}?query=${QUERY}&limit=${LIMIT}&pagination_token=${PAGINATION_TOKEN}`, {
  headers: {Authorization: `Bearer ${BEARER_TOKEN}`}
})
  .then(resp => resp.json())
  .then(json => console.log(JSON.stringify(json)));
```

**Example Response:**
```json
{
  "items": [
    //...
  ],
  "next_pagination_token": "string",
  "has_more": true
}
```

---

## Errors

Alias OpenAPI uses conventional HTTP response codes to indicate the success or failure of an API request. In general: Codes in the 2xx range indicate success. Codes in the 4xx range indicate an error that failed given the information provided (e.g., a required parameter was omitted, a resource cannot be found, another process is modifying the resource, etc.). Codes in the 5xx range indicate an error with our servers.

4xx errors that can be handled programmatically include an error code that briefly explains the error reported, as well as a generally helpful error message. It is recommended to handle these errors based off of the error code returned, and not the error message. Error messages can change between versions and may be translated based off of language preferences, but error codes will remain consistent between versions.

**HTTP Status Code Summary:**

- **200 - OK**: Everything worked as expected.
- **400 - Bad Request**: The request was unacceptable, often due to missing a required parameter or malformed request
- **401 - Unauthorized**: No valid API key provided.
- **402 - Request Failed**: The parameters were valid but the request failed.
- **403 - Forbidden**: The PAT token doesn't have permissions to perform the request.
- **404 - Not Found**: The requested resource doesn't exist.
- **409 - Conflict**: The request conflicts with another request or process. This generally happens when you are attempting to modify a resource already being modified by another process.
- **429 - Too Many Requests**: Too many requests hit the API too quickly. If you require a higher rate limit to support your use cases, please reach out to support detailing your request.
- **500, 502, 503, 504 - Server Errors**: Something is wrong with our servers, please try again later or contact support

---

## Request IDs

Request IDs are universally unique IDs that can be used to identify a request. We often use these IDs to help resolve any issues and to track the historical status and resolution of a request. Request IDs can be retrieved from the standard `x-request-id` response header returned after each request.

If you file a support ticket or reach out our support email, please include any relevant request IDs to help us facilitate a prompt and accurate response to your question or issue.

**Example - Print request ID:**
```javascript
const PATH = 'search'; // My API Path
const BEARER_TOKEN = 'mytoken_84cf6c5c734d4c88';

fetch(`https://api.alias.org/api/v1/{PATH}?query={QUERY}&limit={LIMIT}&pagination_token={PAGINATION_TOKEN}`, {
  headers: {Authorization: `Bearer ${BEARER_TOKEN}`}
})
  .then(resp => resp.headers.get('x-request-id'))
  .then(console.log);
```

---

## API Endpoints

### Catalog

#### GET /api/v1/catalog - Search Catalog

Search the catalog for items that are relevant to you, or to match any catalog ids returned to your inventory.

**Parameters:**

| Name | Type | Location | Description | Required |
|------|------|----------|-------------|----------|
| `query` | string | query | The term to search. Examples: 'Nike', 'Air Max Plus Baltic Blue', '555088 063' | Yes |
| `limit` | string($int64) | query | The size of the 'page' returned. The default value is the maximum limit. | No |
| `pagination_token` | string | query | Pass the next pagination token received from a subsequent request. If not provided, the default will be the first page in the set. | No |

**Response (200 - Success):**

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

**Response Schema:**

- `catalog_items` (array): The catalog items that match the given query
  - `catalog_id` (string): The unique id that identifies the product in our catalog. **Store these ids** for frequently visited catalog items, as they will not change over time.
  - `name` (string): The name of the catalog item
  - `sku` (string): The SKU of the catalog item
  - `brand` (string): The name of the Brand associated to the catalog item
  - `gender` (string): The gender of the catalog item
  - `release_date` (string): The release date of the catalog item (ISO 8601)
  - `product_category_v2` (string): The product category (preferred over `product_category` when both are set)
  - `product_type` (string): The product type of the catalog item
  - `size_unit` (string): Sizing standard. Values: `SIZE_UNIT_US`, `SIZE_UNIT_UK`, `SIZE_UNIT_IT`, `SIZE_UNIT_FR`, `SIZE_UNIT_EU`, `SIZE_UNIT_JP`
  - `allowed_sizes` (array): The allowed size options for this catalog item
    - `display_name` (string): Display name for the size
    - `value` (number): Numeric size value
    - `us_size_equivalent` (number): US size equivalent
  - `minimum_listing_price_cents` (string): The minimum listing price in cents (as string)
  - `maximum_listing_price_cents` (string): The maximum listing price in cents (as string). Note: For some selling countries, the actual maximum will be lower, likely $750
  - `main_picture_url` (string): A picture of this catalog item
  - `retail_price_cents` (string): The retail price in cents (as string)
  - `colorway` (string): The colorway of this catalog item
  - `nickname` (string): The nickname of this catalog item
  - `requires_listing_pictures` (boolean): Whether this catalog item requires pictures when listing, regardless of condition
  - `requested_pictures` (array): The requested pictures for this catalog item when required for listing
    - `type` (string): Picture type (e.g., `PICTURE_TYPE_OUTER`, `PICTURE_TYPE_EXTRA`)
    - `quantity` (number): Number of pictures required
  - `resellable` (boolean): Indicates if this catalog item is currently available for listing. When false, the item exists in our catalog but cannot be listed by this seller at this time.
- `next_pagination_token` (string): If there are more items in the given query that can fit onto a page, use this token to retrieve the next page
- `has_more` (boolean): A boolean value indicating whether there are more pages in the data set

---

#### GET /api/v1/catalog/{id} - Get Catalog Item

Get the attributes for a single catalog item with the provided catalog id. If that catalog id cannot be found, this endpoint will return a 404 error code.

**Parameters:**

| Name | Type | Location | Description | Required |
|------|------|----------|-------------|----------|
| `id` | string | path | The unique id that identifies the product in our catalog. You can search items in our catalog by using the SearchCatalog endpoint. | Yes |

**Response (200 - Success):**

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

**Response Schema:**

- `catalog_item` (object): The catalog item object (same schema as items in Search Catalog response)

**Important Notes:**
- The `value` field in `allowed_sizes` is the exact value that should be submitted in the `size` parameter when creating a listing
- The `us_size_equivalent` field is required when calling the pricing insights API, which only accepts US size references
- Returns 404 if catalog_id cannot be found

---

### Pricing Insights

#### GET /api/v1/pricing_insights/availabilities/{catalog_id} - List Pricing Insights

Gets comprehensive marketplace data for the provided catalog ID, across all sizes and conditions. Unlike GetAvailability which returns data for a specific variation, this endpoint returns pricing information for **all available variations** of an item. The response includes multiple variants organized by size, condition, and packaging, with each variant containing its own availability data. This endpoint is useful for comparing pricing across different product variations.

**Parameters:**

| Name | Type | Location | Description | Required |
|------|------|----------|-------------|----------|
| `catalog_id` | string | path | The unique ID that identifies the item in our catalog. You can search for catalog IDs by using the SearchCatalog endpoint. | Yes |
| `region_id` | string | query | The region given. Empty values represent all regions (global). | No |
| `consigned` | boolean | query | Whether the item is consigned or not. When this field is not provided, pricing insights will include both consigned and unconsigned items. | No |

**Response (200 - Success):**

```json
{
  "variants": [
    {
      "size": 10.5,
      "product_condition": "PRODUCT_CONDITION_NEW",
      "packaging_condition": "PACKAGING_CONDITION_GOOD_CONDITION",
      "consigned": false,
      "availability": {
        "lowest_listing_price_cents": "25000",
        "highest_offer_price_cents": "22000",
        "last_sold_listing_price_cents": "23500",
        "global_indicator_price_cents": "24000"
      }
    }
  ]
}
```

**Response Schema:**

- `variants` (array): The availability of pricing data across variations of the given catalog ID
  - `size` (number): The US size. Please refer to the catalog's `allowed_sizes` for all supported sizes and their non-US equivalents
  - `product_condition` (string): Product condition. Values:
    - `PRODUCT_CONDITION_NEW`: Item is brand new with no defects
    - `PRODUCT_CONDITION_USED`: Item has been previously used or worn
    - `PRODUCT_CONDITION_NEW_WITH_DEFECTS`: Item is unused but contains a factory defect or imperfection
  - `packaging_condition` (string): Packaging condition. Values:
    - `PACKAGING_CONDITION_GOOD_CONDITION`: Original packaging in excellent condition with minimal wear
    - `PACKAGING_CONDITION_MISSING_LID`: Original packaging with lid missing from the box
    - `PACKAGING_CONDITION_BADLY_DAMAGED`: Original packaging with significant damage or defects
    - `PACKAGING_CONDITION_NO_ORIGINAL_BOX`: Item does not include its original packaging
  - `consigned` (boolean): Whether the item is consigned or not
  - `availability` (object): Pricing availability data
    - `lowest_listing_price_cents` (string): The lowest listing price. This value determines the current price floor for the given item, and will be different between regions
    - `highest_offer_price_cents` (string): The highest offer price. This value determines the highest offer price for the given item. If a valid listing meets this price, the offer will attempt to settle and result in a sale. Differs by region
    - `last_sold_listing_price_cents` (string): The last sold price. Use this to determine historical sales price. If last sold price is higher than current lowest price, the item's price may be trending downward. For detailed historical view, use the ListRecentSales endpoint. Differs by region
    - `global_indicator_price_cents` (string): The global indicator price. The current price at which the item can be priced to be competitive in the global market. In regions of low sales volume, this helps indicate the market price inclusive of transportation fees (duties, taxes, etc.). Listing at this price helps ensure competitiveness in the global market

**Important Notes:**
- All price fields are strings representing cents (e.g., "25000" = $250.00)
- Size is in US sizing. Use `us_size_equivalent` from catalog data for conversion
- When `consigned` parameter is not provided, results include both consigned and unconsigned items
- Empty `region_id` represents global/all regions

---

#### GET /api/v1/pricing_insights/availability - Get Pricing Insights

Gets current marketplace pricing data for a **specific product variation** (catalog ID + size + condition). Returns lowest listing price, highest offer price, last sold price, and global indicator price. Use this endpoint to help gauge the market going rate for a specific product variation and make informed pricing decisions. The global indicator price represents a competitive price point that accounts for regional differences and market dynamics.

**Parameters:**

| Name | Type | Location | Description | Required |
|------|------|----------|-------------|----------|
| `catalog_id` | string | query | The unique ID that identifies the item in our catalog. You can search for catalog IDs by using the SearchCatalog endpoint. | Yes |
| `size` | number($double) | query | The US size. Please refer to the catalog's `allowed_sizes` for all supported sizes and their non-US equivalents. | Yes |
| `product_condition` | string | query | The requested product condition. Values: `PRODUCT_CONDITION_NEW`, `PRODUCT_CONDITION_USED`, `PRODUCT_CONDITION_NEW_WITH_DEFECTS` | Yes |
| `packaging_condition` | string | query | The requested packaging condition. Values: `PACKAGING_CONDITION_GOOD_CONDITION`, `PACKAGING_CONDITION_MISSING_LID`, `PACKAGING_CONDITION_BADLY_DAMAGED`, `PACKAGING_CONDITION_NO_ORIGINAL_BOX` | Yes |
| `consigned` | boolean | query | Whether the item is consigned or not. When this field is not provided, pricing insights will include both consigned and unconsigned items. | No |
| `region_id` | string | query | The region given. Not providing this parameter will return values across all selling regions. | No |

**Response (200 - Success):**

```json
{
  "availability": {
    "lowest_listing_price_cents": "25000",
    "highest_offer_price_cents": "22000",
    "last_sold_listing_price_cents": "23500",
    "global_indicator_price_cents": "24000"
  }
}
```

**Response Schema:**

- `availability` (object): Pricing availability data for the specific variation
  - `lowest_listing_price_cents` (string): The lowest listing price for the given parameters. This value can be used to determine the current price floor for the given item, and will be different between regions
  - `highest_offer_price_cents` (string): The highest offer price for the given parameters. This value can be used to determine the highest offer price for the given item. If a valid listing meets this price, the offer will attempt to settle and result in a sale of the item. Highest offer price cents will differ by region
  - `last_sold_listing_price_cents` (string): The last sold price in cents for the given parameters. This value can be used to determine the historical sales price of the given item. If a last sold price is higher than the current lowest price of the item, it is possible the item's price is trending downward. Likewise, if the lowest price of the item is higher than the last sold price, the item's sale price is trending upward. For a more detailed and historical view of the price trend, use the ListRecentSales endpoint. Last sold price will differ by region
  - `global_indicator_price_cents` (string): The global indicator price, in cents, for the given parameters. The global indicator is the current price at which the item can be priced at to be competitive in the global market. In regions of low sales volume, global indicator will help indicate the market price inclusive any transportation fees (Duties, taxes, etc). Listing your inventory at this prices helps ensure your price is competitive in the global market

**Important Notes:**
- All price fields are strings representing cents (e.g., "25000" = $250.00)
- Size must be in US sizing (use `us_size_equivalent` from catalog data)
- Unlike List Pricing Insights, this endpoint returns data for ONE specific variation only
- All parameters except `consigned` and `region_id` are required

---

#### GET /api/v1/pricing_insights/offer_histogram - Get Offer Price Distribution

Gets the offer spread for a given catalog ID, filterable by the provided parameters. The response contains histogram bins that represent price points and the count of offers at each price point, sorted from highest to lowest price. Bins are dynamically generated based on the current market data. You can use this endpoint to determine the depth and breadth of the spread of offers for a given item.

**Parameters:**

| Name | Type | Location | Description | Required |
|------|------|----------|-------------|----------|
| `catalog_id` | string | query | The unique ID that identifies the item in our catalog. You can search for catalog IDs by using the SearchCatalog endpoint. | Yes |
| `size` | number($double) | query | The US size. Please refer to the catalog's `allowed_sizes` for all supported sizes and their non-US equivalents. | Yes |
| `product_condition` | string | query | The requested product condition. Values: `PRODUCT_CONDITION_NEW`, `PRODUCT_CONDITION_USED`, `PRODUCT_CONDITION_NEW_WITH_DEFECTS` | Yes |
| `packaging_condition` | string | query | The requested packaging condition. Values: `PACKAGING_CONDITION_GOOD_CONDITION`, `PACKAGING_CONDITION_MISSING_LID`, `PACKAGING_CONDITION_BADLY_DAMAGED`, `PACKAGING_CONDITION_NO_ORIGINAL_BOX` | Yes |
| `region_id` | string | query | The region given. Not providing this parameter will return values for all regions (global). | No |

**Response (200 - Success):**

```json
{
  "offer_histogram": {
    "bins": [
      {
        "offer_price_cents": "25000",
        "count": "15"
      },
      {
        "offer_price_cents": "24500",
        "count": "8"
      },
      {
        "offer_price_cents": "24000",
        "count": "12"
      }
    ]
  }
}
```

**Response Schema:**

- `offer_histogram` (object): The offer histogram data
  - `bins` (array): The list of offer histogram bins, sorted from highest price to lowest price
    - `offer_price_cents` (string): The price of the histogram bin in cents (as string)
    - `count` (string): The number of offers at this price point (as string)

**Important Notes:**
- Bins are sorted from highest to lowest price
- Bins are dynamically generated based on current market data
- Both `offer_price_cents` and `count` are strings, not numbers
- Use this to understand offer depth and market liquidity at different price points
- **Feature Flag:** This endpoint was previously feature-flagged with `ALIAS_HISTOGRAMS_ENABLED`

---

#### GET /api/v1/pricing_insights/recent_sales - View Sales History

Lists the recent sales of a given catalog ID. Results are ordered chronologically with the most recent sales first. You can use this endpoint to determine historical pricing trends.

**Two Access Patterns:**

1. **Catalog Item Sales:** Filter by `catalog_id` (required), `region_id` (optional), and `consigned` (must be non-null). Use this pattern to analyze overall sales trends for a catalog item.
2. **Single Variant Sales:** Filter by `catalog_id` (required), `size` (required), `product_condition` (required), `packaging_condition` (required), `consigned` (optional), and `region_id` (optional). Use this pattern for detailed analysis of sales trends on a specific variant.

**Limits:**
- Default limit: 10 results
- When using pattern #2 with all filters: up to 200 results can be requested
- These limits are subject to change

**Parameters:**

| Name | Type | Location | Description | Required |
|------|------|----------|-------------|----------|
| `catalog_id` | string | query | The unique ID that identifies the item in our catalog. You can search for catalog IDs by using the SearchCatalog endpoint. | Yes |
| `size` | number($double) | query | The US size. Please refer to the catalog's `allowed_sizes` for all supported sizes and their non-US equivalents. If not provided, the endpoint will return sales across all sizes. | No |
| `limit` | string($int64) | query | Maximum number of sold products to return. Defaults to 10 if not specified. Maximum allowed value is 200 when all filter parameters are provided, otherwise limited to 10. These limits may change in future updates. | No |
| `product_condition` | string | query | An enum describing the condition of the sold product. Values: `PRODUCT_CONDITION_NEW`, `PRODUCT_CONDITION_USED`, `PRODUCT_CONDITION_NEW_WITH_DEFECTS` | No |
| `packaging_condition` | string | query | An enum describing the packaging of the sold product. Values: `PACKAGING_CONDITION_GOOD_CONDITION`, `PACKAGING_CONDITION_MISSING_LID`, `PACKAGING_CONDITION_BADLY_DAMAGED`, `PACKAGING_CONDITION_NO_ORIGINAL_BOX` | No |
| `consigned` | boolean | query | A boolean indicating whether the product was sold as consigned. | No |
| `region_id` | string | query | The region in which the products were sold. Defaults to global if none specified. | No |

**Response (200 - Success):**

```json
{
  "recent_sales": [
    {
      "purchased_at": "2025-12-09T21:30:42.285Z",
      "price_cents": "23500",
      "size": 10.5,
      "consigned": false,
      "catalog_id": "air-jordan-5-retro-grape-2025-hq7978-100"
    },
    {
      "purchased_at": "2025-12-09T18:15:22.123Z",
      "price_cents": "24000",
      "size": 10.5,
      "consigned": false,
      "catalog_id": "air-jordan-5-retro-grape-2025-hq7978-100"
    }
  ]
}
```

**Response Schema:**

- `recent_sales` (array): A list of RecentSales that match the given query parameters
  - `purchased_at` (string): The timestamp at which the product was sold. Represents UTC time since Unix epoch 1970-01-01T00:00:00Z. ISO 8601 format (e.g., "2025-12-09T21:30:42.285Z")
  - `price_cents` (string): The price in USD cents at which the product was sold (as string)
  - `size` (number): The US size. Please refer to the catalog's `allowed_sizes` for all supported sizes and their non-US equivalents
  - `consigned` (boolean): A boolean indicating whether the product was sold as consigned
  - `catalog_id` (string): The unique id that identifies the product in our catalog

**Important Notes:**
- Results are ordered chronologically with **most recent sales first**
- This is the **ONLY source of sales volume data** for Alias
- Use pattern #1 for broad analysis (all variants), pattern #2 for specific variant analysis
- Price is in cents as string (e.g., "23500" = $235.00)
- Maximum 200 results when all filters are provided, otherwise maximum 10
- **Feature Flag:** This endpoint was previously feature-flagged with `ALIAS_RECENT_SALES_ENABLED`
- **Critical for Volume Data:** This endpoint provides the only way to get historical sales volume and trends

---

## Regions

Alias supports multiple regions for pricing data. Region IDs are passed as string values in query parameters.

**Available Regions:**
- `'1'` = United States
- `'2'` = Europe
- `'3'` = United Kingdom

**Important Notes:**
- **All prices are returned in USD ($)** regardless of region
- Currency conversion will be handled separately (post-MVP)
- Empty/omitted `region_id` parameter = global pricing (all regions)
- Unlike StockX which uses different currencies per region, Alias standardizes on USD

**Historical Note:**
The `/regions` endpoint was previously broken (returned 415 error), so these regions were hardcoded. This may have been fixed, but the hardcoded values are confirmed correct.

---

