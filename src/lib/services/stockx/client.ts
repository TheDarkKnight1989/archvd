/**
 * StockX API Client
 * Core HTTP client with authentication, retry logic, and rate limiting
 * Supports both client credentials (app-level) and user OAuth tokens
 */

import {
  getStockxApiBaseUrl,
  getStockxClientId,
  getStockxClientSecret,
  getStockxAccessToken,
  maskStockxToken,
  isStockxMockMode,
} from '@/lib/config/stockx'
import { createClient } from '@/lib/supabase/server'

// ============================================================================
// Types
// ============================================================================

export interface StockxRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: any
  retries?: number
  timeout?: number
}

export interface StockxAuthToken {
  access_token: string
  token_type: string
  expires_in: number
  expires_at: number
}

export interface StockxUserToken {
  access_token: string
  refresh_token: string
  token_type: string
  expires_at: string
  scope: string | null
}

// ============================================================================
// StockX Client
// ============================================================================

export class StockxClient {
  private baseUrl: string
  private clientId: string
  private clientSecret: string
  private accessToken: string | undefined
  private tokenExpiresAt: number = 0
  private userId: string | null = null // User ID for OAuth user tokens
  private refreshToken: string | null = null // For user OAuth

  constructor(userId?: string) {
    this.baseUrl = getStockxApiBaseUrl()
    this.clientId = getStockxClientId()
    this.clientSecret = getStockxClientSecret()
    this.accessToken = getStockxAccessToken()
    this.userId = userId || null
  }

