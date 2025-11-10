'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { TrendingDown, Bell } from 'lucide-react';

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
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/50">
            <th className="pb-3 font-medium">Item</th>
            <th className="pb-3 font-medium">SKU</th>
            <th className="pb-3 font-medium text-right">Target {currency}</th>
            <th className="pb-3 font-medium text-right">Current {currency}</th>
            <th className="pb-3 font-medium text-right">Δ %</th>
            <th className="pb-3 font-medium">Triggered</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {alerts.map((alert) => {
            const isBelow = alert.currentPrice !== null && alert.currentPrice <= alert.targetPrice;
            const deltaColor = alert.deltaPct && alert.deltaPct < 0 ? 'text-[#00FF94]' : 'text-white/60';

            return (
              <tr
                key={alert.id}
                className="hover:bg-white/5 transition-colors"
              >
                {/* Item */}
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-3">
                    {alert.imageUrl ? (
                      <div className="relative w-10 h-10 rounded overflow-hidden bg-black/40 flex-shrink-0">
                        <Image
                          src={alert.imageUrl}
                          alt={alert.name}
                          fill
                          className="object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded bg-white/10 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {alert.name}
                      </p>
                      {alert.size && (
                        <p className="text-xs text-white/50">{alert.size}</p>
                      )}
                    </div>
                  </div>
                </td>

                {/* SKU */}
                <td className="py-3 px-4">
                  <code className="text-xs text-white/70 font-mono">
                    {alert.sku}
                  </code>
                </td>

                {/* Target Price */}
                <td className="py-3 px-4 text-right font-mono text-sm text-white/70">
                  {formatPrice(alert.targetPrice, alert.currency)}
                </td>

                {/* Current Price */}
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {isBelow && (
                      <TrendingDown className="w-3.5 h-3.5 text-[#00FF94]" />
                    )}
                    <span className={`font-mono text-sm ${isBelow ? 'text-[#00FF94]' : 'text-white/70'}`}>
                      {formatPrice(alert.currentPrice, alert.currency)}
                    </span>
                  </div>
                </td>

                {/* Delta % */}
                <td className={`py-3 px-4 text-right font-mono text-sm ${deltaColor}`}>
                  {formatDelta(alert.deltaPct)}
                </td>

                {/* Triggered At */}
                <td className="py-3 pl-4 text-xs text-white/50">
                  {alert.triggeredAtFormatted}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
