import { createClient } from '@supabase/supabase-js';

// ============================================================================
// 1) PROVE TOKEN IS LOADED
// ============================================================================

console.log('=== 1) ENV VARS LOADED IN THIS PROCESS ===\n');

const aliasEnvVars = Object.keys(process.env).filter(k =>
  k.toLowerCase().includes('alias')
);

console.log('Alias-related env vars found:', aliasEnvVars);

for (const key of aliasEnvVars) {
  const value = process.env[key] || '';
  const masked = value.length > 8
    ? value.slice(0, 4) + '...' + value.slice(-4) + ` (len=${value.length})`
    : value.length > 0 ? `[SET, len=${value.length}]` : '[EMPTY]';
  console.log(`  ${key}: ${masked}`);
}

const ALIAS_PAT = process.env.ALIAS_PAT;
const ALIAS_BASE_URL = 'https://api.alias.org/api/v1';

console.log('\nBase URL from code:', ALIAS_BASE_URL);
console.log('ALIAS_PAT loaded:', ALIAS_PAT ? 'YES' : 'NO');
if (ALIAS_PAT) {
  console.log('ALIAS_PAT prefix:', ALIAS_PAT.slice(0, 10) + '...');
  console.log('ALIAS_PAT length:', ALIAS_PAT.length);
}

// ============================================================================
// 2) REPRODUCE FAILING REQUEST WITH DEBUG
// ============================================================================

console.log('\n=== 2) REPRODUCE FAILING REQUEST ===\n');

const testCatalogId = 'nike-dunk-low-retro-white-black-dd1391-100';
const testUrl = `${ALIAS_BASE_URL}/catalog/${testCatalogId}`;

console.log('Request URL:', testUrl);
console.log('Request Method:', 'GET');

const headers: Record<string, string> = {
  'Authorization': `Bearer ${ALIAS_PAT}`,
  'Accept': 'application/json',
};

console.log('Headers:');
for (const [key, value] of Object.entries(headers)) {
  if (key === 'Authorization') {
    const scheme = value.split(' ')[0];
    const tokenPreview = value.split(' ')[1]?.slice(0, 10) + '...';
    console.log(`  ${key}: ${scheme} ${tokenPreview}`);
  } else {
    console.log(`  ${key}: ${value}`);
  }
}

async function testRequest() {
  console.log('\nMaking request...');

  try {
    const response = await fetch(testUrl, {
      method: 'GET',
      headers,
    });

    console.log('\nResponse Status:', response.status, response.statusText);
    console.log('Response Headers:');
    response.headers.forEach((value, key) => {
      if (['content-type', 'www-authenticate', 'x-request-id'].includes(key.toLowerCase())) {
        console.log(`  ${key}: ${value}`);
      }
    });

    const body = await response.text();
    console.log('Response Body:', body.slice(0, 500));

    return response.status;
  } catch (error: any) {
    console.log('Fetch Error:', error.message);
    return 0;
  }
}

// ============================================================================
// 3) CURL COMMAND FOR INDEPENDENT VALIDATION
// ============================================================================

function printCurlCommand() {
  console.log('\n=== 3) CURL COMMAND FOR INDEPENDENT VALIDATION ===\n');
  console.log('Run this exact curl command to test independently:');
  console.log('');
  console.log(`curl -v "${testUrl}" \\`);
  console.log(`  -H "Authorization: Bearer $ALIAS_PAT" \\`);
  console.log(`  -H "Accept: application/json"`);
  console.log('');
}

// ============================================================================
// 4) CONFIRM DB STATE
// ============================================================================

async function checkDbState() {
  console.log('\n=== 4) CONFIRM DB STATE ===\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Row count
  const { count } = await supabase
    .from('inventory_v4_alias_sales_history')
    .select('*', { count: 'exact', head: true });

  console.log('inventory_v4_alias_sales_history row count:', count);
  console.log('(Expected: 0 after TRUNCATE)');

  // Constraint check - we can't query pg_constraint, but we can test
  console.log('\nUnique constraint check: Run in SQL Editor:');
  console.log(`  SELECT conname FROM pg_constraint WHERE conrelid = 'inventory_v4_alias_sales_history'::regclass AND contype = 'u';`);
}

// ============================================================================
// RUN ALL
// ============================================================================

async function main() {
  const status = await testRequest();
  printCurlCommand();
  await checkDbState();

  console.log('\n=== SUMMARY ===\n');
  if (status === 401) {
    console.log('ROOT CAUSE: API returned 401 - Token authentication failed');
    console.log('');
    console.log('Possible causes:');
    console.log('  1. ALIAS_PAT is expired');
    console.log('  2. ALIAS_PAT is for wrong environment (prod vs staging)');
    console.log('  3. Token scheme mismatch (Bearer vs other)');
    console.log('  4. Token has been revoked');
    console.log('');
    console.log('Next step: Validate token in Alias dashboard or regenerate');
  } else if (status === 200) {
    console.log('API returned 200 - Token is valid!');
    console.log('The 401 error may have been transient.');
  } else {
    console.log('API returned:', status);
  }
}

main().catch(console.error);