  /**
   * Load user's OAuth tokens from database
   */
  private async loadUserTokens(): Promise<StockxUserToken | null> {
    if (!this.userId) {
      return null
    }

    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('stockx_accounts')
        .select('access_token, refresh_token, token_type, expires_at, scope')
        .eq('user_id', this.userId)
        .single()

      if (error || !data) {
        console.warn('[StockX] No user tokens found', { userId: this.userId })
        return null
      }

      return data as StockxUserToken
    } catch (error) {
      console.error('[StockX] Failed to load user tokens', error)
      return null
    }
  }

  /**
   * Refresh user's OAuth token using refresh_token
   */
  private async refreshUserToken(): Promise<StockxUserToken | null> {
    if (!this.userId || !this.refreshToken) {
      return null
    }

    console.log('[StockX] Refreshing user access token', { userId: this.userId })

    try {
      const response = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('[StockX] Token refresh failed', {
          status: response.status,
          error,
        })
        return null
      }

      const data = await response.json()
      const newAccessToken = data.access_token
      const newRefreshToken = data.refresh_token || this.refreshToken // Some providers don't return new refresh token
      const expiresIn = data.expires_in || 3600
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

      // Persist refreshed tokens to database
      const supabase = await createClient()
      await supabase
        .from('stockx_accounts')
        .update({
          access_token: newAccessToken,
          refresh_token: newRefreshToken,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', this.userId)

      console.log('[StockX] User token refreshed successfully', {
        userId: this.userId,
        token: maskStockxToken(newAccessToken),
      })

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        token_type: data.token_type || 'Bearer',
        expires_at: expiresAt,
        scope: data.scope || null,
      }
    } catch (error) {
      console.error('[StockX] Token refresh error', error)
      return null
    }
  }

  /**
   * Get valid access token (refresh if needed)
   * Supports both user OAuth tokens and client credentials
   */
  private async getAccessToken(): Promise<string> {
    // If we have a manually configured token, use it
    if (this.accessToken && !this.userId) {
      return this.accessToken
    }

    // User OAuth flow
    if (this.userId) {
      // Load user tokens if not cached
      if (!this.accessToken || !this.refreshToken) {
        const userTokens = await this.loadUserTokens()
        if (userTokens) {
          this.accessToken = userTokens.access_token
          this.refreshToken = userTokens.refresh_token
          this.tokenExpiresAt = new Date(userTokens.expires_at).getTime()
        } else {
          throw new Error('User not connected to StockX. Please connect your account first.')
        }
      }

      // Check if token needs refresh
      const now = Date.now()
      if (this.tokenExpiresAt <= now + 60000) {
        // Token expired or expiring soon
        const refreshedTokens = await this.refreshUserToken()
        if (refreshedTokens) {
          this.accessToken = refreshedTokens.access_token
          this.refreshToken = refreshedTokens.refresh_token
          this.tokenExpiresAt = new Date(refreshedTokens.expires_at).getTime()
        } else {
          throw new Error('Failed to refresh StockX token. Please reconnect your account.')
        }
      }

      return this.accessToken!
    }

    // Client credentials flow (app-level)
    // Check if current token is still valid
    const now = Date.now()
    if (this.tokenExpiresAt > now + 60000) {
      // Token valid for at least 1 more minute
      return this.accessToken!
    }

    // Request new token via OAuth client credentials flow
    console.log('[StockX] Requesting new access token')

    try {
      const response = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`StockX OAuth failed: ${response.status} ${response.statusText} - ${error}`)
      }

      const data: StockxAuthToken = await response.json()
      this.accessToken = data.access_token
      this.tokenExpiresAt = Date.now() + (data.expires_in * 1000)

      console.log('[StockX] Access token obtained', {
        expires_in: data.expires_in,
        token: maskStockxToken(this.accessToken),
      })

      return this.accessToken
    } catch (error) {
      console.error('[StockX] OAuth error:', error)
      throw error
    }
  }

  /**
   * Make authenticated request to StockX API
   */
  async request<T = any>(
    endpoint: string,
    options: StockxRequestOptions = {}
  ): Promise<T> {
    const {
      method = 'GET',
      headers = {},
      body,
      retries = 3,
      timeout = 30000,
    } = options

    // Get access token
    const token = await this.getAccessToken()

    // Build request
    const url = `${this.baseUrl}${endpoint}`
    const requestHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...headers,
    }

    console.log('[StockX] API Request', {
      endpoint,
      method,
      token: maskStockxToken(token),
    })

    // Retry logic with exponential backoff
    let lastError: Error | null = null
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        const response = await fetch(url, {
          method,
          headers: requestHeaders,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        // Handle rate limiting (429)
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10)
          const backoff = Math.min(retryAfter * 1000, 30000) // Max 30s

          console.warn('[StockX] Rate limited, retrying after', {
            backoff_ms: backoff,
            attempt: attempt + 1,
            retries,
          })

          await this.sleep(backoff)
          continue
        }

        // Handle other errors
        if (!response.ok) {
          const errorText = await response.text()
          console.error('[StockX] API Error', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
          })
          throw new Error(`StockX API error: ${response.status} ${response.statusText}`)
        }

        // Success
        const data = await response.json()
        console.log('[StockX] API Success', {
          endpoint,
          status: response.status,
        })

        return data as T
      } catch (error: any) {
        lastError = error

        // Don't retry on abort (timeout)
        if (error.name === 'AbortError') {
          console.error('[StockX] Request timeout', { endpoint, timeout })
          throw new Error(`StockX request timeout after ${timeout}ms`)
        }

        // Exponential backoff for retries
        if (attempt < retries - 1) {
          const backoff = Math.min(1000 * Math.pow(2, attempt), 10000) // Max 10s
          console.warn('[StockX] Request failed, retrying', {
            attempt: attempt + 1,
            retries,
            backoff_ms: backoff,
            error: error.message,
          })
          await this.sleep(backoff)
        }
      }
    }

    // All retries exhausted
    console.error('[StockX] Request failed after retries', {
      endpoint,
      retries,
      error: lastError?.message,
    })
    throw lastError || new Error('StockX request failed')
  }

  /**
   * Sleep helper for backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ============================================================================
// Client Factory
// ============================================================================

// Cache for user-specific clients
const userClientCache = new Map<string, StockxClient>()

// App-level client (singleton)
let appClientInstance: StockxClient | null = null

/**
 * Get StockX client for a specific user (with OAuth tokens)
 * or app-level client (with client credentials)
 */
export function getStockxClient(userId?: string): StockxClient {
  if (isStockxMockMode()) {
    throw new Error('Cannot use real StockX client in mock mode')
  }

  // User-specific client
  if (userId) {
    if (!userClientCache.has(userId)) {
      userClientCache.set(userId, new StockxClient(userId))
    }
    return userClientCache.get(userId)!
  }

  // App-level client
  if (!appClientInstance) {
    appClientInstance = new StockxClient()
  }

  return appClientInstance
}
