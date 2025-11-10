/**
 * Shopify Import API
 * POST /api/shopify/import
 * Imports sneaker products from Shopify into inventory
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isShopifyEnabled, isShopifyFullyConfigured } from '@/lib/config/shopify';
import { createShopifyClient, ShopifyProduct, ShopifyVariant } from '@/lib/services/shopify';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

interface InventoryItem {
  user_id: string;
  sku: string;
  name: string;
  brand: string | null;
  model: string | null;
  size: string | null;
  purchase_price: number | null;
  purchase_date: string | null;
  category: string;
  status: string;
  image_url: string | null;
  source: string;
  source_id: string;
  created_at: string;
}

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  total: number;
  items: {
    sku: string;
    name: string;
    action: 'imported' | 'updated' | 'skipped';
  }[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if product is a sneaker
 */
function isSneakerProduct(product: ShopifyProduct): boolean {
  const productType = product.product_type.toLowerCase();
  const tags = product.tags.toLowerCase();
  const title = product.title.toLowerCase();

  // Check product type
  const sneakerTypes = ['sneakers', 'shoes', 'footwear', 'trainers'];
  if (sneakerTypes.some((type) => productType.includes(type))) {
    return true;
  }

  // Check tags
  const sneakerTags = ['sneaker', 'shoe', 'footwear', 'nike', 'jordan', 'adidas', 'yeezy', 'new balance'];
  if (sneakerTags.some((tag) => tags.includes(tag))) {
    return true;
  }

  // Check title
  const sneakerBrands = ['nike', 'jordan', 'adidas', 'yeezy', 'new balance', 'asics', 'puma', 'reebok'];
  if (sneakerBrands.some((brand) => title.includes(brand))) {
    return true;
  }

  return false;
}

/**
 * Extract brand from product
 */
function extractBrand(product: ShopifyProduct): string | null {
  // First try vendor
  if (product.vendor && product.vendor !== 'Default Vendor') {
    return product.vendor;
  }

  // Try extracting from title
  const title = product.title.toLowerCase();
  const brands = ['nike', 'jordan', 'adidas', 'yeezy', 'new balance', 'asics', 'puma', 'reebok', 'vans', 'converse'];

  for (const brand of brands) {
    if (title.includes(brand)) {
      // Capitalize first letter
      return brand.charAt(0).toUpperCase() + brand.slice(1);
    }
  }

  return product.vendor || null;
}

/**
 * Extract model from product title
 */
function extractModel(product: ShopifyProduct): string | null {
  // Try to extract model from title (after brand)
  const title = product.title;
  const brand = extractBrand(product);

  if (!brand) {
    return null;
  }

  // Remove brand from title
  const withoutBrand = title.replace(new RegExp(brand, 'i'), '').trim();

  // Take first 2-3 words as model
  const words = withoutBrand.split(/\s+/);
  const model = words.slice(0, Math.min(3, words.length)).join(' ');

  return model || null;
}

/**
 * Get variant size
 */
function getVariantSize(variant: ShopifyVariant): string | null {
  // Try option1 first (usually size)
  if (variant.option1 && variant.option1.toLowerCase() !== 'default title') {
    return variant.option1;
  }

  // Try variant title
  if (variant.title && variant.title !== 'Default Title') {
    return variant.title;
  }

  return null;
}

/**
 * Get product image URL
 */
function getProductImage(product: ShopifyProduct, variantId?: number): string | null {
  // If variant has image
  if (variantId && product.images.length > 0) {
    const variantImage = product.images.find((img) =>
      img.variant_ids.includes(variantId)
    );
    if (variantImage) {
      return variantImage.src;
    }
  }

  // Otherwise use first product image
  if (product.images.length > 0) {
    return product.images[0].src;
  }

  return null;
}

/**
 * Map Shopify variant to inventory item
 */
function mapVariantToInventoryItem(
  product: ShopifyProduct,
  variant: ShopifyVariant,
  userId: string
): InventoryItem {
  return {
    user_id: userId,
    sku: variant.sku || `${product.id}-${variant.id}`,
    name: product.title,
    brand: extractBrand(product),
    model: extractModel(product),
    size: getVariantSize(variant),
    purchase_price: variant.price ? parseFloat(variant.price) : null,
    purchase_date: null, // Not available from Shopify
    category: 'sneakers',
    status: 'owned',
    image_url: getProductImage(product, variant.id),
    source: 'shopify',
    source_id: `${product.id}-${variant.id}`,
    created_at: new Date().toISOString(),
  };
}

