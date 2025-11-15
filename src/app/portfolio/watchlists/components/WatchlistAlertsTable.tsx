'use client';

import { useState, useEffect } from 'react';
import { TrendingDown, Bell } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { TableBase, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/TableBase';
import { ProductLineItem } from '@/components/product/ProductLineItem';

interface WatchlistAlert {
  id: string;
  sku: string;
  size: string | null;
  name: string;
  imageUrl: string;
  targetPrice: number;
  currentPrice: number | null;
  deltaPct: number | null;
  currency: string;
  watchlistName: string;
  triggeredAt: string;
  triggeredAtFormatted: string;
  category: 'pokemon' | 'sneaker';
}

interface WatchlistAlertsTableProps {
  currency?: 'GBP' | 'EUR' | 'USD';
}

export function WatchlistAlertsTable({ currency = 'GBP' }: WatchlistAlertsTableProps) {
  const [alerts, setAlerts] = useState<WatchlistAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchAlerts() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/watchlists/alerts?currency=${currency}&days=7`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch alerts');
        }

        const data = await response.json();
        setAlerts(data.alerts || []);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Failed to load alerts');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchAlerts();

    return () => {
      controller.abort();
    };
  }, [currency]);

  const formatPrice = (price: number | null, curr: string) => {
    if (price === null) return '—';
    const symbol = curr === 'GBP' ? '£' : curr === 'EUR' ? '€' : '$';
    return `${symbol}${price.toFixed(2)}`;
  };

  const formatDelta = (pct: number | null) => {
    if (pct === null) return '—';
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-16 bg-black/20 border border-white/10 rounded animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400">Error: {error}</p>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="p-12 text-center">
        <Bell className="w-12 h-12 mx-auto mb-4 text-white/20" />
        <p className="text-white/40 text-sm">No alerts in the last 7 days.</p>
        <p className="text-white/30 text-xs mt-2">
          Add items to your watchlist with target prices to receive alerts.
        </p>
      </div>
    );
  }

  return (
    <TableBase>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead align="right">Target {currency}</TableHead>
          <TableHead align="right">Current {currency}</TableHead>
          <TableHead align="right">Δ %</TableHead>
          <TableHead>Triggered</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {alerts.map((alert, index) => {
          const isBelow = alert.currentPrice !== null && alert.currentPrice <= alert.targetPrice;
          const deltaColor = alert.deltaPct && alert.deltaPct < 0 ? 'money-pos' : 'text-muted';

          // Parse brand and model from name (assuming format: "Brand Model")
          const nameParts = alert.name.split(' ');
          const brand = nameParts[0] || '';
          const model = nameParts.slice(1).join(' ') || alert.name;

          return (
            <TableRow key={alert.id} index={index}>
              {/* Item - Using ProductLineItem */}
              <TableCell>
                <ProductLineItem
                  imageUrl={alert.imageUrl || null}
                  imageAlt={alert.name}
                  brand={brand}
                  model={model}
                  variant={undefined}
                  sku={alert.sku}
                  href={`/product/${alert.sku}`}
                  sizeUk={alert.size}
                  sizeSystem="UK"
                  category={alert.category === 'sneaker' ? 'sneakers' : alert.category}
                  compact
                />
              </TableCell>

              {/* Target Price */}
              <TableCell align="right" mono>
                <div className="text-sm text-muted">
                  {formatPrice(alert.targetPrice, alert.currency)}
                </div>
              </TableCell>

              {/* Current Price */}
              <TableCell align="right" mono>
                <div className="flex items-center justify-end gap-1.5">
                  {isBelow && (
                    <TrendingDown className="w-3.5 h-3.5 money-pos" />
                  )}
                  <span className={`text-sm ${isBelow ? 'money-pos' : 'text-muted'}`}>
                    {formatPrice(alert.currentPrice, alert.currency)}
                  </span>
                </div>
              </TableCell>

              {/* Delta % */}
              <TableCell align="right" mono>
                <span className={`text-sm ${deltaColor}`}>
                  {formatDelta(alert.deltaPct)}
                </span>
              </TableCell>

              {/* Triggered At */}
              <TableCell>
                <div className="text-xs text-muted">
                  {alert.triggeredAtFormatted}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </TableBase>
  );
}
