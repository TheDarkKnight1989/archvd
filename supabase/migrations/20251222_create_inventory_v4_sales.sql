-- Migration: Create inventory_v4_sales table
-- Date: 2025-12-22
-- Description: V4 sales table - separate from items for clean sold item tracking

-- Drop if exists for idempotency
DROP TABLE IF EXISTS inventory_v4_sales CASCADE;

-- Create the sales table
CREATE TABLE inventory_v4_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Product info (denormalized snapshot at time of sale)
  style_id TEXT NOT NULL,
  sku TEXT,
  brand TEXT,
  model TEXT,
  colorway TEXT,
  image_url TEXT,
  category TEXT,

  -- Size info
  size TEXT NOT NULL,
  size_unit TEXT NOT NULL DEFAULT 'UK',

  -- Purchase details (for profit calculation)
  purchase_price NUMERIC(10,2),
  purchase_currency TEXT DEFAULT 'GBP',
  purchase_date DATE,
  purchase_total NUMERIC(10,2), -- includes tax + shipping
  condition TEXT CHECK (condition IN ('New', 'Used', 'Worn', 'Defect')),

  -- Sale details
  sold_price NUMERIC(10,2) NOT NULL,
  sale_currency TEXT NOT NULL DEFAULT 'GBP',
  sold_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  platform TEXT CHECK (platform IN ('stockx', 'goat', 'ebay', 'instagram', 'tiktok', 'vinted', 'depop', 'private', 'other')),
  sales_fee NUMERIC(10,2) DEFAULT 0,
  shipping_cost NUMERIC(10,2) DEFAULT 0,

  -- FX snapshot at time of sale
  base_currency TEXT DEFAULT 'GBP',
  fx_rate_to_base NUMERIC(12,6) DEFAULT 1,
  sold_price_base NUMERIC(10,2), -- sold_price converted to base currency

  -- Metadata
  notes TEXT,
  original_item_id UUID, -- Reference to original inventory_v4_items row (for audit trail)
  location TEXT,
  tags TEXT[],

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_v4_sales_user_id ON inventory_v4_sales(user_id);
CREATE INDEX idx_v4_sales_sold_date ON inventory_v4_sales(sold_date DESC);
CREATE INDEX idx_v4_sales_style_id ON inventory_v4_sales(style_id);
CREATE INDEX idx_v4_sales_platform ON inventory_v4_sales(platform);
CREATE INDEX idx_v4_sales_user_sold_date ON inventory_v4_sales(user_id, sold_date DESC);

-- Enable RLS
ALTER TABLE inventory_v4_sales ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own sales"
  ON inventory_v4_sales FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sales"
  ON inventory_v4_sales FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sales"
  ON inventory_v4_sales FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sales"
  ON inventory_v4_sales FOR DELETE
  USING (auth.uid() = user_id);

-- Service role bypass for admin operations
CREATE POLICY "Service role full access"
  ON inventory_v4_sales FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Add comment
COMMENT ON TABLE inventory_v4_sales IS 'V4 sales table - immutable record of sold items with denormalized product info';
