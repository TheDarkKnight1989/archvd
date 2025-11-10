/**
 * Settings → Integrations Page
 * Manage third-party integrations (Alias/GOAT, etc.)
 */

'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { isAliasEnabled } from '@/lib/config/alias';
import { useSearchParams } from 'next/navigation';

export default function IntegrationsPage() {
  const searchParams = useSearchParams();
  const [aliasEnabled, setAliasEnabled] = useState(false);
  const [stockxEnabled, setStockxEnabled] = useState(false);
  const [aliasStatus, setAliasStatus] = useState<{
    connected: boolean;
    mode?: 'disabled' | 'mock' | 'live';
    lastSync: string | null;
    username: string | null;
    listings: number;
    orders: number;
  } | null>(null);
  const [stockxStatus, setStockxStatus] = useState<{
    connected: boolean;
    mode?: 'disabled' | 'mock' | 'live';
    lastSyncListings: string | null;
    lastSyncSales: string | null;
    lastSyncPrices: string | null;
    accountEmail: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [stockxLoading, setStockxLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Check if Alias is enabled
    setAliasEnabled(process.env.NEXT_PUBLIC_ALIAS_ENABLE === 'true');
    setStockxEnabled(process.env.NEXT_PUBLIC_STOCKX_ENABLE === 'true');

    // Fetch Alias connection status
    fetchAliasStatus();
    fetchStockxStatus();

    // Check for OAuth callback success
    const connected = searchParams?.get('connected');
    if (connected === 'stockx') {
      alert('✅ StockX connected successfully!');
      // Remove query param
      window.history.replaceState({}, '', '/portfolio/settings/integrations');
    }

    // Check for OAuth errors
    const error = searchParams?.get('error');
    if (error) {
      const provider = searchParams?.get('provider');
      alert(`❌ Failed to connect ${provider}: ${error}`);
      window.history.replaceState({}, '', '/portfolio/settings/integrations');
    }
  }, []);

  async function fetchAliasStatus() {
    try {
      setLoading(true);

      // TODO: Create /api/alias/status endpoint
      // For now, simulate with local check
      const response = await fetch('/api/alias/status');

      if (response.ok) {
        const data = await response.json();
        setAliasStatus(data);
      } else {
        setAliasStatus({
          connected: false,
          mode: 'disabled',
          lastSync: null,
          username: null,
          listings: 0,
          orders: 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch Alias status:', error);
      setAliasStatus({
        connected: false,
        mode: 'disabled',
        lastSync: null,
        username: null,
        listings: 0,
        orders: 0,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    // TODO: Implement OAuth flow
    alert('OAuth flow not yet implemented');
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect from Alias (GOAT)? Your synced data will remain.')) {
      return;
    }

    try {
      await fetch('/api/alias/disconnect', { method: 'POST' });
      await fetchAliasStatus();
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  }

  async function handleSync() {
    try {
      const response = await fetch('/api/alias/sync', { method: 'POST' });
      if (response.ok) {
        alert('Sync started! Check back in a few moments.');
        await fetchAliasStatus();
      }
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }

  async function fetchStockxStatus() {
    try {
      setStockxLoading(true);

      const response = await fetch('/api/stockx/status');

      if (response.ok) {
        const data = await response.json();
        setStockxStatus(data);
      } else {
        setStockxStatus({
          connected: false,
          mode: process.env.NEXT_PUBLIC_STOCKX_MOCK === 'true' ? 'mock' : 'disabled',
          lastSyncListings: null,
          lastSyncSales: null,
          lastSyncPrices: null,
          accountEmail: null,
        });
      }
    } catch (error) {
      console.error('Failed to fetch StockX status:', error);
      setStockxStatus({
        connected: false,
        mode: 'disabled',
        lastSyncListings: null,
        lastSyncSales: null,
        lastSyncPrices: null,
        accountEmail: null,
      });
    } finally {
      setStockxLoading(false);
    }
  }

  async function handleStockxConnect() {
    window.location.href = '/api/stockx/oauth/start';
  }

  async function handleStockxDisconnect() {
    if (!confirm('Disconnect from StockX? Your synced data will remain.')) {
      return;
    }

    try {
      const response = await fetch('/api/stockx/oauth/disconnect', { method: 'POST' });
      if (response.ok) {
        await fetchStockxStatus();
        alert('✅ StockX disconnected successfully');
      } else {
        const data = await response.json();
        alert(`❌ Failed to disconnect: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Disconnect failed:', error);
      alert('❌ Failed to disconnect from StockX');
    }
  }

  async function handleStockxSyncListings() {
    if (syncing) return;

    try {
      setSyncing(true);
      const response = await fetch('/api/stockx/sync/listings', { method: 'POST' });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ Listings synced!\nFetched: ${data.fetched}\nMapped: ${data.mapped}`);
        await fetchStockxStatus();
      } else {
        const data = await response.json();
        alert(`❌ Sync failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Listings sync failed:', error);
      alert('❌ Failed to sync listings');
    } finally {
      setSyncing(false);
    }
  }

  async function handleStockxSyncSales() {
    if (syncing) return;

    try {
      setSyncing(true);
      const response = await fetch('/api/stockx/sync/sales', { method: 'POST' });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ Sales synced!\nFetched: ${data.fetched}\nCreated: ${data.created}\nUpdated: ${data.updated}`);
        await fetchStockxStatus();
      } else {
        const data = await response.json();
        alert(`❌ Sync failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Sales sync failed:', error);
      alert('❌ Failed to sync sales');
    } finally {
      setSyncing(false);
    }
  }

  async function handleStockxSyncPrices() {
    if (syncing) return;

    try {
      setSyncing(true);
      const response = await fetch('/api/stockx/sync/prices', { method: 'POST' });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ Prices synced!\nProcessed: ${data.processed}\nUpserted: ${data.upserted}`);
        await fetchStockxStatus();
      } else {
        const data = await response.json();
        alert(`❌ Sync failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Prices sync failed:', error);
      alert('❌ Failed to sync prices');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Integrations</h1>
        <p className="text-white/60 text-sm">
          Connect third-party marketplaces and services
        </p>
      </div>

      {/* Alias (GOAT) Integration */}
      <Card elevation={1} className="p-6">
        <div className="flex items-start gap-4">
          {/* Logo/Icon */}
          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-[#00FF94] to-[#00D97E] flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-black">G</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-white">Alias (GOAT)</h3>

              {!aliasEnabled && (
                <span className="px-2 py-0.5 text-xs rounded bg-gray-500/20 text-gray-400">
                  Disabled
                </span>
              )}

              {aliasEnabled && aliasStatus?.connected && aliasStatus.mode === 'mock' && (
                <span className="px-2 py-0.5 text-xs rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                  🧪 Mock Mode Active
                </span>
              )}

              {aliasEnabled && aliasStatus?.connected && aliasStatus.mode === 'live' && (
                <span className="px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-400">
                  Connected
                </span>
              )}

              {aliasEnabled && !aliasStatus?.connected && !loading && (
                <span className="px-2 py-0.5 text-xs rounded bg-gray-500/20 text-gray-400">
                  Not Connected
                </span>
              )}
            </div>

            <p className="text-sm text-white/60 mb-4">
              Sync your GOAT marketplace listings, orders, and sales data.
              Auto-import orders, track prices, and manage inventory.
            </p>

            {/* Status Details */}
            {aliasEnabled && aliasStatus?.connected && (
              <div className="grid grid-cols-3 gap-4 p-3 rounded-lg bg-white/5 border border-white/10 mb-4">
                <div>
                  <p className="text-xs text-white/40 mb-1">Username</p>
                  <p className="text-sm font-medium text-white">
                    {aliasStatus.username || 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">Active Listings</p>
                  <p className="text-sm font-medium text-white">
                    {aliasStatus.listings}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">Total Orders</p>
                  <p className="text-sm font-medium text-white">
                    {aliasStatus.orders}
                  </p>
                </div>
              </div>
            )}

            {aliasEnabled && aliasStatus?.connected && aliasStatus.lastSync && (
              <p className="text-xs text-white/40 mb-4">
                Last synced: {new Date(aliasStatus.lastSync).toLocaleString()}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              {!aliasEnabled && (
                <Button disabled variant="secondary" size="sm">
                  Not Available
                </Button>
              )}

              {aliasEnabled && !aliasStatus?.connected && !loading && (
                <Button onClick={handleConnect} variant="default" size="sm" disabled>
                  Connect Account
                </Button>
              )}

              {aliasEnabled && aliasStatus?.connected && (
                <>
                  <Button onClick={handleSync} variant="secondary" size="sm" disabled>
                    Sync Now
                  </Button>
                  <Button onClick={handleDisconnect} variant="secondary" size="sm" disabled>
                    Disconnect
                  </Button>
                </>
              )}

              {loading && (
                <span className="text-sm text-white/40">Loading...</span>
              )}
            </div>

            {!aliasEnabled && (
              <p className="text-xs text-white/40 mt-3">
                Set <code className="bg-white/10 px-1 rounded">NEXT_PUBLIC_ALIAS_ENABLE=true</code> in .env.local to enable
              </p>
            )}

            {aliasEnabled && aliasStatus?.mode === 'mock' && (
              <div className="mt-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-xs text-yellow-400/90">
                  <strong>Mock Mode:</strong> Using test data for development. Set{' '}
                  <code className="bg-white/10 px-1 rounded">NEXT_PUBLIC_ALIAS_MOCK=false</code> to enable live API calls.
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* StockX Integration */}
      <Card elevation={1} className="p-6">
        <div className="flex items-start gap-4">
          {/* Logo/Icon */}
          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-[#00B359] to-[#008A44] flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-white">Sx</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-white">StockX</h3>

              {!stockxEnabled && (
                <span className="px-2 py-0.5 text-xs rounded bg-gray-500/20 text-gray-400">
                  Disabled
                </span>
              )}

              {stockxEnabled && stockxStatus?.connected && stockxStatus.mode === 'mock' && (
                <span className="px-2 py-0.5 text-xs rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                  🧪 Mock Mode Active
                </span>
              )}

              {stockxEnabled && stockxStatus?.connected && stockxStatus.mode === 'live' && (
                <span className="px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-400">
                  Connected
                </span>
              )}

              {stockxEnabled && !stockxStatus?.connected && !stockxLoading && (
                <span className="px-2 py-0.5 text-xs rounded bg-gray-500/20 text-gray-400">
                  Not Connected
                </span>
              )}
            </div>

            <p className="text-sm text-white/60 mb-4">
              Sync your StockX listings, orders, and market prices.
              Auto-import sales, track pricing, and manage inventory across marketplaces.
            </p>

            {/* Status Details */}
            {stockxEnabled && stockxStatus?.connected && (
              <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-white/5 border border-white/10 mb-4">
                <div>
                  <p className="text-xs text-white/40 mb-1">Account</p>
                  <p className="text-sm font-medium text-white">
                    {stockxStatus.accountEmail || 'Connected'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">Last Price Sync</p>
                  <p className="text-sm font-medium text-white">
                    {stockxStatus.lastSyncPrices
                      ? new Date(stockxStatus.lastSyncPrices).toLocaleString()
                      : 'Never'}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {!stockxEnabled && (
                <Button disabled variant="secondary" size="sm">
                  Not Available
                </Button>
              )}

              {stockxEnabled && !stockxStatus?.connected && !stockxLoading && (
                <Button onClick={handleStockxConnect} variant="default" size="sm">
                  Connect Account
                </Button>
              )}

              {stockxEnabled && stockxStatus?.connected && (
                <>
                  <Button
                    onClick={handleStockxSyncListings}
                    variant="outline"
                    size="sm"
                    disabled={syncing}
                  >
                    {syncing ? 'Syncing...' : 'Sync Listings'}
                  </Button>
                  <Button
                    onClick={handleStockxSyncSales}
                    variant="outline"
                    size="sm"
                    disabled={syncing}
                  >
                    {syncing ? 'Syncing...' : 'Sync Sales'}
                  </Button>
                  <Button
                    onClick={handleStockxSyncPrices}
                    variant="outline"
                    size="sm"
                    disabled={syncing}
                  >
                    {syncing ? 'Syncing...' : 'Sync Prices'}
                  </Button>
                  <Button
                    onClick={handleStockxDisconnect}
                    variant="outline"
                    size="sm"
                    disabled={syncing}
                  >
                    Disconnect
                  </Button>
                </>
              )}

              {stockxLoading && (
                <span className="text-sm text-white/40">Loading...</span>
              )}
            </div>

            {!stockxEnabled && (
              <p className="text-xs text-white/40 mt-3">
                Set <code className="bg-white/10 px-1 rounded">NEXT_PUBLIC_STOCKX_ENABLE=true</code> in .env.local to enable
              </p>
            )}

            {stockxEnabled && stockxStatus?.mode === 'mock' && (
              <div className="mt-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-xs text-yellow-400/90">
                  <strong>Mock Mode:</strong> Using test data for development. Set{' '}
                  <code className="bg-white/10 px-1 rounded">NEXT_PUBLIC_STOCKX_MOCK=false</code> to enable live API calls.
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card elevation={1} className="p-6 opacity-50">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-white/50">F</span>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-white/70">Flight Club</h3>
              <span className="px-2 py-0.5 text-xs rounded bg-gray-500/20 text-gray-400">
                Coming Soon
              </span>
            </div>

            <p className="text-sm text-white/40 mb-4">
              Sync listings and orders from Flight Club marketplace.
            </p>

            <Button disabled variant="secondary" size="sm">
              Notify Me
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
