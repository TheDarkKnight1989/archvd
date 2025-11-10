/**
 * Alias (GOAT) API Configuration
 * Feature-flagged with zod validation
 * NEVER logs secrets
 */

import { z } from 'zod';
import { logger } from '@/lib/logger';

// ============================================================================
// Schema Validation
// ============================================================================

const aliasConfigSchema = z.object({
  enabled: z.boolean().default(false),
  mockMode: z.boolean().default(true), // Default to mock mode for Phase 1.5
  apiBaseUrl: z.string().url().optional(),
  oauthClientId: z.string().optional(),
  oauthClientSecret: z.string().optional(),
  webhookSecret: z.string().optional(),
});

type AliasConfig = z.infer<typeof aliasConfigSchema>;

// ============================================================================
// Config Loader
// ============================================================================

let cachedConfig: AliasConfig | null = null;

function loadAliasConfig(): AliasConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const rawConfig = {
    enabled: process.env.NEXT_PUBLIC_ALIAS_ENABLE === 'true',
    mockMode: process.env.NEXT_PUBLIC_ALIAS_MOCK !== 'false', // Default true unless explicitly false
    apiBaseUrl: process.env.ALIAS_API_BASE_URL,
    oauthClientId: process.env.ALIAS_OAUTH_CLIENT_ID,
    oauthClientSecret: process.env.ALIAS_OAUTH_CLIENT_SECRET,
    webhookSecret: process.env.ALIAS_WEBHOOK_SECRET,
  };

  try {
    cachedConfig = aliasConfigSchema.parse(rawConfig);

    // Validate that if enabled, required fields are present
    if (cachedConfig.enabled) {
      if (!cachedConfig.apiBaseUrl) {
        logger.warn('[Alias] NEXT_PUBLIC_ALIAS_ENABLE=true but ALIAS_API_BASE_URL is missing');
      }
      if (!cachedConfig.oauthClientId) {
        logger.warn('[Alias] NEXT_PUBLIC_ALIAS_ENABLE=true but ALIAS_OAUTH_CLIENT_ID is missing');
      }
      if (!cachedConfig.oauthClientSecret) {
        logger.warn('[Alias] NEXT_PUBLIC_ALIAS_ENABLE=true but ALIAS_OAUTH_CLIENT_SECRET is missing');
      }
    }

    // Log config loaded (WITHOUT secrets)
    logger.info('[Alias] Config loaded', {
      enabled: cachedConfig.enabled,
      mockMode: cachedConfig.mockMode,
      apiBaseUrl: cachedConfig.apiBaseUrl,
      hasClientId: !!cachedConfig.oauthClientId,
      hasClientSecret: !!cachedConfig.oauthClientSecret,
      hasWebhookSecret: !!cachedConfig.webhookSecret,
    });

    return cachedConfig;
  } catch (error) {
    logger.error('[Alias] Config validation failed', { error });
    // Return disabled config on validation failure
    cachedConfig = { enabled: false, mockMode: false };
    return cachedConfig;
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check if Alias integration is enabled
 */
export function isAliasEnabled(): boolean {
  const config = loadAliasConfig();
  return config.enabled;
}

/**
 * Get Alias API base URL
 * @throws if not configured
 */
export function getAliasApiBaseUrl(): string {
  const config = loadAliasConfig();

  if (!config.enabled) {
    throw new Error('Alias integration is not enabled');
  }

  if (!config.apiBaseUrl) {
    throw new Error('ALIAS_API_BASE_URL is not configured');
  }

  return config.apiBaseUrl;
}

/**
 * Get OAuth client credentials
 * @throws if not configured
 */
export function getAliasOAuthCredentials(): { clientId: string; clientSecret: string } {
  const config = loadAliasConfig();

  if (!config.enabled) {
    throw new Error('Alias integration is not enabled');
  }

  if (!config.oauthClientId || !config.oauthClientSecret) {
    throw new Error('Alias OAuth credentials not configured');
  }

  return {
    clientId: config.oauthClientId,
    clientSecret: config.oauthClientSecret,
  };
}

/**
 * Get webhook secret for HMAC verification
 * @throws if not configured
 */
export function getAliasWebhookSecret(): string {
  const config = loadAliasConfig();

  if (!config.enabled) {
    throw new Error('Alias integration is not enabled');
  }

  if (!config.webhookSecret) {
    throw new Error('ALIAS_WEBHOOK_SECRET is not configured');
  }

  return config.webhookSecret;
}

/**
 * Check if Alias is fully configured (enabled + all creds present)
 */
export function isAliasFullyConfigured(): boolean {
  const config = loadAliasConfig();

  return !!(
    config.enabled &&
    config.apiBaseUrl &&
    config.oauthClientId &&
    config.oauthClientSecret &&
    config.webhookSecret
  );
}

/**
 * Get safe config for logging/display (masks secrets)
 */
export function getAliasConfigSafe(): {
  enabled: boolean;
  apiBaseUrl: string | null;
  hasOAuthCreds: boolean;
  hasWebhookSecret: boolean;
  fullyConfigured: boolean;
} {
  const config = loadAliasConfig();

  return {
    enabled: config.enabled,
    apiBaseUrl: config.apiBaseUrl || null,
    hasOAuthCreds: !!(config.oauthClientId && config.oauthClientSecret),
    hasWebhookSecret: !!config.webhookSecret,
    fullyConfigured: isAliasFullyConfigured(),
  };
}

/**
 * Mask sensitive value for logging
 * Shows first 4 and last 4 chars: "abcd...wxyz"
 */
export function maskSecret(secret: string | undefined): string {
  if (!secret) return '(not set)';
  if (secret.length <= 8) return '****';

  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

/**
 * Get masked OAuth client ID for logging
 */
export function getMaskedClientId(): string {
  const config = loadAliasConfig();
  return maskSecret(config.oauthClientId);
}

/**
 * Check if Alias mock mode is enabled
 */
export function isAliasMockMode(): boolean {
  const config = loadAliasConfig();
  return config.enabled && config.mockMode;
}

/**
 * Check if Alias is in live mode (enabled but not mock)
 */
export function isAliasLiveMode(): boolean {
  const config = loadAliasConfig();
  return config.enabled && !config.mockMode;
}

/**
 * Get mode string for logging
 */
export function getAliasMode(): 'disabled' | 'mock' | 'live' {
  const config = loadAliasConfig();
  if (!config.enabled) return 'disabled';
  return config.mockMode ? 'mock' : 'live';
}
