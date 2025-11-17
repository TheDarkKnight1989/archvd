#!/usr/bin/env node
/**
 * Check OAuth Configuration
 */

const STOCKX_REDIRECT_URI = process.env.STOCKX_REDIRECT_URI ||
  `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/stockx/oauth/callback`

const NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

console.log('🔍 StockX OAuth Configuration:')
console.log()
console.log('  Redirect URI:', STOCKX_REDIRECT_URI)
console.log('  Site URL:', NEXT_PUBLIC_SITE_URL)
console.log()

if (STOCKX_REDIRECT_URI.includes('localhost')) {
  console.log('✅ Configured for LOCAL development')
} else {
  console.log('⚠️  Configured for PRODUCTION')
  console.log('   Comment out STOCKX_REDIRECT_URI and NEXT_PUBLIC_SITE_URL in .env.local')
}
