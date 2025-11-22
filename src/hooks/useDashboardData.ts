import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { TABLE_ITEMS, InventoryItem } from '@/lib/portfolio/types';
import type { TableParams } from '@/lib/url/params';

export type KPIStats = {
  totalItems: number;
  inStock: number;
  sold: number;
  totalValue: number;
  portfolioMarketValue: number;
  invested: number;
  unrealisedPL: number;
  unrealisedPLPct: number;
  roi: number;
  delta7d: number;
  lastUpdated: string | null;
  marketAsOf: string | null;
  itemsWithoutPrices: number;
};

export type BreakdownItem = {
  label: string;
  value: number;
  pct: number;
};

export type ChartDataPoint = {
  date: string;
  value: number;
};

export type TableRow = {
  id: string;
  thumb: string;
  title: string;
  sku: string;
  size: string;
  status: 'active' | 'listed' | 'worn' | 'sold';
  buy: number;
  market: number | null;
  marketSource: string | null;
  marketUpdatedAt: string | null;
  pl: number | null;
  plPct: number | null;
};

/**
 * Hook for fetching KPI statistics with time-range support
 */
export function useKPIStats(userId: string | undefined, timeRange: 'today' | '7d' | '30d' | '90d' | 'lifetime' = 'lifetime') {
  const [data, setData] = useState<KPIStats>({
    totalItems: 0,
    inStock: 0,
    sold: 0,
    totalValue: 0,
    portfolioMarketValue: 0,
    invested: 0,
    unrealisedPL: 0,
    unrealisedPLPct: 0,
    roi: 0,
    delta7d: 0,
    lastUpdated: null,
    marketAsOf: null,
    itemsWithoutPrices: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchKPIs = async () => {
      try {
        // Use /api/portfolio/overview endpoint (Matrix V2)
        const response = await fetch(`/api/portfolio/overview?currency=GBP`);

        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const overview = await response.json();

        if (overview.error) {
          throw new Error(overview.error);
        }

        // Map overview data to KPI stats format
        setData({
          totalItems: overview.isEmpty ? 0 : overview.kpis.estimatedValue > 0 ? 1 : 0, // Approximate for now
          inStock: overview.isEmpty ? 0 : 1, // Approximate for now
          sold: 0, // Not provided by overview API yet
          totalValue: overview.kpis.estimatedValue,
          portfolioMarketValue: overview.kpis.estimatedValue,
          invested: overview.kpis.invested,
          unrealisedPL: overview.kpis.unrealisedPL,
          unrealisedPLPct: overview.kpis.roi,
          roi: overview.kpis.roi,
          delta7d: overview.kpis.unrealisedPLDelta7d || 0,
          lastUpdated: new Date().toISOString(),
          marketAsOf: overview.meta.pricesAsOf,
          itemsWithoutPrices: overview.kpis.missingPricesCount,
        });
        setError(null);
      } catch (err: any) {
        console.error('Failed to fetch KPI stats:', err);
        setError(err.message || 'Failed to fetch portfolio overview');
      } finally {
        setLoading(false);
      }
    };

    fetchKPIs();
  }, [userId, timeRange]);

  return { data, loading, error };
}

/**
 * Hook for fetching breakdown data by status
 */
