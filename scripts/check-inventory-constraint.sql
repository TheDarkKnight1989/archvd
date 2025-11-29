-- Check the actual constraint on the Inventory table
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname = 'Inventory_platform_check';

-- Also check what the platform column type is
SELECT
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'Inventory'
  AND column_name = 'platform';
