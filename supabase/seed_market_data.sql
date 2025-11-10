-- Seed Market & Releases Data (run with service role)
-- This script populates sample catalog entries and market prices for demo

-- ============================================================================
-- Sample FX Rates (GBP/EUR only - new schema)
-- ============================================================================
-- Note: eur_per_gbp is auto-calculated as 1.0 / gbp_per_eur
insert into fx_rates (as_of, gbp_per_eur, meta) values
  (CURRENT_DATE, 0.85, '{"source": "seed"}'::jsonb)
on conflict (as_of) do update set
  gbp_per_eur = excluded.gbp_per_eur,
  meta = excluded.meta;

-- ============================================================================
-- Sample Product Catalog (20 popular sneakers)
-- ============================================================================
insert into product_catalog (sku, brand, model, colorway, release_date, retail_price, retail_currency, slug) values
  ('DZ5485-410', 'Nike', 'Air Jordan 1 High', 'University Blue', '2021-03-06', 139.95, 'GBP', 'air-jordan-1-high-university-blue'),
  ('555088-134', 'Nike', 'Air Jordan 1 Retro High', 'Chicago Lost & Found', '2022-11-19', 159.95, 'GBP', 'air-jordan-1-chicago-lost-and-found'),
  ('DD1391-100', 'Nike', 'Dunk Low', 'Panda', '2021-03-10', 89.95, 'GBP', 'nike-dunk-low-panda'),
  ('DV0833-102', 'Nike', 'Air Jordan 4', 'Military Black', '2023-05-13', 179.95, 'GBP', 'air-jordan-4-military-black'),
  ('FD0690-001', 'Nike', 'Travis Scott x Air Jordan 1 Low', 'Olive', '2023-07-21', 119.95, 'GBP', 'travis-scott-air-jordan-1-low-olive'),

  ('IF3571', 'adidas', 'Yeezy Boost 350 V2', 'Onyx', '2022-04-02', 189.95, 'GBP', 'yeezy-boost-350-v2-onyx'),
  ('GY7657', 'adidas', 'Yeezy Slide', 'Bone', '2021-12-13', 54.95, 'GBP', 'yeezy-slide-bone'),
  ('HQ4540', 'adidas', 'Samba OG', 'Cloud White Core Black', '2023-01-01', 84.95, 'GBP', 'adidas-samba-og-cloud-white'),

  ('M990GL6', 'New Balance', '990v6', 'Grey', '2023-02-15', 159.95, 'GBP', 'new-balance-990v6-grey'),
  ('M2002RDA', 'New Balance', '2002R', 'Protection Pack Rain Cloud', '2022-08-19', 129.95, 'GBP', 'new-balance-2002r-rain-cloud'),

  ('SPLY-350-CREAM', 'adidas', 'Yeezy Boost 350 V2', 'Cream White', '2017-04-29', 179.95, 'GBP', 'yeezy-boost-350-v2-cream'),
  ('CT8532-102', 'Nike', 'Air Jordan 1 High', 'Dark Mocha', '2020-10-31', 139.95, 'GBP', 'air-jordan-1-high-dark-mocha'),
  ('DH6927-061', 'Nike', 'Dunk Low', 'Grey Fog', '2021-05-21', 89.95, 'GBP', 'nike-dunk-low-grey-fog'),

  ('FB8894-133', 'Nike', 'SB Dunk Low', 'Jarritos', '2024-01-20', 99.95, 'GBP', 'sb-dunk-low-jarritos'),
  ('DC4244-001', 'Nike', 'Air Jordan 3', 'Cardinal Red', '2022-05-21', 169.95, 'GBP', 'air-jordan-3-cardinal-red'),

  ('BB550PWB', 'New Balance', '550', 'White Green', '2021-01-01', 89.95, 'GBP', 'new-balance-550-white-green'),
  ('M1906RPA', 'New Balance', '1906R', 'Protection Pack Navy', '2023-03-31', 129.95, 'GBP', 'new-balance-1906r-navy'),

  ('FB8792-200', 'Nike', 'Air Jordan 1 Low', 'Mocha', '2023-07-01', 109.95, 'GBP', 'air-jordan-1-low-mocha'),
  ('DV3854-200', 'Nike', 'Air Jordan 2 Low', 'Melon Tint', '2023-03-09', 119.95, 'GBP', 'air-jordan-2-low-melon-tint'),
  ('HQ6316', 'adidas', 'Gazelle Indoor', 'Dark Green', '2023-09-01', 89.95, 'GBP', 'adidas-gazelle-indoor-dark-green')
