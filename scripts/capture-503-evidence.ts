// Capture EXACT HTTP response - no paraphrasing

const ALIAS_PAT = process.env.ALIAS_PAT;
const ALIAS_BASE_URL = 'https://api.alias.org/api/v1';
const testUrl = `${ALIAS_BASE_URL}/catalog/nike-dunk-low-retro-white-black-dd1391-100`;

async function captureExactResponse() {
  console.log('=== EXACT HTTP RESPONSE CAPTURE ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('URL:', testUrl);
  console.log('Method: GET');
  console.log('');

  const response = await fetch(testUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${ALIAS_PAT}`,
      'Accept': 'application/json',
    },
  });

  console.log('--- RESPONSE ---');
  console.log('HTTP Status:', response.status);
  console.log('Status Text:', response.statusText);
  console.log('');

  console.log('Response Headers:');
  response.headers.forEach((value, key) => {
    console.log(`  ${key}: ${value}`);
  });

  console.log('');
  const body = await response.text();
  console.log('Response Body (raw):');
  console.log(body);

  console.log('');
  console.log('--- VERDICT ---');
  if (response.status === 401) {
    console.log('ERROR TYPE: Authentication failure (401)');
  } else if (response.status === 503) {
    console.log('ERROR TYPE: Service Unavailable (503) - External dependency issue');
  } else if (response.status === 200) {
    console.log('SUCCESS: API responding normally (200)');
  } else {
    console.log('ERROR TYPE: Other (' + response.status + ')');
  }
}

captureExactResponse().catch(e => {
  console.log('FETCH FAILED:', e.message);
});
