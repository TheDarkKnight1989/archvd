/**
 * Alias Map Indicator Component
 * Shows if inventory item is mapped to Alias/GOAT product
 */

'use client';

import { useState } from 'react';

interface AliasMapIndicatorProps {
  /** Mapping status */
  status?: 'mapped' | 'unmatched' | 'unmapped' | null;

  /** Alias product SKU (if mapped) */
  aliasProductSku?: string | null;

  /** Alias product ID (if mapped) */
  aliasProductId?: string | null;

  /** Is mock mode active */
  mockMode?: boolean;

  /** Compact or full variant */
  variant?: 'compact' | 'full';
}

export function AliasMapIndicator({
  status,
  aliasProductSku,
  aliasProductId,
  mockMode = false,
  variant = 'compact',
}: AliasMapIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!status || status === 'unmapped') {
    return <span className="text-xs text-white/30">—</span>;
  }

  // Mapped status
  if (status === 'mapped') {
    if (variant === 'compact') {
      return (
        <div
          className="relative inline-flex items-center"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <span className="text-sm" title="Mapped to Alias/GOAT">
            {mockMode ? '🧪' : '🧩'}
          </span>

          {/* Tooltip */}
          {showTooltip && aliasProductSku && (
            <div className="absolute left-0 bottom-full mb-2 w-48 p-3 bg-black border border-white/20 rounded-lg shadow-lg z-50 text-left whitespace-normal">
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-white/50">Alias SKU</p>
                  <p className="text-sm font-medium text-white">{aliasProductSku}</p>
                </div>

                {mockMode && (
                  <div className="pt-2 border-t border-white/10">
                    <p className="text-xs text-yellow-400/80">
                      🧪 Mock Mode Active
                    </p>
                  </div>
                )}

                {!mockMode && (
                  <div className="pt-2 border-t border-white/10">
                    <p className="text-xs text-green-400/80">
                      ✓ Linked to GOAT
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
      <div className="inline-flex items-center gap-2 px-2 py-1 rounded bg-green-500/10 border border-green-500/20">
        <span className="text-sm">{mockMode ? '🧪' : '🧩'}</span>
        <span className="text-xs text-green-400">
          {mockMode ? 'Mock Mapped' : 'GOAT Linked'}
        </span>
        {aliasProductSku && (
          <>
            <span className="text-white/20">•</span>
            <span className="text-xs text-white/60 font-mono">{aliasProductSku}</span>
          </>
        )}
      </div>
    );
  }

  // Unmatched status
  if (status === 'unmatched') {
    if (variant === 'compact') {
      return (
        <div
          className="relative inline-flex items-center"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <span className="text-sm text-orange-400" title="Not matched to Alias">
            ⚠️
          </span>

          {/* Tooltip */}
          {showTooltip && (
            <div className="absolute left-0 bottom-full mb-2 w-48 p-3 bg-black border border-white/20 rounded-lg shadow-lg z-50 text-left whitespace-normal">
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-white/50">Status</p>
                  <p className="text-sm font-medium text-orange-400">Not Matched</p>
                </div>

                <p className="text-xs text-white/60">
                  This SKU could not be matched to an Alias/GOAT product
                </p>
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
      <div className="inline-flex items-center gap-2 px-2 py-1 rounded bg-orange-500/10 border border-orange-500/20">
        <span className="text-sm">⚠️</span>
        <span className="text-xs text-orange-400">Not Matched</span>
      </div>
    );
  }

  return null;
}
