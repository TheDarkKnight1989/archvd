// Pricing system types

export type PriceProvider = 'stockx' | 'laced' | 'restocks' | 'klekt' | 'ebay';

export type PriceData = {
  provider: PriceProvider;
  price: number;
  currency: string;
  timestamp: Date;
  confidence: 'high' | 'medium' | 'low';
  url?: string;
};

export type AggregatedPrice = {
  price: number;
  sources_used: PriceProvider[];
  timestamp: Date;
  confidence: 'high' | 'medium' | 'low';
};

export type ProductInfo = {
  sku: string;
  name?: string;
  brand?: string;
  image_url?: string;
  retail_price?: number;
};

export type PriceLookupResult = {
  product?: ProductInfo;
  prices: PriceData[];
  aggregated?: AggregatedPrice | null;
};

export type ProviderConfig = {
  enabled: boolean;
  timeout: number; // ms
  rateLimit?: {
    maxRequests: number;
    perSeconds: number;
  };
};
