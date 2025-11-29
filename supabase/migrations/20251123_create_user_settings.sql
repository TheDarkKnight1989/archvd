-- Create user_settings table for storing user preferences
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- StockX Configuration
  stockx_seller_level INT DEFAULT 1 CHECK (stockx_seller_level >= 1 AND stockx_seller_level <= 5),
  stockx_shipping_fee DECIMAL(10, 2) DEFAULT 0.00,

  -- General Preferences (extensible for future settings)
  currency_preference TEXT DEFAULT 'GBP',
  timezone TEXT DEFAULT 'Europe/London',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one row per user
  UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- Enable RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own settings
CREATE POLICY "Users can view own settings"
  ON user_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON user_settings TO authenticated;

COMMENT ON TABLE user_settings IS 'User-specific settings and preferences';
COMMENT ON COLUMN user_settings.stockx_seller_level IS 'StockX seller level (1-5) affecting transaction fee rates';
COMMENT ON COLUMN user_settings.stockx_shipping_fee IS 'Custom shipping fee for StockX listings';
