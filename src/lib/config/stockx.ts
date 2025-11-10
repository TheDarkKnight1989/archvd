/**
 * StockX Configuration
 * Environment variables and feature flags for StockX integration
 */

import { z } from 'zod'

// ============================================================================
// Schema
// ============================================================================

const stockxConfigSchema = z.object({
  enabled: z.boolean().default(false),
  mockMode: z.boolean().default(false),
  apiBaseUrl: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  accessToken: z.string().optional(),
  apiKey: z.string().optional(),
})

type StockxConfig = z.infer<typeof stockxConfigSchema>

// ============================================================================
// Load Configuration
// ============================================================================

let config: StockxConfig | null = null

function loadConfig(): StockxConfig {
  if (config) return config

  try {
    config = stockxConfigSchema.parse({
      enabled: process.env.NEXT_PUBLIC_STOCKX_ENABLE === 'true',
      mockMode: process.env.NEXT_PUBLIC_STOCKX_MOCK !== 'false', // Default true for safety
      apiBaseUrl: process.env.STOCKX_API_BASE_URL,
      clientId: process.env.STOCKX_CLIENT_ID,
      clientSecret: process.env.STOCKX_CLIENT_SECRET,
      accessToken: process.env.STOCKX_ACCESS_TOKEN,
      apiKey: process.env.STOCKX_API_KEY,
    })

    // Log configuration (without secrets)
    if (typeof window === 'undefined') {
      console.log('[StockX] Config loaded', {
        enabled: config.enabled,
        mockMode: config.mockMode,
        hasApiBaseUrl: !!config.apiBaseUrl,
        hasClientId: !!config.clientId,
        hasClientSecret: !!config.clientSecret,
        hasAccessToken: !!config.accessToken,
        hasApiKey: !!config.apiKey,
      })

      // Warn if enabled but missing credentials (and not in mock mode)
      if (config.enabled && !config.mockMode) {
        if (!config.apiBaseUrl) {
          console.warn('[StockX] NEXT_PUBLIC_STOCKX_ENABLE=true but STOCKX_API_BASE_URL is missing')
        }
        if (!config.clientId) {
          console.warn('[StockX] NEXT_PUBLIC_STOCKX_ENABLE=true but STOCKX_CLIENT_ID is missing')
        }
        if (!config.clientSecret) {
          console.warn('[StockX] NEXT_PUBLIC_STOCKX_ENABLE=true but STOCKX_CLIENT_SECRET is missing')
        }
        if (!config.apiKey) {
          console.warn('[StockX] NEXT_PUBLIC_STOCKX_ENABLE=true but STOCKX_API_KEY is missing')
        }
      }
    }

    return config
  } catch (error) {
    console.error('[StockX] Configuration error:', error)
    throw error
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if StockX integration is enabled
 */
export function isStockxEnabled(): boolean {
  const cfg = loadConfig()
  return cfg.enabled
}

/**
 * Check if StockX is in mock mode
 */
export function isStockxMockMode(): boolean {
  const cfg = loadConfig()
  return cfg.mockMode
}

/**
 * Get StockX API base URL
 */
export function getStockxApiBaseUrl(): string {
  const cfg = loadConfig()
  if (!cfg.apiBaseUrl) {
    throw new Error('StockX API base URL is not configured')
  }
  return cfg.apiBaseUrl
}

/**
 * Get StockX client ID
 */
export function getStockxClientId(): string {
  const cfg = loadConfig()
  if (!cfg.clientId) {
    throw new Error('StockX client ID is not configured')
  }
  return cfg.clientId
}

/**
 * Get StockX client secret
 */
export function getStockxClientSecret(): string {
  const cfg = loadConfig()
  if (!cfg.clientSecret) {
    throw new Error('StockX client secret is not configured')
  }
  return cfg.clientSecret
}

/**
 * Get StockX access token (if using direct token auth)
 */
export function getStockxAccessToken(): string | undefined {
  const cfg = loadConfig()
  return cfg.accessToken
}

/**
 * Get StockX API key (x-api-key header)
 */
export function getStockxApiKey(): string | undefined {
  const cfg = loadConfig()
  return cfg.apiKey
}

/**
 * Get full StockX configuration
 */
export function getStockxConfig(): StockxConfig {
  return loadConfig()
}

/**
 * Mask sensitive token for logging
 */
export function maskStockxToken(token: string | undefined): string {
  if (!token) return '(not set)'
  if (token.length <= 12) return '****'
  return `${token.slice(0, 8)}...${token.slice(-4)}`
}
