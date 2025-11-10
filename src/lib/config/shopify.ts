/**
 * Shopify Configuration
 * Secure config for Shopify Admin API integration
 * NEVER logs access tokens
 */

import { z } from 'zod';
import { logger } from '@/lib/logger';

// ============================================================================
// Schema Validation
// ============================================================================

const shopifyConfigSchema = z.object({
  enabled: z.boolean().default(false),
  domain: z.string().optional(),
  accessToken: z.string().optional(),
  apiVersion: z.string().default('2024-01'),
});

type ShopifyConfig = z.infer<typeof shopifyConfigSchema>;

// ============================================================================
// Config Loader
// ============================================================================

let cachedConfig: ShopifyConfig | null = null;

function loadShopifyConfig(): ShopifyConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const rawConfig = {
    enabled: process.env.NEXT_PUBLIC_SHOPIFY_IMPORT_ENABLE === 'true',
    domain: process.env.SHOPIFY_DOMAIN,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
    apiVersion: process.env.SHOPIFY_API_VERSION || '2024-01',
  };

  try {
    cachedConfig = shopifyConfigSchema.parse(rawConfig);

    // Validate that if enabled, required fields are present
    if (cachedConfig.enabled) {
      if (!cachedConfig.domain) {
        logger.warn('[Shopify] NEXT_PUBLIC_SHOPIFY_IMPORT_ENABLE=true but SHOPIFY_DOMAIN is missing');
      }
      if (!cachedConfig.accessToken) {
        logger.warn('[Shopify] NEXT_PUBLIC_SHOPIFY_IMPORT_ENABLE=true but SHOPIFY_ACCESS_TOKEN is missing');
      }
    }

    // Log config loaded (WITHOUT token)
    logger.info('[Shopify] Config loaded', {
      enabled: cachedConfig.enabled,
      domain: cachedConfig.domain || '(not set)',
      apiVersion: cachedConfig.apiVersion,
      hasAccessToken: !!cachedConfig.accessToken,
    });

    return cachedConfig;
  } catch (error) {
    logger.error('[Shopify] Config validation failed', { error });
    // Return disabled config on validation failure
    cachedConfig = { enabled: false, apiVersion: '2024-01' };
    return cachedConfig;
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check if Shopify import is enabled
 */
export function isShopifyEnabled(): boolean {
  const config = loadShopifyConfig();
  return config.enabled;
}

/**
 * Get Shopify domain
 * @throws if not configured
 */
export function getShopifyDomain(): string {
  const config = loadShopifyConfig();

  if (!config.enabled) {
    throw new Error('Shopify integration is not enabled');
  }

  if (!config.domain) {
    throw new Error('SHOPIFY_DOMAIN is not configured');
  }

  return config.domain;
}

/**
 * Get Shopify access token
 * @throws if not configured
 */
export function getShopifyAccessToken(): string {
  const config = loadShopifyConfig();

  if (!config.enabled) {
    throw new Error('Shopify integration is not enabled');
  }

  if (!config.accessToken) {
    throw new Error('SHOPIFY_ACCESS_TOKEN is not configured');
  }

  return config.accessToken;
}

/**
 * Get Shopify API version
 */
export function getShopifyApiVersion(): string {
  const config = loadShopifyConfig();
  return config.apiVersion;
}

/**
 * Build Shopify Admin API URL
 */
export function getShopifyApiUrl(endpoint: string): string {
  const domain = getShopifyDomain();
  const version = getShopifyApiVersion();

  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;

  return `https://${domain}/admin/api/${version}/${cleanEndpoint}`;
}

/**
 * Check if Shopify is fully configured (enabled + all creds present)
 */
export function isShopifyFullyConfigured(): boolean {
  const config = loadShopifyConfig();

  return !!(
    config.enabled &&
    config.domain &&
    config.accessToken
  );
}

/**
 * Get safe config for logging/display (masks token)
 */
export function getShopifyConfigSafe(): {
  enabled: boolean;
  domain: string | null;
  apiVersion: string;
  hasAccessToken: boolean;
  fullyConfigured: boolean;
} {
  const config = loadShopifyConfig();

  return {
    enabled: config.enabled,
    domain: config.domain || null,
    apiVersion: config.apiVersion,
    hasAccessToken: !!config.accessToken,
    fullyConfigured: isShopifyFullyConfigured(),
  };
}

/**
 * Mask access token for logging
 * Shows first 8 and last 4 chars: "shpat_ab...wxyz"
 */
export function maskShopifyToken(token: string | undefined): string {
  if (!token) return '(not set)';
  if (token.length <= 12) return '****';

  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}

/**
 * Get masked access token for logging
 */
export function getMaskedShopifyToken(): string {
  const config = loadShopifyConfig();
  return maskShopifyToken(config.accessToken);
}
