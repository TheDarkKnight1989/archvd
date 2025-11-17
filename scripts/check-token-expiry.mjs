import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local
const envPath = join(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2];
  }
});

const token = envVars.STOCKX_ACCESS_TOKEN;

if (!token) {
  console.log('❌ No STOCKX_ACCESS_TOKEN found');
  process.exit(1);
}

try {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  const exp = payload.exp * 1000;
  const now = Date.now();
  const expiresAt = new Date(exp);
  const minutesDiff = Math.floor((now - exp) / 1000 / 60);

  console.log('Token Information:');
  console.log('  Issued at:', new Date(payload.iat * 1000).toLocaleString());
  console.log('  Expires at:', expiresAt.toLocaleString());
  console.log('  Current time:', new Date().toLocaleString());
  console.log('');

  if (now > exp) {
    console.log(`❌ Token EXPIRED ${Math.abs(minutesDiff)} minutes ago`);
    console.log('');
    console.log('Action needed: Refresh token or reconnect StockX OAuth');
  } else {
    const hoursRemaining = Math.floor(minutesDiff / 60);
    console.log(`✅ Token valid for ${Math.abs(hoursRemaining)} hours (${Math.abs(minutesDiff)} minutes)`);
  }
} catch (error) {
  console.error('❌ Failed to decode token:', error.message);
}