on conflict (sku) do nothing;

-- ============================================================================
-- Sample Market Prices (per-size pricing for select SKUs)
-- ============================================================================

-- Air Jordan 1 High University Blue (DZ5485-410)
insert into product_market_prices (sku, size, source, currency, price, as_of) values
  ('DZ5485-410', 'UK8', 'mock-stockx', 'GBP', 410, now() - interval '1 day'),
  ('DZ5485-410', 'UK8.5', 'mock-stockx', 'GBP', 390, now() - interval '1 day'),
  ('DZ5485-410', 'UK9', 'mock-stockx', 'GBP', 405, now() - interval '1 day'),
  ('DZ5485-410', 'UK9.5', 'mock-stockx', 'GBP', 420, now() - interval '1 day'),
  ('DZ5485-410', 'UK10', 'mock-stockx', 'GBP', 430, now() - interval '1 day'),
  ('DZ5485-410', 'UK10.5', 'mock-stockx', 'GBP', 415, now() - interval '1 day'),
  ('DZ5485-410', 'UK11', 'mock-stockx', 'GBP', 408, now() - interval '1 day');

-- Air Jordan 1 Chicago Lost & Found (555088-134)
insert into product_market_prices (sku, size, source, currency, price, as_of) values
  ('555088-134', 'UK8', 'mock-stockx', 'GBP', 330, now()),
  ('555088-134', 'UK8.5', 'mock-stockx', 'GBP', 345, now()),
  ('555088-134', 'UK9', 'mock-stockx', 'GBP', 355, now()),
  ('555088-134', 'UK9.5', 'mock-stockx', 'GBP', 368, now()),
  ('555088-134', 'UK10', 'mock-stockx', 'GBP', 380, now()),
  ('555088-134', 'UK10.5', 'mock-stockx', 'GBP', 372, now()),
  ('555088-134', 'UK11', 'mock-stockx', 'GBP', 365, now());

-- Nike Dunk Low Panda (DD1391-100)
insert into product_market_prices (sku, size, source, currency, price, as_of) values
  ('DD1391-100', 'UK8', 'mock-stockx', 'GBP', 99, now()),
  ('DD1391-100', 'UK8.5', 'mock-stockx', 'GBP', 101, now()),
  ('DD1391-100', 'UK9', 'mock-stockx', 'GBP', 107, now()),
  ('DD1391-100', 'UK9.5', 'mock-stockx', 'GBP', 109, now()),
  ('DD1391-100', 'UK10', 'mock-stockx', 'GBP', 112, now()),
  ('DD1391-100', 'UK10.5', 'mock-stockx', 'GBP', 111, now()),
  ('DD1391-100', 'UK11', 'mock-stockx', 'GBP', 108, now());

-- Travis Scott x Air Jordan 1 Low Olive (FD0690-001)
insert into product_market_prices (sku, size, source, currency, price, as_of) values
  ('FD0690-001', 'UK8', 'mock-stockx', 'GBP', 990, now()),
  ('FD0690-001', 'UK8.5', 'mock-stockx', 'GBP', 1010, now()),
  ('FD0690-001', 'UK9', 'mock-stockx', 'GBP', 1045, now()),
  ('FD0690-001', 'UK9.5', 'mock-stockx', 'GBP', 1070, now()),
  ('FD0690-001', 'UK10', 'mock-stockx', 'GBP', 1090, now()),
  ('FD0690-001', 'UK10.5', 'mock-stockx', 'GBP', 1045, now()),
  ('FD0690-001', 'UK11', 'mock-stockx', 'GBP', 1020, now());

