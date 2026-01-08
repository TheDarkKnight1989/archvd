/**
 * 503 Runtime Proof - Captures exact HTTP details during retry
 */

const ALIAS_PAT = process.env.ALIAS_PAT;
const ALIAS_BASE_URL = 'https://api.alias.org/api/v1';

const RETRY_MAX_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 16000;
const RETRY_JITTER_FACTOR = 0.2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelay(attempt: number): number {
  const baseDelay = Math.min(RETRY_BASE_DELAY_MS * Math.pow(2, attempt), RETRY_MAX_DELAY_MS);
  const jitter = baseDelay * RETRY_JITTER_FACTOR * (Math.random() * 2 - 1);
  return Math.round(baseDelay + jitter);
}

interface RetryLog {
  attempt: number;
  timestamp: string;
  status: number;
  statusText: string;
  xRequestId: string | null;
  body: string;
  delay: number;
}

async function fetchWithDetailedRetry(catalogId: string): Promise<{ success: boolean; logs: RetryLog[] }> {
  const url = `${ALIAS_BASE_URL}/catalog/${catalogId}`;
  const logs: RetryLog[] = [];

  console.log(`\n=== FETCHING: ${catalogId} ===`);
  console.log(`URL: ${url}`);
  console.log(`Start: ${new Date().toISOString()}`);

  for (let attempt = 0; attempt < RETRY_MAX_ATTEMPTS; attempt++) {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${ALIAS_PAT}`,
        'Accept': 'application/json',
      },
    });

    const body = await response.text();
    const xRequestId = response.headers.get('x-request-id');
    const delay = attempt < RETRY_MAX_ATTEMPTS - 1 ? getRetryDelay(attempt) : 0;

    const log: RetryLog = {
      attempt: attempt + 1,
      timestamp: new Date().toISOString(),
      status: response.status,
      statusText: response.statusText,
      xRequestId,
      body: body.slice(0, 200),
      delay,
    };
    logs.push(log);

    console.log(`\n--- Attempt ${attempt + 1}/${RETRY_MAX_ATTEMPTS} ---`);
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`x-request-id: ${xRequestId || 'N/A'}`);
    console.log(`Body: ${body.slice(0, 100)}...`);

    if (response.ok) {
      console.log(`✅ SUCCESS after ${attempt + 1} attempt(s)`);
      return { success: true, logs };
    }

    if (response.status === 503 || response.status === 502 || response.status === 504) {
      if (attempt < RETRY_MAX_ATTEMPTS - 1) {
        console.log(`⚠️  Retrying in ${delay}ms (exponential backoff + jitter)...`);
        await sleep(delay);
        continue;
      }
    } else {
      // Non-retryable error
      console.log(`❌ Non-retryable error: ${response.status}`);
      return { success: false, logs };
    }
  }

  console.log(`❌ FAILED after ${RETRY_MAX_ATTEMPTS} attempts`);
  return { success: false, logs };
}

async function main() {
  console.log('=== 503 RUNTIME PROOF ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Test with a SKU that's been having 503 issues
  const testSkus = [
    'nike-dunk-low-retro-white-black-dd1391-100',
    'air-jordan-1-retro-high-og-chicago-lost-and-found-dz5485-612',
  ];

  const results: { sku: string; success: boolean; attempts: number; finalStatus: number }[] = [];

  for (const sku of testSkus) {
    const { success, logs } = await fetchWithDetailedRetry(sku);
    const lastLog = logs[logs.length - 1];

    results.push({
      sku: sku.slice(0, 40),
      success,
      attempts: logs.length,
      finalStatus: lastLog.status,
    });

    // Brief pause between SKUs
    await sleep(1000);
  }

  console.log('\n=== SUMMARY ===\n');
  console.log('| SKU | Success | Attempts | Final Status |');
  console.log('|-----|---------|----------|--------------|');
  for (const r of results) {
    console.log(`| ${r.sku}... | ${r.success} | ${r.attempts} | ${r.finalStatus} |`);
  }
}

main().catch(console.error);