export function useStatusBreakdown(userId: string | undefined) {
  const [data, setData] = useState<BreakdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchBreakdown = async () => {
      try {
        const { data: items, error: fetchError } = await supabase
          .from(TABLE_ITEMS)
          .select('status, market_value, sale_price, purchase_price')
          .eq('user_id', userId);

        if (fetchError) throw fetchError;

        // Group by status and calculate values
        const grouped = items?.reduce((acc: Record<string, number>, item) => {
          const status = item.status || 'unknown';
          const value = item.market_value || item.sale_price || item.purchase_price || 0;
          acc[status] = (acc[status] || 0) + value;
          return acc;
        }, {});

        const total = Object.values(grouped || {}).reduce((sum, val) => sum + val, 0);

        const breakdown = Object.entries(grouped || {}).map(([label, value]) => ({
          label: label.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          value,
          pct: total > 0 ? (value / total) * 100 : 0,
        }));

        setData(breakdown);
        setError(null);
      } catch (err: any) {
        console.error('Failed to fetch status breakdown:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBreakdown();
  }, [userId]);

  return { data, loading, error };
}

/**
 * Hook for fetching breakdown data by brand
 */
export function useBrandBreakdown(userId: string | undefined) {
  const [data, setData] = useState<BreakdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchBreakdown = async () => {
      try {
        const { data: items, error: fetchError } = await supabase
          .from(TABLE_ITEMS)
          .select('brand, market_value, sale_price, purchase_price')
          .eq('user_id', userId)
          .in('status', ['active', 'listed', 'worn']); // Only in-stock items for brand breakdown

        if (fetchError) throw fetchError;

        // Group by brand and calculate values
        const grouped = items?.reduce((acc: Record<string, number>, item) => {
          const brand = item.brand || 'Unknown';
          const value = item.market_value || item.sale_price || item.purchase_price || 0;
          acc[brand] = (acc[brand] || 0) + value;
          return acc;
        }, {});

        const total = Object.values(grouped || {}).reduce((sum, val) => sum + val, 0);

        const breakdown = Object.entries(grouped || {})
          .map(([label, value]) => ({
            label,
            value,
            pct: total > 0 ? (value / total) * 100 : 0,
          }))
          .sort((a, b) => b.value - a.value) // Sort by value descending
          .slice(0, 6); // Top 6 brands

        setData(breakdown);
        setError(null);
      } catch (err: any) {
        console.error('Failed to fetch brand breakdown:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBreakdown();
  }, [userId]);

  return { data, loading, error };
}

/**
 * Hook for fetching breakdown data by size
 */
export function useSizeBreakdown(userId: string | undefined) {
  const [data, setData] = useState<BreakdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchBreakdown = async () => {
      try {
        const { data: items, error: fetchError } = await supabase
          .from(TABLE_ITEMS)
          .select('size, market_value, sale_price, purchase_price')
          .eq('user_id', userId)
          .in('status', ['active', 'listed', 'worn']); // Only in-stock items for size breakdown

        if (fetchError) {
          console.error('Size breakdown fetch error:', fetchError);
          throw new Error(fetchError.message || 'Failed to fetch size breakdown');
        }

        // Group by size and calculate values
        const grouped = items?.reduce((acc: Record<string, number>, item) => {
          const size = item.size || 'Unknown';
          const value = item.market_value || item.sale_price || item.purchase_price || 0;
          acc[size] = (acc[size] || 0) + value;
          return acc;
        }, {});

        const total = Object.values(grouped || {}).reduce((sum, val) => sum + val, 0);

        const breakdown = Object.entries(grouped || {})
          .map(([label, value]) => ({
            label,
            value,
            pct: total > 0 ? (value / total) * 100 : 0,
          }))
          .sort((a, b) => b.value - a.value) // Sort by value descending
          .slice(0, 6); // Top 6 sizes

        setData(breakdown);
        setError(null);
      } catch (err: any) {
        const errorMsg = err?.message || 'Unknown error occurred';
        console.error('Failed to fetch size breakdown:', errorMsg, err);
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    fetchBreakdown();
  }, [userId]);

  return { data, loading, error };
}

/**
 * Hook for fetching portfolio chart data from valuation snapshots
 */
export function usePortfolioChart(userId: string | undefined, days: number = 30) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchChartData = async () => {
      try {
        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        // Fetch snapshots for user's items
        const { data: snapshots, error: fetchError } = await supabase
          .from('item_valuation_snapshots')
          .select('as_of, value, item_id')
          .gte('as_of', startDateStr)
          .lte('as_of', endDateStr)
          .order('as_of', { ascending: true });

        if (fetchError) throw fetchError;

        // Group by date and sum values
        const grouped = snapshots?.reduce((acc: Record<string, number>, snapshot) => {
          const date = snapshot.as_of;
          acc[date] = (acc[date] || 0) + (snapshot.value || 0);
          return acc;
        }, {});

        const chartData = Object.entries(grouped || {}).map(([date, value]) => ({
          date: new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          value,
        }));

        setData(chartData);
        setError(null);
      } catch (err: any) {
        console.error('Failed to fetch chart data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [userId, days]);

  return { data, loading, error };
}

/**
 * Hook for fetching items table data with filters, search, and sorting
 */
export function useItemsTable(userId: string | undefined, params: TableParams = {}) {
  const [data, setData] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchItems = async () => {
      try {
        let query = supabase
          .from(TABLE_ITEMS)
          .select('*')
          .eq('user_id', userId);

        // Apply status filter - default to active items only
        if (params.status && params.status.length > 0) {
          query = query.in('status', params.status);
        } else {
          // Default: show only active inventory (not sold items)
          query = query.in('status', ['active', 'listed', 'worn']);
        }

        // Apply brand filter
        if (params.brand && params.brand.length > 0) {
          query = query.in('brand', params.brand);
        }

        // Apply size filter
        if (params.size_uk && params.size_uk.length > 0) {
          query = query.in('size', params.size_uk.map(String));
        }

        // Apply search (across SKU, brand, model)
        if (params.search) {
          query = query.or(
            `sku.ilike.%${params.search}%,brand.ilike.%${params.search}%,model.ilike.%${params.search}%`
          );
        }

        // Execute query first to get items
        const { data: items, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        // Fetch StockX market links (all links are StockX-only, no provider column)
        const { data: stockxLinks } = await supabase
          .from('inventory_market_links')
          .select('item_id, stockx_product_id, stockx_variant_id');

        // Fetch StockX latest prices from stockx_market_latest materialized view
        // PHASE 3.3: StockX V2 API provides highest_bid & lowest_ask (no last_sale)
        const { data: stockxPrices } = await supabase
          .from('stockx_market_latest')
          .select('stockx_product_id, stockx_variant_id, lowest_ask, highest_bid, snapshot_at');

        // Build StockX maps
        const stockxLinkMap = new Map<string, any>();
        if (stockxLinks) {
          for (const link of stockxLinks) {
            stockxLinkMap.set(link.item_id, {
              product_id: link.stockx_product_id,
              variant_id: link.stockx_variant_id,
            });
          }
        }

        const stockxPriceMap = new Map<string, any>();
        if (stockxPrices) {
          for (const price of stockxPrices) {
            const key = `${price.stockx_product_id}:${price.stockx_variant_id}`;
            stockxPriceMap.set(key, price);
          }
        }

        // Transform to table rows and calculate P/L
        let tableRows: TableRow[] = (items || []).map((item: InventoryItem) => {
          // Check for StockX data first
          const stockxLink = stockxLinkMap.get(item.id);
          let market = item.market_value || null;
          let marketSource: string | null = null;
          let marketUpdatedAt: string | null = (item as any).market_updated_at || null;

          if (stockxLink) {
            // Look up price using stockx_product_id and stockx_variant_id from the mapping
            const priceKey = `${stockxLink.product_id}:${stockxLink.variant_id}`;
            const stockxPrice = stockxPriceMap.get(priceKey);

            // PHASE 3.3: Market price = highest_bid ?? lowest_ask ?? null
            const marketPrice = stockxPrice?.highest_bid ?? stockxPrice?.lowest_ask
            if (marketPrice) {
              market = marketPrice;
              marketSource = 'stockx';
              marketUpdatedAt = stockxPrice.snapshot_at;
            }
          }

          // Fallback to existing market_meta sources if no StockX data
          if (!marketSource) {
            const sources = (item as any).market_meta?.sources_used || [];
            marketSource = sources.length > 0 ? sources[0] : null;
          }

          const buy = item.purchase_price || 0;
          const pl = market ? market - buy : null;
          const plPct = market && buy > 0 ? ((market - buy) / buy) * 100 : null;

          return {
            id: item.id,
            thumb: item.image_url || '',
            title: `${item.brand} ${item.model}`,
            sku: item.sku || '',
            size: item.size || '',
            status: item.status,
            buy,
            market,
            marketSource,
            marketUpdatedAt,
            pl,
            plPct,
          };
        });

        // Apply client-side sorting (since P/L is calculated)
        if (params.sort) {
          const { key, dir } = params.sort;
          tableRows.sort((a, b) => {
            let aVal = (a as any)[key];
            let bVal = (b as any)[key];

            // Handle null values
            if (aVal === null && bVal === null) return 0;
            if (aVal === null) return dir === 'asc' ? 1 : -1;
            if (bVal === null) return dir === 'asc' ? -1 : 1;

            // Compare values
            if (typeof aVal === 'string' && typeof bVal === 'string') {
              return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }

            const numA = Number(aVal);
            const numB = Number(bVal);
            return dir === 'asc' ? numA - numB : numB - numA;
          });

          // Tie-break by created_at desc (most recent first)
          // Since we don't have created_at in TableRow, we'll skip tie-breaking
        } else {
          // Default sort: created_at desc (most recent first)
          // Already sorted by query order above, but items don't have created_at in TableRow
          // We'll maintain the order from the query
        }

        setData(tableRows);
        setError(null);
      } catch (err: any) {
        console.error('Failed to fetch items table:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [userId, params.status, params.brand, params.size_uk, params.search, params.sort]);

  return { data, loading, error };
}

/**
 * Hook for fetching distinct filter options (brands, sizes)
 */
export function useFilterOptions(userId: string | undefined) {
  const [brands, setBrands] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchOptions = async () => {
      try {
        const { data: items, error: fetchError } = await supabase
          .from(TABLE_ITEMS)
          .select('brand, size')
          .eq('user_id', userId);

        if (fetchError) throw fetchError;

        // Extract unique brands and sizes
        const uniqueBrands = Array.from(new Set((items || []).map((item) => item.brand).filter(Boolean))).sort();
        const uniqueSizes = Array.from(new Set((items || []).map((item) => item.size).filter(Boolean))).sort(
          (a, b) => {
            const numA = parseFloat(a);
            const numB = parseFloat(b);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.localeCompare(b);
          }
        );

        setBrands(uniqueBrands);
        setSizes(uniqueSizes);
      } catch (err: any) {
        console.error('Failed to fetch filter options:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOptions();
  }, [userId]);

  return { brands, sizes, loading };
}
