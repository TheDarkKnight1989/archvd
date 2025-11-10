#!/usr/bin/env node
/**
 * StockX Configuration Verification Script
 * Run this to verify your StockX integration is properly configured
 *
 * Usage:
 *   node scripts/verify-stockx-config.mjs
 */

const required = {
  production: [
    'NEXT_PUBLIC_STOCKX_ENABLE',
    'STOCKX_API_BASE_URL',
    'STOCKX_CLIENT_ID',
    'STOCKX_CLIENT_SECRET',
    'STOCKX_OAUTH_AUTHORIZE_URL',
    'STOCKX_OAUTH_TOKEN_URL',
    'STOCKX_USERINFO_URL',
    'STOCKX_REDIRECT_URI',
    'NEXT_PUBLIC_SITE_URL',
    'CRON_SECRET',
  ],
  development: [
    'NEXT_PUBLIC_STOCKX_ENABLE',
  ],
}

const warnings = []
const errors = []
const info = []

console.log('🔍 StockX Configuration Verification\n')
console.log('━'.repeat(60))

// Check if StockX is enabled
const enabled = process.env.NEXT_PUBLIC_STOCKX_ENABLE === 'true'
const mockMode = process.env.NEXT_PUBLIC_STOCKX_MOCK !== 'false' // Default true

console.log(`\n📊 Status:`)
console.log(`   STOCKX_ENABLE: ${enabled ? '✅ Enabled' : '❌ Disabled'}`)
console.log(`   STOCKX_MOCK:   ${mockMode ? '🧪 Mock Mode' : '🚀 Live Mode'}`)

if (!enabled) {
  warnings.push('StockX integration is disabled. Set NEXT_PUBLIC_STOCKX_ENABLE=true to enable.')
}

if (enabled && mockMode) {
  info.push('Running in MOCK MODE. Set NEXT_PUBLIC_STOCKX_MOCK=false for live API calls.')
}

// Check required variables based on mode
if (enabled && !mockMode) {
  console.log(`\n🔧 Required Configuration (Live Mode):`)

  const checks = required.production.map(key => {
    const value = process.env[key]
    const exists = !!value
    const masked = maskValue(key, value)

    return {
      key,
      exists,
      value: masked,
    }
  })

  checks.forEach(({ key, exists, value }) => {
    const status = exists ? '✅' : '❌'
    console.log(`   ${status} ${key.padEnd(35)} ${value}`)

    if (!exists) {
      errors.push(`Missing required environment variable: ${key}`)
    }
  })

  // Validate URLs
  if (process.env.STOCKX_API_BASE_URL && !process.env.STOCKX_API_BASE_URL.startsWith('https://')) {
    errors.push('STOCKX_API_BASE_URL must start with https://')
  }

  if (process.env.STOCKX_REDIRECT_URI) {
    const redirectUri = process.env.STOCKX_REDIRECT_URI

    if (!redirectUri.startsWith('http://') && !redirectUri.startsWith('https://')) {
      errors.push('STOCKX_REDIRECT_URI must be an absolute URL (http:// or https://)')
    }

    if (redirectUri.endsWith('/')) {
      warnings.push('STOCKX_REDIRECT_URI should not have a trailing slash')
    }

    const expectedPath = '/api/stockx/oauth/callback'
    if (!redirectUri.includes(expectedPath)) {
      warnings.push(`STOCKX_REDIRECT_URI should end with ${expectedPath}`)
    }

    console.log(`\n🔗 OAuth Configuration:`)
    console.log(`   Redirect URI: ${redirectUri}`)
    console.log(`   ⚠️  This must match EXACTLY in StockX Developer Portal`)
  }

  // Validate cron secret
  if (process.env.CRON_SECRET) {
    if (process.env.CRON_SECRET.length < 32) {
      warnings.push('CRON_SECRET should be at least 32 characters for security')
    }
    if (process.env.CRON_SECRET === 'your_random_cron_secret_here_change_in_production') {
      errors.push('CRON_SECRET is still using default value. Generate a secure random string!')
    }
  }

} else if (enabled && mockMode) {
  console.log(`\n🧪 Mock Mode Configuration:`)
  console.log(`   Mock mode is active - no real API calls will be made`)
  console.log(`   Set NEXT_PUBLIC_STOCKX_MOCK=false to enable live mode`)
}

