-- Quick fix: Add missing platform values to sale_platform enum
-- Run this directly in Supabase Dashboard SQL Editor

-- Add goat (critical for Alias platform)
ALTER TYPE sale_platform ADD VALUE IF NOT EXISTS 'goat';

-- Add other new platforms
ALTER TYPE sale_platform ADD VALUE IF NOT EXISTS 'instagram';
ALTER TYPE sale_platform ADD VALUE IF NOT EXISTS 'tiktok';
ALTER TYPE sale_platform ADD VALUE IF NOT EXISTS 'vinted';
ALTER TYPE sale_platform ADD VALUE IF NOT EXISTS 'depop';

-- Verify all values exist
SELECT enumlabel as platform
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sale_platform')
ORDER BY enumlabel;
