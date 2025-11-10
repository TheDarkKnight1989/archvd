/**
 * Alias (GOAT) Badge Component
 * Shows integration status on Inventory/Sales items
 */

'use client';

import { useState } from 'react';

interface AliasBadgeProps {
  /** GOAT listing status */
  status?: 'active' | 'sold' | 'cancelled' | 'expired' | null;

  /** Ask price on GOAT (in GBP) */
  askPrice?: number | null;

  /** When the item was listed */
  listedAt?: string | null;

  /** Number of views on GOAT */
  views?: number;

  /** Number of favorites on GOAT */
  favorites?: number;

  /** Show full details or compact */
  variant?: 'compact' | 'full';

  /** Mock mode active (shows 🧪 emoji) */
  mockMode?: boolean;
}

export function AliasBadge({
  status,
  askPrice,
  listedAt,
  views = 0,
  favorites = 0,
  variant = 'compact',
  mockMode = false,
}: AliasBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!status) {
    return null;
  }

  const statusColors = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    sold: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    expired: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  };

  const statusColor = statusColors[status] || statusColors.active;

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  if (variant === 'compact') {
    return (
      <div
        className="relative inline-flex items-center"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span
          className={`px-2 py-0.5 text-xs font-medium rounded border ${statusColor}`}
        >
          {mockMode && '🧪 '}GOAT
        </span>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute left-0 bottom-full mb-2 w-48 p-3 bg-black border border-white/20 rounded-lg shadow-lg z-50 text-left">
            <div className="space-y-2">
              <div>
                <p className="text-xs text-white/50">Status</p>
                <p className="text-sm font-medium text-white capitalize">{status}</p>
              </div>

              {askPrice !== null && askPrice !== undefined && (
                <div>
                  <p className="text-xs text-white/50">Ask Price</p>
                  <p className="text-sm font-medium text-white">£{askPrice.toFixed(2)}</p>
                </div>
              )}

              {listedAt && (
                <div>
                  <p className="text-xs text-white/50">Listed</p>
                  <p className="text-sm text-white">{formatDate(listedAt)}</p>
                </div>
              )}

              {(views > 0 || favorites > 0) && (
                <div className="pt-2 border-t border-white/10">
                  <p className="text-xs text-white/50">
                    {views} views • {favorites} favorites
                  </p>
                </div>
              )}

              {mockMode && (
                <div className="pt-2 border-t border-white/10">
                  <p className="text-xs text-yellow-400/80">
                    🧪 Mock Mode Active
                  </p>
                </div>
              )}
            </div>

            {/* Arrow */}
            <div className="absolute left-3 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white/20"></div>
          </div>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${statusColor}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{mockMode && '🧪 '}GOAT</span>
        <span className="text-xs opacity-70 capitalize">{status}</span>
      </div>

      {askPrice !== null && askPrice !== undefined && (
        <>
          <span className="text-white/20">•</span>
          <span className="text-sm font-mono">£{askPrice.toFixed(2)}</span>
        </>
      )}

      {listedAt && (
        <>
          <span className="text-white/20">•</span>
          <span className="text-xs opacity-70">{formatDate(listedAt)}</span>
        </>
      )}
    </div>
  );
}

/**
 * Sales-specific Alias badge showing net payout
 */
interface AliasSalesBadgeProps {
  /** Net payout after fees */
  netPayout: number;

  /** Currency */
  currency?: string;

  /** Order status */
  status?: string;

  /** Mock mode active (shows 🧪 emoji) */
  mockMode?: boolean;
}

export function AliasSalesBadge({
  netPayout,
  currency = 'GBP',
  status,
  mockMode = false,
}: AliasSalesBadgeProps) {
  const currencySymbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$';

  return (
    <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">
      <span className="text-xs font-medium">{mockMode && '🧪 '}GOAT</span>
      {status && (
        <>
          <span className="text-white/20">•</span>
          <span className="text-xs opacity-70 capitalize">{status}</span>
        </>
      )}
      <span className="text-white/20">•</span>
      <span className="text-xs font-mono">
        Net: {currencySymbol}{netPayout.toFixed(2)}
      </span>
    </div>
  );
}
