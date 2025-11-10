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
        // Query portfolio_latest_prices view instead of inventory table
        const { data: portfolioItems, error: fetchError } = await supabase
          .from('portfolio_latest_prices')
          .select('*');

        if (fetchError) throw fetchError;

        // Also query inventory table for status and timestamps to apply time-range filter
        let inventoryQuery = supabase
          .from(TABLE_ITEMS)
          .select('id, status, created_at, sale_price')
          .eq('user_id', userId);

        // Apply time-range filter
        if (timeRange !== 'lifetime') {
          const now = new Date();
          let startDate = new Date();

          switch (timeRange) {
            case 'today':
              startDate.setHours(0, 0, 0, 0);
              break;
            case '7d':
              startDate.setDate(now.getDate() - 7);
              break;
            case '30d':
              startDate.setDate(now.getDate() - 30);
              break;
            case '90d':
              startDate.setDate(now.getDate() - 90);
              break;
          }

          inventoryQuery = inventoryQuery.gte('created_at', startDate.toISOString());
        }

        const { data: inventoryItems, error: inventoryError } = await inventoryQuery;

        if (inventoryError) throw inventoryError;

        // Merge data: use portfolio_latest_prices for pricing, inventory for status/timestamps
        const items = portfolioItems?.map((portfolioItem) => {
          const inventoryItem = inventoryItems?.find((inv) => inv.id === portfolioItem.inventory_id);
          return {
            status: portfolioItem.status || inventoryItem?.status,
            market_value: portfolioItem.market_price,
            sale_price: inventoryItem?.sale_price,
            purchase_price: portfolioItem.purchase_price,
            created_at: inventoryItem?.created_at,
            market_as_of: portfolioItem.market_as_of,
          };
        }).filter((item) => {
          // Apply time filter based on created_at
          if (timeRange === 'lifetime') return true;
          return inventoryItems?.some((inv) => inv.id === item.created_at); // This will be filtered by the inventoryQuery
        });

        const totalItems = items?.length || 0;
        const inStock = items?.filter((item) => ['active', 'listed', 'worn'].includes(item.status)).length || 0;
        const sold = items?.filter((item) => item.status === 'sold').length || 0;

        const inStockItems = items?.filter((item) => ['active', 'listed', 'worn'].includes(item.status)) || [];

        // Calculate total value (in stock items: market_value or sale_price or purchase_price)
        const totalValue = inStockItems.reduce((sum, item) => {
          const value = item.market_value || item.sale_price || item.purchase_price || 0;
          return sum + value;
        }, 0);

        // Calculate Portfolio Market Value (total market value of in-stock items)
        const portfolioMarketValue = inStockItems.reduce((sum, item) => {
          const value = item.market_value || item.purchase_price || 0;
          return sum + value;
        }, 0);

        // Calculate Invested (total purchase price of in-stock items)
        const invested = inStockItems.reduce((sum, item) => {
          return sum + (item.purchase_price || 0);
        }, 0);

        // Calculate Unrealised P/L and ROI
        const unrealisedPL = portfolioMarketValue - invested;
        const unrealisedPLPct = invested > 0 ? (unrealisedPL / invested) * 100 : 0;
        const roi = unrealisedPLPct;

        // Calculate 7d delta (fetch portfolio value from 7 days ago)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: itemsSevenDaysAgo } = await supabase
          .from(TABLE_ITEMS)
          .select('status, market_value, purchase_price')
          .eq('user_id', userId)
          .lte('created_at', sevenDaysAgo.toISOString());

        const inStockItems7d = itemsSevenDaysAgo?.filter((item) => ['active', 'listed', 'worn'].includes(item.status)) || [];
        const portfolioValue7d = inStockItems7d.reduce((sum, item) => {
          const value = item.market_value || item.purchase_price || 0;
          return sum + value;
        }, 0);

        const delta7d = portfolioMarketValue - portfolioValue7d;

        // Get most recent market update timestamp
        const lastUpdated = inStockItems.length > 0
          ? new Date().toISOString()
          : null;

        // Calculate market provenance: get the latest market_as_of timestamp
        const marketTimestamps = items
          ?.filter((item) => item.market_as_of)
          .map((item) => new Date(item.market_as_of).getTime())
          .filter((t) => !isNaN(t));

        const marketAsOf = marketTimestamps && marketTimestamps.length > 0
          ? new Date(Math.max(...marketTimestamps)).toISOString()
          : null;

        // Count items without market prices (in stock items only)
        const itemsWithoutPrices = inStockItems.filter((item) => !item.market_value).length;

        setData({
          totalItems,
          inStock,
          sold,
          totalValue,
          portfolioMarketValue,
          invested,
          unrealisedPL,
          unrealisedPLPct,
          roi,
          delta7d,
          lastUpdated,
          marketAsOf,
          itemsWithoutPrices,
        });
        setError(null);
      } catch (err: any) {
        console.error('Failed to fetch KPI stats:', err);
        setError(err.message);
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

        // Apply status filter
        if (params.status && params.status.length > 0) {
          query = query.in('status', params.status);
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

        // Fetch StockX market links
        const { data: stockxLinks } = await supabase
          .from('inventory_market_links')
          .select('inventory_id, provider_product_sku')
          .eq('provider', 'stockx');

        // Fetch StockX latest prices
        const { data: stockxPrices } = await supabase
          .from('stockx_latest_prices')
          .select('sku, size, lowest_ask, last_sale, as_of');

        // Build StockX maps
        const stockxLinkMap = new Map<string, any>();
        if (stockxLinks) {
          for (const link of stockxLinks) {
            stockxLinkMap.set(link.inventory_id, {
              product_sku: link.provider_product_sku,
            });
          }
        }

        const stockxPriceMap = new Map<string, any>();
        if (stockxPrices) {
          for (const price of stockxPrices) {
            const key = `${price.sku}:${price.size}`;
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
            const priceKey = `${stockxLink.product_sku}:${item.size}`;
            const stockxPrice = stockxPriceMap.get(priceKey);

            if (stockxPrice?.last_sale) {
              // Prefer StockX last_sale over existing market_value
              market = stockxPrice.last_sale;
              marketSource = 'stockx';
              marketUpdatedAt = stockxPrice.as_of;
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