// Check Supabase configuration
console.log(`\n🗄️  Database Configuration:`)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (supabaseUrl) {
  console.log(`   ✅ NEXT_PUBLIC_SUPABASE_URL     ${maskUrl(supabaseUrl)}`)
} else {
  errors.push('Missing NEXT_PUBLIC_SUPABASE_URL')
}

if (supabaseAnonKey) {
  console.log(`   ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY ${maskToken(supabaseAnonKey)}`)
} else {
  errors.push('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

if (supabaseServiceKey) {
  console.log(`   ✅ SUPABASE_SERVICE_ROLE_KEY     ${maskToken(supabaseServiceKey)}`)
} else {
  warnings.push('Missing SUPABASE_SERVICE_ROLE_KEY (needed for cron jobs)')
}

// Check vercel.json cron configuration
console.log(`\n⏰ Cron Jobs Configuration:`)
try {
  const fs = await import('fs')
  const path = await import('path')
  const { fileURLToPath } = await import('url')

  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const vercelJsonPath = path.join(__dirname, '..', 'vercel.json')

  if (fs.existsSync(vercelJsonPath)) {
    const vercelJson = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'))
    const stockxCrons = (vercelJson.crons || []).filter(c => c.path.includes('stockx'))

    console.log(`   Found ${stockxCrons.length} StockX cron jobs:`)
    stockxCrons.forEach(cron => {
      console.log(`   ✅ ${cron.path.padEnd(40)} ${cron.schedule}`)
    })

    if (stockxCrons.length === 0) {
      warnings.push('No StockX cron jobs configured in vercel.json')
    }
  } else {
    warnings.push('vercel.json not found')
  }
} catch (err) {
  warnings.push('Failed to read vercel.json: ' + err.message)
}

// Summary
console.log(`\n━`.repeat(60))
console.log(`\n📋 Summary:\n`)

if (errors.length > 0) {
  console.log(`❌ Errors (${errors.length}):`)
  errors.forEach(err => console.log(`   - ${err}`))
  console.log()
}

if (warnings.length > 0) {
  console.log(`⚠️  Warnings (${warnings.length}):`)
  warnings.forEach(warn => console.log(`   - ${warn}`))
  console.log()
}

if (info.length > 0) {
  console.log(`ℹ️  Info (${info.length}):`)
  info.forEach(i => console.log(`   - ${i}`))
  console.log()
}

if (errors.length === 0 && warnings.length === 0) {
  console.log(`✅ All checks passed! Configuration looks good.\n`)

  if (mockMode) {
    console.log(`🧪 Currently in MOCK MODE.`)
    console.log(`   To go live, set NEXT_PUBLIC_STOCKX_MOCK=false\n`)
  } else if (enabled) {
    console.log(`🚀 LIVE MODE is active!`)
    console.log(`   Make sure your StockX OAuth app is approved.\n`)
  }
} else {
  console.log(`⚠️  Please fix the errors above before deploying.\n`)
  process.exit(1)
}

// Helper functions
function maskValue(key, value) {
  if (!value) return '(not set)'

  const secretKeys = ['SECRET', 'TOKEN', 'KEY']
  const isSecret = secretKeys.some(k => key.includes(k))

  if (isSecret) {
    return maskToken(value)
  }

  if (key.includes('URL') || key.includes('URI')) {
    return value // Show URLs in full
  }

  if (value === 'true' || value === 'false') {
    return value
  }

  // Mask IDs
  if (value.length > 20) {
    return maskToken(value)
  }

  return value
}

function maskToken(token) {
  if (!token) return '(not set)'
  if (token.length <= 12) return '****'
  return `${token.slice(0, 8)}...${token.slice(-4)}`
}

function maskUrl(url) {
  if (!url) return '(not set)'
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return url
  }
}
