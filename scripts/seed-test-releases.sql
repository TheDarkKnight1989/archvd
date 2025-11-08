-- Test data for releases table
-- Run this in Supabase SQL Editor to see the UI working

INSERT INTO releases (source, external_id, title, brand, model, colorway, sku, release_date, price_gbp, image_url, product_url, retailers, status)
VALUES
  (
    'thedropdate',
    'nike-dunk-low-panda',
    'Nike Dunk Low Retro "Panda"',
    'Nike',
    'Dunk Low Retro',
    'Panda',
    'DD1391-100',
    '2025-01-15T00:00:00Z',
    110.00,
    'https://static.nike.com/a/images/t_PDP_1280_v1/f_auto,q_auto:eco/350e7f3a-979a-402b-9396-a8a998dd76ab/dunk-low-retro-shoes-66RGqF.png',
    'https://thedropdate.com/releases/nike-dunk-low-panda',
    '[{"name": "Nike SNKRS", "url": "https://www.nike.com/gb/t/dunk-low-retro-shoes-66RGqF"}]'::jsonb,
    'upcoming'
  ),
  (
    'thedropdate',
    'jordan-1-high-chicago',
    'Air Jordan 1 Retro High OG "Chicago Lost and Found"',
    'Jordan',
    'Air Jordan 1 Retro High OG',
    'Chicago Lost and Found',
    'DZ5485-612',
    '2024-11-01T00:00:00Z',
    169.99,
    'https://static.nike.com/a/images/t_PDP_1280_v1/f_auto,q_auto:eco/024bd115-660f-402f-b77e-e0edd1a86c8d/air-jordan-1-retro-high-og-shoes-JMJ8tJ.png',
    'https://thedropdate.com/releases/jordan-1-chicago',
    '[{"name": "Size?", "url": "https://www.size.co.uk"}]'::jsonb,
    'dropped'
  ),
  (
    'thedropdate',
    'adidas-yeezy-slide-onyx',
    'adidas Yeezy Slide "Onyx"',
    'adidas',
    'Yeezy Slide',
    'Onyx',
    'HQ6448',
    '2025-02-20T00:00:00Z',
    55.00,
    'https://assets.adidas.com/images/w_600,f_auto,q_auto/dff70f97d1094b08b23cad7e00e8c0c8_9366/Yeezy_Slide_Onyx_Black_HQ6448_01_standard.jpg',
    'https://thedropdate.com/releases/yeezy-slide-onyx',
    '[{"name": "adidas", "url": "https://www.adidas.co.uk"}]'::jsonb,
    'upcoming'
  ),
  (
    'thedropdate',
    'new-balance-2002r-protection-pack',
    'New Balance 2002R "Protection Pack - Rain Cloud"',
    'New Balance',
    '2002R',
    'Protection Pack - Rain Cloud',
    'M2002RDA',
    NULL,
    139.99,
    'https://nb.scene7.com/is/image/NB/m2002rda_nb_02_i?$pdpflexf2$',
    'https://thedropdate.com/releases/nb-2002r-protection',
    '[{"name": "New Balance", "url": "https://www.newbalance.co.uk"}]'::jsonb,
    'tba'
  ),
  (
    'thedropdate',
    'asics-gel-lyte-iii-og-white-classic-red',
    'ASICS Gel-Lyte III OG "White/Classic Red"',
    'ASICS',
    'Gel-Lyte III OG',
    'White/Classic Red',
    '1201A909-100',
    '2025-01-10T00:00:00Z',
    120.00,
    'https://images.asics.com/is/image/asics/1201A909_100_SR_RT_GLB?$zoom$',
    'https://thedropdate.com/releases/asics-gel-lyte-iii-white-red',
    '[{"name": "Footpatrol", "url": "https://www.footpatrol.com"}]'::jsonb,
    'upcoming'
  );
