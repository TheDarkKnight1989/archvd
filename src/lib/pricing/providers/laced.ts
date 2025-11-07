// Laced pricing provider (UK-based sneaker marketplace)

import type { PriceData, ProductInfo } from '../types';

type LacedProduct = {
  id: string;
  name: string;
  brand: string;
  sku: string;
  image: string;
  lowestPrice?: number;
  retailPrice?: number;
};

/**
 * Lookup product by SKU on Laced
 * Laced is UK-based and provides GBP pricing
 */
export async function lookupBySKU(sku: string): Promise<{
  product?: ProductInfo;
  price?: PriceData;
}> {
  try {
    // Laced search API (unofficial - may need adjustment)
    const searchUrl = `https://www.laced.com/api/search?q=${encodeURIComponent(sku)}`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Laced search failed: ${response.status}`);
    }

    const data = await response.json();
    const products = data?.products || data?.results || [];

    // Find exact SKU match
    const exactMatch = products.find((p: LacedProduct) =>
      p.sku?.toLowerCase() === sku.toLowerCase()
    );

    if (!exactMatch) {
      console.log(`[Laced] No exact match found for SKU: ${sku}`);
      return {};
    }

    // Extract product info
    const productInfo: ProductInfo = {
      sku: exactMatch.sku,
      name: exactMatch.name,
      brand: exactMatch.brand,
      image_url: exactMatch.image,
      retail_price: exactMatch.retailPrice,
    };

    // Extract pricing
    if (!exactMatch.lowestPrice) {
      console.log(`[Laced] No price available for SKU: ${sku}`);
      return { product: productInfo };
    }

    const priceData: PriceData = {
      provider: 'laced',
      price: exactMatch.lowestPrice,
      currency: 'GBP',
      timestamp: new Date(),
      confidence: 'high',
      url: `https://www.laced.com/products/${exactMatch.id}`,
    };

    return {
      product: productInfo,
      price: priceData,
    };
  } catch (error: any) {
    console.error('[Laced] Lookup error:', error.message);
    return {};
  }
}

/**
 * Batch lookup multiple SKUs
 */
export async function batchLookup(skus: string[]): Promise<Map<string, {
  product?: ProductInfo;
  price?: PriceData;
}>> {
  const results = new Map();

  for (const sku of skus) {
    const result = await lookupBySKU(sku);
    results.set(sku, result);

    // Rate limit: 1 request per second
    if (skus.indexOf(sku) < skus.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}