-- Yeezy Boost 350 V2 Onyx (IF3571)
insert into product_market_prices (sku, size, source, currency, price, as_of) values
  ('IF3571', 'UK8', 'mock-stockx', 'GBP', 146, now()),
  ('IF3571', 'UK8.5', 'mock-stockx', 'GBP', 150, now()),
  ('IF3571', 'UK9', 'mock-stockx', 'GBP', 154, now()),
  ('IF3571', 'UK9.5', 'mock-stockx', 'GBP', 158, now()),
  ('IF3571', 'UK10', 'mock-stockx', 'GBP', 162, now()),
  ('IF3571', 'UK10.5', 'mock-stockx', 'GBP', 157, now()),
  ('IF3571', 'UK11', 'mock-stockx', 'GBP', 153, now());

-- New Balance 990v6 Grey (M990GL6)
insert into product_market_prices (sku, size, source, currency, price, as_of) values
  ('M990GL6', 'UK8', 'mock-stockx', 'GBP', 166, now()),
  ('M990GL6', 'UK8.5', 'mock-stockx', 'GBP', 170, now()),
  ('M990GL6', 'UK9', 'mock-stockx', 'GBP', 174, now()),
  ('M990GL6', 'UK9.5', 'mock-stockx', 'GBP', 178, now()),
  ('M990GL6', 'UK10', 'mock-stockx', 'GBP', 182, now()),
  ('M990GL6', 'UK10.5', 'mock-stockx', 'GBP', 176, now()),
  ('M990GL6', 'UK11', 'mock-stockx', 'GBP', 172, now());

-- ============================================================================
-- Sample Releases (upcoming launches)
-- ============================================================================
-- Note: Releases table schema: brand, model, colorway, release_date, source, source_url, image_url, slug, status, meta
insert into releases (brand, model, colorway, release_date, source, status, meta) values
  ('Nike', 'Air Jordan 1 High', 'Bred Patent', '2025-02-08', 'nike', 'upcoming', '{"retail_price": 159.95, "currency": "GBP", "regions": ["UK", "EU"]}'::jsonb),
  ('Nike', 'Air Jordan 1 High', 'Lost & Found', '2025-01-25', 'nike', 'upcoming', '{"retail_price": 159.95, "currency": "GBP", "regions": ["UK", "EU"]}'::jsonb),
  ('Nike', 'Dunk Low', 'Black White', '2025-01-18', 'nike', 'upcoming', '{"retail_price": 99.95, "currency": "GBP", "regions": ["UK", "EU"]}'::jsonb),

  ('adidas', 'Yeezy Boost 700', 'Wave Runner', '2025-02-15', 'size', 'upcoming', '{"retail_price": 249.95, "currency": "GBP", "regions": ["UK", "EU"]}'::jsonb),
  ('adidas', 'Samba OG', 'Triple Black', '2025-01-30', 'size', 'upcoming', '{"retail_price": 84.95, "currency": "GBP", "regions": ["UK", "EU"]}'::jsonb),

  ('New Balance', '1906R', 'White Blue', '2025-02-01', 'size', 'upcoming', '{"retail_price": 129.95, "currency": "GBP", "regions": ["UK"]}'::jsonb),
  ('New Balance', '550', 'White Navy', '2025-01-22', 'size', 'upcoming', '{"retail_price": 89.95, "currency": "GBP", "regions": ["UK", "EU"]}'::jsonb),

  ('Nike', 'Air Jordan 3', 'Cardinal Red', '2025-03-15', 'footpatrol', 'upcoming', '{"retail_price": 179.95, "currency": "GBP", "regions": ["UK"]}'::jsonb),
  ('Nike', 'Air Jordan 1 Low', 'Shadow', '2025-02-22', 'nike', 'upcoming', '{"retail_price": 109.95, "currency": "GBP", "regions": ["UK", "EU"]}'::jsonb),
  ('adidas', 'Gazelle Indoor', 'Burgundy', '2025-01-28', 'size', 'upcoming', '{"retail_price": 89.95, "currency": "GBP", "regions": ["UK", "EU"]}'::jsonb)
on conflict (brand, model, colorway, release_date, source) do nothing;
