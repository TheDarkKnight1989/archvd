// StockX pricing provider (unofficial API/scrape)
// Note: This is for educational purposes. Real implementation should respect StockX's ToS.

import type { PriceData, ProductInfo } from '../types';

type StockXProduct = {
  id: string;
  uuid: string;
  name: string;
  brand: string;
  sku: string;
  styleId: string;
  thumbnail: string;
  media?: {
    imageUrl?: string;
  };
  market?: {
    lowestAsk?: number;
    highestBid?: number;
    lastSale?: number;
  };
  retailPrice?: number;
};

/**
 * Lookup product by SKU on StockX
 * Uses search API followed by product details
 */
export async function lookupBySKU(sku: string): Promise<{
  product?: ProductInfo;
  price?: PriceData;
}> {
  try {
    // Step 1: Search for product by SKU
    const searchUrl = `https://stockx.com/api/browse?_search=${encodeURIComponent(sku)}`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!searchResponse.ok) {
      throw new Error(`StockX search failed: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();

    // Find exact SKU match
    const products = searchData?.Products || [];
    const exactMatch = products.find((p: StockXProduct) =>
      p.sku?.toLowerCase() === sku.toLowerCase() ||
      p.styleId?.toLowerCase() === sku.toLowerCase()
    );

    if (!exactMatch) {
      console.log(`[StockX] No exact match found for SKU: ${sku}`);
      return {};
    }

    // Step 2: Get product details for pricing
    const productUrl = `https://stockx.com/api/products/${exactMatch.uuid}`;
    const productResponse = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!productResponse.ok) {
      throw new Error(`StockX product details failed: ${productResponse.status}`);
    }

    const productData = await productResponse.json();
    const product = productData?.Product;

    if (!product) {
      return {};
    }

    // Extract product info
    const productInfo: ProductInfo = {
      sku: product.sku || product.styleId,
      name: product.name,
      brand: product.brand,
      image_url: product.media?.imageUrl || product.thumbnail,
      retail_price: product.retailPrice,
    };

    // Extract pricing (prefer lowest ask, fallback to last sale)
    const marketPrice = product.market?.lowestAsk || product.market?.lastSale;

    if (!marketPrice) {
      console.log(`[StockX] No market price available for SKU: ${sku}`);
      return { product: productInfo };
    }

    const priceData: PriceData = {
      provider: 'stockx',
      price: marketPrice,
      currency: 'USD', // StockX primarily uses USD
      timestamp: new Date(),
      confidence: 'high',
      url: `https://stockx.com/${exactMatch.uuid}`,
    };

    return {
      product: productInfo,
      price: priceData,
    };
  } catch (error: any) {
    console.error('[StockX] Lookup error:', error.message);
    return {};
  }
}

/**
 * Batch lookup multiple SKUs (with rate limiting)
 */
export async function batchLookup(skus: string[]): Promise<Map<string, {
  product?: ProductInfo;
  price?: PriceData;
}>> {
  const results = new Map();

  // Rate limit: 1 request per second to avoid overwhelming StockX
  for (const sku of skus) {
    const result = await lookupBySKU(sku);
    results.set(sku, result);

    // Wait 1 second between requests
    if (skus.indexOf(sku) < skus.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}
