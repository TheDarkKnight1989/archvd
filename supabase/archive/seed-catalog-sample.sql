-- Seed sample catalog and market data for autofill testing
-- Run this in Supabase SQL Editor

-- 1. Seed product catalog (for autofill: brand, model, colorway)
INSERT INTO public.product_catalog (sku, brand, model, colorway, image_url, retail_price, currency, created_at, updated_at)
VALUES
  ('DZ5485-612', 'Jordan', 'Air Jordan 1 High OG', 'Satin Bred', 'https://images.stockx.com/images/Air-Jordan-1-High-OG-Satin-Bred-W-Product.jpg', 169.00, 'GBP', NOW(), NOW()),
  ('DD1391-100', 'Nike', 'Dunk Low', 'White Black Panda', 'https://images.stockx.com/images/Nike-Dunk-Low-White-Black-2021-Product.jpg', 100.00, 'GBP', NOW(), NOW()),
  ('CT8527-016', 'Jordan', 'Air Jordan 4 Retro', 'Bred Reimagined', 'https://images.stockx.com/images/Air-Jordan-4-Retro-Bred-Reimagined-Product.jpg', 189.00, 'GBP', NOW(), NOW()),
  ('555088-063', 'Jordan', 'Air Jordan 1 High OG', 'Shadow 2.0', 'https://images.stockx.com/images/Air-Jordan-1-Retro-High-OG-Shadow-2-0-Product.jpg', 149.00, 'GBP', NOW(), NOW()),
  ('FD0774-025', 'Nike', 'Air Force 1 Low', 'Triple White', 'https://images.stockx.com/images/Nike-Air-Force-1-Low-White-07-Product.jpg', 89.00, 'GBP', NOW(), NOW())
ON CONFLICT (sku) 
DO UPDATE SET 
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  colorway = EXCLUDED.colorway,
  image_url = EXCLUDED.image_url,
  retail_price = EXCLUDED.retail_price,
  updated_at = NOW();

-- 2. Seed market prices (for market preview: "Market: £...")
INSERT INTO public.product_market_prices (sku, size, source, currency, price, as_of, meta, created_at)
VALUES
  ('DZ5485-612', 'UK9', 'stockx', 'GBP', 225.00, NOW() - INTERVAL '2 hours', '{"confidence":"high","lastSale":"2024-01-15T10:30:00Z"}', NOW()),
  ('DD1391-100', 'UK8', 'stockx', 'GBP', 140.00, NOW() - INTERVAL '3 hours', '{"confidence":"high","lastSale":"2024-01-15T09:15:00Z"}', NOW()),
  ('CT8527-016', 'UK9', 'stockx', 'GBP', 310.00, NOW() - INTERVAL '4 hours', '{"confidence":"medium","lastSale":"2024-01-14T16:45:00Z"}', NOW()),
  ('555088-063', 'UK10', 'stockx', 'GBP', 185.00, NOW() - INTERVAL '5 hours', '{"confidence":"high","lastSale":"2024-01-15T08:00:00Z"}', NOW()),
  ('FD0774-025', 'UK9', 'stockx', 'GBP', 95.00, NOW() - INTERVAL '1 hour', '{"confidence":"high","lastSale":"2024-01-15T11:00:00Z"}', NOW())
ON CONFLICT (sku, size, source, as_of) 
DO NOTHING;

-- 3. Optional: Seed catalog_cache (if your /api/pricing/quick reads from here)
-- This is a fallback if product_catalog isn't checked first
INSERT INTO public.catalog_cache (sku, brand, model, colorway, image_url, cached_at)
VALUES
  ('DZ5485-612', 'Jordan', 'Air Jordan 1 High OG', 'Satin Bred', 'https://images.stockx.com/images/Air-Jordan-1-High-OG-Satin-Bred-W-Product.jpg', NOW()),
  ('DD1391-100', 'Nike', 'Dunk Low', 'White Black Panda', 'https://images.stockx.com/images/Nike-Dunk-Low-White-Black-2021-Product.jpg', NOW()),
  ('CT8527-016', 'Jordan', 'Air Jordan 4 Retro', 'Bred Reimagined', 'https://images.stockx.com/images/Air-Jordan-4-Retro-Bred-Reimagined-Product.jpg', NOW()),
  ('555088-063', 'Jordan', 'Air Jordan 1 High OG', 'Shadow 2.0', 'https://images.stockx.com/images/Air-Jordan-1-Retro-High-OG-Shadow-2-0-Product.jpg', NOW()),
  ('FD0774-025', 'Nike', 'Air Force 1 Low', 'Triple White', 'https://images.stockx.com/images/Nike-Air-Force-1-Low-White-07-Product.jpg', NOW())
ON CONFLICT (sku) 
DO UPDATE SET 
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  colorway = EXCLUDED.colorway,
  image_url = EXCLUDED.image_url,
  cached_at = NOW();

-- Verify data was inserted
SELECT 'Product Catalog Count:' as info, COUNT(*) as count FROM public.product_catalog
UNION ALL
SELECT 'Market Prices Count:', COUNT(*) FROM public.product_market_prices
UNION ALL
SELECT 'Catalog Cache Count:', COUNT(*) FROM public.catalog_cache;
