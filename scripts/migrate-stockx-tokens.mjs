/**
 * Migrate StockX tokens from .env.local to database
 * This script moves tokens from environment variables to the stockx_accounts table
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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

async function main() {
  console.log('='.repeat(60));
  console.log('StockX Token Migration');
  console.log('Environment → Database');
  console.log('='.repeat(60));

  // Get tokens from .env.local
  const accessToken = envVars.STOCKX_ACCESS_TOKEN;
  const refreshToken = envVars.STOCKX_REFRESH_TOKEN;

  if (!accessToken || !refreshToken) {
    console.log('❌ No StockX tokens found in .env.local');
    console.log('   Make sure STOCKX_ACCESS_TOKEN and STOCKX_REFRESH_TOKEN are set');
    process.exit(1);
  }

  console.log('✅ Found tokens in .env.local');

  // Decode JWT to get user info and expiry
  const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
  const expiresAt = new Date(payload.exp * 1000);

  console.log('   Customer UUID:', payload['https://stockx.com/customer_uuid']);
  console.log('   Token expires:', expiresAt.toLocaleString());

  // Get the authenticated user (you'll need to provide the user_id)
  console.log('\n🔍 Looking for user to associate account with...');

  // Get all users (assuming single user app, or you can specify)
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

  if (usersError || !users || users.users.length === 0) {
    console.log('❌ No users found. Please create a user account first.');
    process.exit(1);
  }

  // Use the first user (or prompt if multiple)
  const user = users.users[0];
  console.log('✅ Found user:', user.email);

  // Check if account already exists
  const { data: existingAccount } = await supabase
    .from('stockx_accounts')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingAccount) {
    console.log('\n⚠️  StockX account already exists for this user');
    console.log('   Account email:', existingAccount.account_email);

    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('Update existing account? (y/n): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y') {
      console.log('❌ Migration cancelled');
      process.exit(0);
    }

    // Update existing account
    const { error: updateError } = await supabase
      .from('stockx_accounts')
      .update({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('❌ Failed to update account:', updateError.message);
      process.exit(1);
    }

    console.log('✅ Account updated successfully!');
  } else {
    // Get user email from userinfo endpoint
    console.log('\n🔍 Fetching StockX account email...');

    try {
      const response = await fetch(envVars.STOCKX_USERINFO_URL || 'https://accounts.stockx.com/oauth/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      let accountEmail = 'unknown@example.com';
      if (response.ok) {
        const userInfo = await response.json();
        accountEmail = userInfo.email || userInfo.name || accountEmail;
        console.log('✅ Account email:', accountEmail);
      } else {
        console.log('⚠️  Could not fetch account email (token may be expired)');
      }

      // Insert new account
      const { error: insertError } = await supabase
        .from('stockx_accounts')
        .insert({
          user_id: user.id,
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt.toISOString(),
          account_email: accountEmail,
        });

      if (insertError) {
        console.error('❌ Failed to insert account:', insertError.message);
        process.exit(1);
      }

      console.log('✅ StockX account created successfully!');
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Migration complete!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Test StockX features in the app');
  console.log('2. Optionally remove tokens from .env.local');
  console.log('   (Keep them as backup until you verify everything works)');
  console.log('='.repeat(60));
}

main().catch(console.error);
