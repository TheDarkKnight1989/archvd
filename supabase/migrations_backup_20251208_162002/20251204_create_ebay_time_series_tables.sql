-- ============================================================================
-- eBay Time-Series Architecture (Phase 1)
-- ============================================================================
-- Creates transaction-based storage for eBay sold items with:
-- - Individual sale records (ebay_sold_transactions)
-- - Computed rolling medians and metrics (ebay_computed_metrics)
-- - GENERATED included_in_metrics column with strict Smart Archived Price rules
-- ============================================================================

-- ============================================================================
-- TABLE: ebay_sold_transactions
-- ============================================================================
-- Purpose: Store EVERY individual sale from eBay Browse API
-- One row per sold item (not aggregated)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ebay_sold_transactions (
  -- Primary key
  id BIGSERIAL PRIMARY KEY,

  -- Provider identification
  ebay_item_id TEXT NOT NULL, -- eBay's itemId (e.g., "v1|127541998565|0")
  marketplace_id TEXT NOT NULL DEFAULT 'EBAY_GB', -- EBAY_US, EBAY_GB, EBAY_DE, etc.

  -- Product identification (extracted)
  sku TEXT NOT NULL, -- Extracted from title or provided by search query
  size_key TEXT, -- Normalized size (e.g., "US 10.5", "UK 11.5")
  size_numeric DECIMAL, -- Numeric size for sorting (e.g., 10.5)
  size_system TEXT, -- US, UK, EU, or NULL if unknown
  size_confidence DECIMAL CHECK (size_confidence >= 0 AND size_confidence <= 1), -- 0.0-1.0 score

  -- Transaction details
  sale_price_cents INTEGER NOT NULL, -- Sale price in cents (native currency)
  currency_code TEXT NOT NULL, -- GBP, USD, EUR, etc.
  sold_at TIMESTAMPTZ NOT NULL, -- When the item sold (itemEndDate)

  -- eBay metadata
  condition_id TEXT, -- '1000' = NEW, '1500' = NEW_WITH_DEFECTS, etc.
  category_id TEXT, -- eBay category
  authenticity_guarantee BOOLEAN DEFAULT FALSE, -- From qualifiedPrograms

  -- Seller info (for confidence scoring)
  seller_feedback_score INTEGER, -- Seller reputation
  seller_feedback_percentage DECIMAL, -- Seller positive feedback %

  -- Shipping info (for total cost analysis)
  shipping_cost_cents INTEGER, -- Cheapest shipping option in cents

  -- Outlier detection (computed after aggregation)
  is_outlier BOOLEAN DEFAULT FALSE, -- Flagged by IQR detection
  outlier_reason TEXT, -- 'price_too_high', 'price_too_low', etc.

  -- Exclusion logic (determines included_in_metrics)
  exclusion_reason TEXT, -- Why this row is excluded (if applicable)

  -- CRITICAL: included_in_metrics GENERATED COLUMN
  -- Only rows meeting Smart Archived Price criteria are included
  included_in_metrics BOOLEAN GENERATED ALWAYS AS (
    condition_id = '1000' AND -- ONLY NEW condition
    authenticity_guarantee = TRUE AND -- ONLY AG items
    size_key IS NOT NULL AND -- Must have size
    size_system IS NOT NULL AND -- Must have known system
    size_confidence = 1.0 AND -- ONLY HIGH confidence (variation-sourced, not title-parsed)
    is_outlier = FALSE AND -- Not an outlier
    exclusion_reason IS NULL -- No other exclusions
  ) STORED,

  -- Metadata
  raw_response JSONB, -- Full eBay API response excerpt
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one transaction per eBay item ID
  CONSTRAINT uq_ebay_sold_transaction UNIQUE (ebay_item_id, marketplace_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ebay_transactions_sku_size ON ebay_sold_transactions(sku, size_key, currency_code);
CREATE INDEX IF NOT EXISTS idx_ebay_transactions_sold_at ON ebay_sold_transactions(sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_ebay_transactions_included ON ebay_sold_transactions(included_in_metrics) WHERE included_in_metrics = TRUE;
CREATE INDEX IF NOT EXISTS idx_ebay_transactions_marketplace ON ebay_sold_transactions(marketplace_id, sku, size_key);

COMMENT ON TABLE ebay_sold_transactions IS 'Individual eBay sold item transactions for time-series analysis';
COMMENT ON COLUMN ebay_sold_transactions.included_in_metrics IS 'GENERATED: TRUE only for AG + NEW (1000) + size-specific + HIGH confidence (1.0) from variations';
COMMENT ON COLUMN ebay_sold_transactions.size_confidence IS 'Confidence score: HIGH=1.0 (from variations), MEDIUM=0.70 (title), LOW=0.30 (ambiguous)';
COMMENT ON COLUMN ebay_sold_transactions.exclusion_reason IS 'Why excluded: not_new_condition, size_system_unknown, missing_size, size_not_from_variations, etc.';

-- ============================================================================
-- TABLE: ebay_computed_metrics
-- ============================================================================
-- Purpose: Store computed rolling medians and confidence scores per (SKU, size)
-- Updated periodically (e.g., after each sync or daily)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ebay_computed_metrics (
  -- Primary key
  id BIGSERIAL PRIMARY KEY,

  -- Product identification
  sku TEXT NOT NULL,
  size_key TEXT NOT NULL, -- Normalized size (e.g., "US 10.5")
  size_system TEXT, -- US, UK, EU
  currency_code TEXT NOT NULL, -- Currency for all prices
  marketplace_id TEXT NOT NULL DEFAULT 'EBAY_GB',

  -- Rolling median prices (in cents, native currency)
  median_72h_cents INTEGER, -- 72-hour median (last 3 days)
  median_7d_cents INTEGER, -- 7-day median
  median_30d_cents INTEGER, -- 30-day median
  median_90d_cents INTEGER, -- 90-day median (full eBay window)

  -- Sample sizes (how many included sales in each window)
  sample_size_72h INTEGER DEFAULT 0,
  sample_size_7d INTEGER DEFAULT 0,
  sample_size_30d INTEGER DEFAULT 0,
  sample_size_90d INTEGER DEFAULT 0,

  -- Price ranges (for volatility analysis)
  min_price_90d_cents INTEGER, -- Lowest price in 90d
  max_price_90d_cents INTEGER, -- Highest price in 90d

  -- Volatility (coefficient of variation: stddev / mean)
  volatility_90d DECIMAL, -- 0.0 = stable, >0.5 = highly volatile

  -- Liquidity score (0-100, based on sample sizes and recency)
  liquidity_score DECIMAL CHECK (liquidity_score >= 0 AND liquidity_score <= 100),

  -- Confidence score (0-100, based on sample size, volatility, recency, outlier ratio)
  confidence_score DECIMAL CHECK (confidence_score >= 0 AND confidence_score <= 100),

  -- Outlier statistics
  total_sales_90d INTEGER DEFAULT 0, -- Total sales (included + outliers)
  outlier_count_90d INTEGER DEFAULT 0, -- How many flagged as outliers
  outlier_ratio_90d DECIMAL, -- outlier_count / total_sales

  -- Metadata
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sale_at TIMESTAMPTZ, -- Most recent sale timestamp

  -- Unique constraint: one metrics row per (sku, size, currency, marketplace)
  CONSTRAINT uq_ebay_computed_metrics UNIQUE (sku, size_key, currency_code, marketplace_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ebay_metrics_sku_size ON ebay_computed_metrics(sku, size_key);
CREATE INDEX IF NOT EXISTS idx_ebay_metrics_confidence ON ebay_computed_metrics(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_ebay_metrics_marketplace ON ebay_computed_metrics(marketplace_id, sku);

COMMENT ON TABLE ebay_computed_metrics IS 'Computed rolling medians and confidence scores for eBay market data';
COMMENT ON COLUMN ebay_computed_metrics.median_72h_cents IS 'Used as last_sale_price in master_market_data';
COMMENT ON COLUMN ebay_computed_metrics.confidence_score IS '0-100 score based on sample size, volatility, recency, outlier ratio';
COMMENT ON COLUMN ebay_computed_metrics.liquidity_score IS '0-100 score based on sales frequency and recency';