// ============================================================================
// API Handler
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Check feature flag
    if (!isShopifyEnabled()) {
      logger.info('[API /shopify/import] Feature disabled');
      return NextResponse.json(
        {
          error: 'Not Implemented',
          message: 'Shopify import is not enabled',
          code: 'SHOPIFY_DISABLED',
        },
        { status: 501 }
      );
    }

    if (!isShopifyFullyConfigured()) {
      logger.warn('[API /shopify/import] Not fully configured');
      return NextResponse.json(
        {
          error: 'Not Implemented',
          message: 'Shopify integration is not fully configured',
          code: 'SHOPIFY_NOT_CONFIGURED',
        },
        { status: 501 }
      );
    }

    // 2. Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('[API /shopify/import] Starting import', { user_id: user.id });

    // 3. Fetch products from Shopify
    const shopifyClient = createShopifyClient();
    const allProducts = await shopifyClient.getAllProducts({ status: 'active' });

    logger.info('[API /shopify/import] Fetched Shopify products', {
      count: allProducts.length,
    });

    // 4. Filter to sneakers only
    const sneakerProducts = allProducts.filter(isSneakerProduct);

    logger.info('[API /shopify/import] Filtered to sneakers', {
      sneakerCount: sneakerProducts.length,
      totalCount: allProducts.length,
    });

    // 5. Convert to inventory items (one per variant)
    const inventoryItems: InventoryItem[] = [];

    for (const product of sneakerProducts) {
      for (const variant of product.variants) {
        // Skip if no SKU
        if (!variant.sku) {
          logger.warn('[API /shopify/import] Variant missing SKU', {
            product_id: product.id,
            variant_id: variant.id,
            product_title: product.title,
          });
          continue;
        }

        // Skip if inventory quantity is 0 (already sold)
        if (variant.inventory_quantity <= 0) {
          continue;
        }

        const item = mapVariantToInventoryItem(product, variant, user.id);
        inventoryItems.push(item);
      }
    }

    logger.info('[API /shopify/import] Mapped to inventory items', {
      count: inventoryItems.length,
    });

    // 6. Upsert to database in batches
    const result: ImportResult = {
      imported: 0,
      updated: 0,
      skipped: 0,
      total: inventoryItems.length,
      items: [],
    };

    const batchSize = 50;
    for (let i = 0; i < inventoryItems.length; i += batchSize) {
      const batch = inventoryItems.slice(i, i + batchSize);

      // Check which items already exist
      const skus = batch.map((item) => item.sku);
      const { data: existingItems } = await supabase
        .from('Inventory')
        .select('sku')
        .eq('user_id', user.id)
        .in('sku', skus);

      const existingSkus = new Set(existingItems?.map((item) => item.sku) || []);

      // Insert new items
      for (const item of batch) {
        const isUpdate = existingSkus.has(item.sku);

        const { error } = await supabase
          .from('Inventory')
          .upsert(item, {
            onConflict: 'user_id,sku',
            ignoreDuplicates: false, // Update existing
          });

        if (error) {
          logger.error('[API /shopify/import] Upsert failed', {
            sku: item.sku,
            error: error.message,
          });
          result.skipped++;
          result.items.push({
            sku: item.sku,
            name: item.name,
            action: 'skipped',
          });
        } else {
          if (isUpdate) {
            result.updated++;
            result.items.push({
              sku: item.sku,
              name: item.name,
              action: 'updated',
            });
          } else {
            result.imported++;
            result.items.push({
              sku: item.sku,
              name: item.name,
              action: 'imported',
            });
          }
        }
      }
    }

    const duration = Date.now() - startTime;

    logger.info('[API /shopify/import] Import completed', {
      user_id: user.id,
      imported: result.imported,
      updated: result.updated,
      skipped: result.skipped,
      total: result.total,
      duration_ms: duration,
    });

    return NextResponse.json({
      success: true,
      result,
      _meta: {
        duration_ms: duration,
        source: 'shopify',
      },
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('[API /shopify/import] Error', {
      error: error.message,
      stack: error.stack,
      duration,
    });

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error.message || 'Failed to import from Shopify',
      },
      { status: 500 }
    );
  }
}
