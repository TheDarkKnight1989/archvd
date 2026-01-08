// Simple StockX API test - no frameworks, no complexity
const STOCKX_REFRESH_TOKEN = process.env.STOCKX_REFRESH_TOKEN;
const STOCKX_CLIENT_ID = process.env.STOCKX_CLIENT_ID;
const STOCKX_CLIENT_SECRET = process.env.STOCKX_CLIENT_SECRET;
const STOCKX_API_KEY = process.env.STOCKX_API_KEY;

console.log('=== StockX Credentials Check ===');
console.log('Client ID:', STOCKX_CLIENT_ID ? '✓ Present' : '✗ Missing');
console.log('Client Secret:', STOCKX_CLIENT_SECRET ? '✓ Present' : '✗ Missing');
console.log('Refresh Token:', STOCKX_REFRESH_TOKEN ? '✓ Present' : '✗ Missing');
console.log('API Key:', STOCKX_API_KEY ? '✓ Present' : '✗ Missing');

async function testStockX() {
  // Step 1: Get access token
  console.log('\n=== Step 1: Getting Access Token ===');
  const tokenResponse = await fetch('https://accounts.stockx.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: STOCKX_REFRESH_TOKEN,
      client_id: STOCKX_CLIENT_ID,
      client_secret: STOCKX_CLIENT_SECRET,
      audience: 'gateway.stockx.com',
    }),
  });

  console.log('Token Response Status:', tokenResponse.status);
  const tokenText = await tokenResponse.text();
  console.log('Token Response Body:', tokenText);

  if (!tokenResponse.ok) {
    console.error('❌ Failed to get access token');
    return;
  }

  const tokenData = JSON.parse(tokenText);
  const accessToken = tokenData.access_token;
  console.log('✓ Got access token:', accessToken.substring(0, 20) + '...');

  // Step 2: Try to fetch market data for a popular sneaker
  console.log('\n=== Step 2: Fetching Market Data ===');
  const sku = 'DD1391-100'; // Jordan 1 Low Panda - very popular
  const apiResponse = await fetch(`https://api.stockx.com/v2/catalog/products/${sku}/market`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': STOCKX_API_KEY,
      'Accept': 'application/json',
    },
  });

  console.log('API Response Status:', apiResponse.status);
  const apiText = await apiResponse.text();
  console.log('API Response Body:', apiText.substring(0, 500));

  if (!apiResponse.ok) {
    console.error('❌ API call failed');
  } else {
    console.log('✓ API call succeeded!');
  }
}

testStockX().catch(console.error);