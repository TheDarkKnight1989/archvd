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
import { useUserSettings } from '@/hooks/useUserSettings';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Settings2, DollarSign } from 'lucide-react';

export default function IntegrationsPage() {
  const searchParams = useSearchParams();
  const { settings, updateSettings } = useUserSettings();
  const [aliasEnabled, setAliasEnabled] = useState(false);
  const [stockxEnabled, setStockxEnabled] = useState(false);
  const [sellerLevelSaving, setSellerLevelSaving] = useState(false);
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
        alert(`✅ Listings synced!\nFetched: ${data.fetched}\nCreated/Updated: ${data.created || data.mapped || 0}\n\n${data.message || ''}`);
        await fetchStockxStatus();
      } else {
        const data = await response.json();
        const errorMsg = data.details ? `${data.error}\n\nDetails: ${data.details}` : data.error || 'Unknown error';
        alert(`❌ Sync failed: ${errorMsg}`);
        console.error('[StockX Sync] Error response:', data);
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
        const errorMsg = data.details ? `${data.error}\n\nDetails: ${data.details}` : data.error || 'Unknown error';
        alert(`❌ Sync failed: ${errorMsg}`);
        console.error('[StockX Sync Sales] Error response:', data);
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
        const errorMsg = data.details ? `${data.error}\n\nDetails: ${data.details}` : data.error || 'Unknown error';
        alert(`❌ Sync failed: ${errorMsg}`);
        console.error('[StockX Sync Prices] Error response:', data);
      }
    } catch (error) {
      console.error('Prices sync failed:', error);
      alert('❌ Failed to sync prices');
    } finally {
      setSyncing(false);
    }
  }

  async function handleSellerLevelChange(level: string) {
    const levelNum = parseInt(level, 10);
    if (isNaN(levelNum) || levelNum < 1 || levelNum > 5) return;

    try {
      setSellerLevelSaving(true);
      await updateSettings({ stockx_seller_level: levelNum });
      alert(`✅ Seller level updated to Level ${levelNum}`);
    } catch (error: any) {
      console.error('Failed to update seller level:', error);
      alert(`❌ Failed to update seller level: ${error.message}`);
    } finally {
      setSellerLevelSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-6">
      {/* Page Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-elev-1 to-elev-1/80 border-2 border-[#00FF94]/10 shadow-lg">
        <h1 className="font-display text-3xl font-semibold text-fg tracking-tight mb-2">
          Integrations
        </h1>
        <p className="text-sm text-fg/70 max-w-2xl">
          Connect third-party marketplaces and services to streamline your operations
        </p>
      </div>


      {/* Alias (GOAT) Integration */}
      <Card elevation="soft" className="p-0 border border-border/40 hover:border-border/60 hover:shadow-xl transition-all duration-300 overflow-hidden group bg-elev-1">
        <div className="flex flex-col md:flex-row items-stretch">
          {/* Logo/Icon */}
          <div className="w-full md:w-44 bg-elev-2 flex items-center justify-center flex-shrink-0 p-8 group-hover:bg-elev-3 transition-all duration-300">
            <img
              src="/images/providers/alias.png"
              alt="Alias"
              className="w-32 md:w-full h-auto object-contain group-hover:scale-105 transition-transform duration-300"
            />
          </div>

          {/* Content */}
          <div className="flex-1 p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-3">
              <h3 className="text-xl md:text-2xl font-bold text-fg tracking-tight">Alias (GOAT)</h3>

              {!aliasEnabled && (
                <span className="px-2.5 py-1 text-[10px] md:text-xs font-semibold rounded-full bg-muted/20 text-muted border border-muted/30">
                  Disabled
                </span>
              )}

              {aliasEnabled && aliasStatus?.connected && aliasStatus.mode === 'mock' && (
                <span className="px-2.5 py-1 text-[10px] md:text-xs font-semibold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  🧪 Mock Mode
                </span>
              )}

              {aliasEnabled && aliasStatus?.connected && aliasStatus.mode === 'live' && (
                <span className="px-2.5 py-1 text-[10px] md:text-xs font-semibold rounded-full bg-[#00FF94]/20 text-[#00FF94] border border-[#00FF94]/40">
                  ✓ Connected
                </span>
              )}

              {aliasEnabled && !aliasStatus?.connected && !loading && (
                <span className="px-2.5 py-1 text-[10px] md:text-xs font-semibold rounded-full bg-muted/20 text-muted border border-muted/30">
                  Not Connected
                </span>
              )}
            </div>

            <p className="text-sm md:text-base text-muted mb-6 md:mb-8 leading-relaxed max-w-2xl">
              Sync your GOAT marketplace listings, orders, and sales data.
              Auto-import orders, track prices, and manage inventory.
            </p>

            {/* Status Details */}
            {aliasEnabled && aliasStatus?.connected && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 p-4 md:p-5 rounded-xl bg-elev-2 border border-border/40 mb-6">
                <div>
                  <p className="text-xs font-medium text-dim mb-2 uppercase tracking-wide">Username</p>
                  <p className="text-sm md:text-base font-semibold text-fg">
                    {aliasStatus.username || 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-dim mb-2 uppercase tracking-wide">Active Listings</p>
                  <p className="text-sm md:text-base font-semibold text-fg">
                    {aliasStatus.listings}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-dim mb-2 uppercase tracking-wide">Total Orders</p>
                  <p className="text-sm md:text-base font-semibold text-fg">
                    {aliasStatus.orders}
                  </p>
                </div>
              </div>
            )}

            {aliasEnabled && aliasStatus?.connected && aliasStatus.lastSync && (
              <p className="text-sm text-muted mb-6">
                Last synced: {new Date(aliasStatus.lastSync).toLocaleString()}
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
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
                  <Button onClick={handleSync} variant="outline" size="sm" disabled>
                    Sync Now
                  </Button>
                  <Button onClick={handleDisconnect} variant="outline" size="sm" disabled>
                    Disconnect
                  </Button>
                </>
              )}

              {loading && (
                <span className="text-sm text-muted">Loading...</span>
              )}
            </div>

            {/* Divider */}
            {aliasEnabled && <div className="border-t border-border/40 my-6"></div>}

            {/* Seller Configuration */}
            {aliasEnabled && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-muted" />
                  <h4 className="text-sm font-semibold text-fg">Seller Configuration</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {/* Region & Shipping */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="alias-region" className="text-sm font-medium text-fg">
                        Region
                      </Label>
                      <Select
                        value={settings?.alias_region || 'uk'}
                        onValueChange={(value) => updateSettings({ alias_region: value })}
                      >
                        <SelectTrigger id="alias-region" className="bg-elev-0 border-border">
                          <SelectValue placeholder="Select region..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="uk">United Kingdom</SelectItem>
                          <SelectItem value="de">Germany</SelectItem>
                          <SelectItem value="nl">Netherlands</SelectItem>
                          <SelectItem value="fr">France</SelectItem>
                          <SelectItem value="at">Austria</SelectItem>
                          <SelectItem value="be">Belgium</SelectItem>
                          <SelectItem value="it">Italy</SelectItem>
                          <SelectItem value="es">Spain</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="alias-shipping" className="text-sm font-medium text-fg">
                        Shipping Method
                      </Label>
                      <Select
                        value={settings?.alias_shipping_method || 'dropoff'}
                        onValueChange={(value) => updateSettings({ alias_shipping_method: value })}
                      >
                        <SelectTrigger id="alias-shipping" className="bg-elev-0 border-border">
                          <SelectValue placeholder="Select method..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dropoff">Drop-off</SelectItem>
                          <SelectItem value="prepaid">Prepaid Shipping</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="alias-commission" className="text-sm font-medium text-fg">
                        Commission Fee (%)
                      </Label>
                      <input
                        id="alias-commission"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={settings?.alias_commission_fee || 9.5}
                        onChange={(e) => updateSettings({ alias_commission_fee: parseFloat(e.target.value) })}
                        className="w-full h-10 px-3 rounded-lg bg-elev-0 border border-border text-fg focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors"
                      />
                      <p className="text-xs text-muted">
                        Standard commission is 9.5% (changes based on seller rating)
                      </p>
                    </div>
                  </div>

                  {/* Fee Breakdown */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-fg">Fee Structure</Label>
                    <div className="p-4 rounded-xl bg-elev-2 border border-border/40 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted">Commission Fee:</span>
                        <span className="font-medium text-fg mono">
                          {(settings?.alias_commission_fee || 9.5).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted">Seller Fee:</span>
                        <span className="font-medium text-fg mono">
                          {(() => {
                            const region = settings?.alias_region || 'uk';
                            const method = settings?.alias_shipping_method || 'dropoff';
                            const fees: Record<string, { dropoff: number; prepaid: number }> = {
                              uk: { dropoff: 2, prepaid: 5 },
                              de: { dropoff: 2, prepaid: 5 },
                              nl: { dropoff: 3, prepaid: 6 },
                              fr: { dropoff: 6, prepaid: 6 },
                              at: { dropoff: 6, prepaid: 6 },
                              be: { dropoff: 6, prepaid: 6 },
                              it: { dropoff: 8, prepaid: 8 },
                              es: { dropoff: 8, prepaid: 8 },
                            };
                            return `$${fees[region]?.[method as 'dropoff' | 'prepaid'] || 0}`;
                          })()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted">Cash Out Fee:</span>
                        <span className="font-medium text-fg mono">2.9%</span>
                      </div>
                      <div className="border-t border-border/40 pt-3 flex justify-between text-sm">
                        <span className="font-medium text-fg">Est. Total Fees:</span>
                        <span className="font-semibold text-fg mono">
                          {(() => {
                            const commission = settings?.alias_commission_fee || 9.5;
                            const cashOut = 2.9;
                            return `${(commission + cashOut).toFixed(1)}% + seller fee`;
                          })()}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted">
                      Fees calculated based on selected region and shipping method
                    </p>
                  </div>
                </div>

                {/* Info Banner */}
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 md:p-4">
                  <p className="text-xs text-blue-400/90 leading-relaxed">
                    <DollarSign className="inline h-3.5 w-3.5 mr-1" />
                    <strong>Note:</strong> Commission fees increase with seller cancellations (15% for rating 70-89, 20% for 50-69, 25% below 50). Configure your standard fee here for accurate payout calculations.
                  </p>
                </div>
              </div>
            )}

            {!aliasEnabled && (
              <p className="text-sm text-muted mt-4 p-3 md:p-4 rounded-xl bg-elev-2 border border-border/40">
                Set <code className="bg-elev-1 px-2 py-1 rounded text-xs font-mono text-accent">NEXT_PUBLIC_ALIAS_ENABLE=true</code> in .env.local to enable
              </p>
            )}

            {aliasEnabled && aliasStatus?.mode === 'mock' && (
              <div className="mt-4 p-3 md:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <p className="text-sm text-amber-400/90">
                  <strong>Mock Mode:</strong> Using test data for development. Set{' '}
                  <code className="bg-elev-1 px-2 py-1 rounded text-xs font-mono text-amber-400">NEXT_PUBLIC_ALIAS_MOCK=false</code> to enable live API calls.
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* StockX Setup - Unified Card */}
      {stockxEnabled && (
        <Card elevation="soft" className="p-0 border border-border/40 hover:border-[#00B359]/40 hover:shadow-xl transition-all duration-300 overflow-hidden group bg-elev-1">
          <div className="flex flex-col md:flex-row items-stretch">
            {/* Logo/Icon */}
            <div className="w-full md:w-44 bg-white flex items-center justify-center flex-shrink-0 p-8 group-hover:bg-gray-50 transition-all duration-300">
              <img
                src="/images/providers/stockx.png"
                alt="StockX"
                className="w-32 md:w-full h-auto object-contain group-hover:scale-105 transition-transform duration-300"
              />
            </div>

            {/* Content */}
            <div className="flex-1 p-6 md:p-8">
              {/* Header */}
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-3">
                <h3 className="text-xl md:text-2xl font-bold text-fg tracking-tight">StockX</h3>

                {stockxStatus?.connected && stockxStatus.mode === 'mock' && (
                  <span className="px-2.5 py-1 text-[10px] md:text-xs font-semibold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
                    🧪 Mock Mode
                  </span>
                )}

                {stockxStatus?.connected && stockxStatus.mode === 'live' && (
                  <span className="px-2.5 py-1 text-[10px] md:text-xs font-semibold rounded-full bg-[#00FF94]/20 text-[#00FF94] border border-[#00FF94]/40">
                    <CheckCircle2 className="inline h-3 w-3 mr-1" />
                    Connected
                  </span>
                )}

                {!stockxStatus?.connected && !stockxLoading && (
                  <span className="px-2.5 py-1 text-[10px] md:text-xs font-semibold rounded-full bg-muted/20 text-muted border border-muted/30">
                    Not Connected
                  </span>
                )}
              </div>

              <p className="text-sm md:text-base text-muted mb-6 md:mb-8 leading-relaxed max-w-2xl">
                Connect your StockX account, configure seller settings, and sync listings, sales, and market prices.
              </p>

              {/* Connection Status & Actions */}
              {stockxStatus?.connected && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 p-4 md:p-5 rounded-xl bg-elev-2 border border-border/40 mb-6">
                  <div>
                    <p className="text-xs font-medium text-dim mb-2 uppercase tracking-wide">Account</p>
                    <p className="text-sm md:text-base font-semibold text-fg">
                      {stockxStatus.accountEmail || 'Connected'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-dim mb-2 uppercase tracking-wide">Last Price Sync</p>
                    <p className="text-sm md:text-base font-semibold text-fg">
                      {stockxStatus.lastSyncPrices
                        ? new Date(stockxStatus.lastSyncPrices).toLocaleString()
                        : 'Never'}
                    </p>
                  </div>
                </div>
              )}

              {/* Connection Actions */}
              <div className="flex items-center gap-2 flex-wrap mb-6">
                {!stockxStatus?.connected && !stockxLoading && (
                  <Button onClick={handleStockxConnect} variant="default" size="sm" className="bg-accent text-black hover:bg-[#00E085]">
                    Connect Account
                  </Button>
                )}

                {stockxStatus?.connected && (
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
                  <span className="text-sm text-muted">Loading...</span>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-border/40 my-6"></div>

              {/* Seller Level Configuration */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-muted" />
                  <h4 className="text-sm font-semibold text-fg">Seller Configuration</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="seller-level" className="text-sm font-medium text-fg">
                      Seller Level
                    </Label>
                    <Select
                      value={settings?.stockx_seller_level?.toString() || '1'}
                      onValueChange={handleSellerLevelChange}
                      disabled={sellerLevelSaving}
                    >
                      <SelectTrigger id="seller-level" className="bg-elev-0 border-border">
                        <SelectValue placeholder="Select level..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Level 1 (9% fee)</SelectItem>
                        <SelectItem value="2">Level 2 (8.5% fee)</SelectItem>
                        <SelectItem value="3">Level 3 (8% fee)</SelectItem>
                        <SelectItem value="4">Level 4 (7.5% fee)</SelectItem>
                        <SelectItem value="5">Level 5 (7% fee)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted">
                      {sellerLevelSaving ? 'Saving...' : 'Your seller level affects transaction fees'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-fg">Fee Structure</Label>
                    <div className="p-4 rounded-xl bg-elev-2 border border-border/40 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted">Transaction Fee:</span>
                        <span className="font-medium text-fg mono">
                          {settings?.stockx_seller_level === 1 && '9%'}
                          {settings?.stockx_seller_level === 2 && '8.5%'}
                          {settings?.stockx_seller_level === 3 && '8%'}
                          {settings?.stockx_seller_level === 4 && '7.5%'}
                          {settings?.stockx_seller_level === 5 && '7%'}
                          {!settings?.stockx_seller_level && '9%'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted">Processing Fee:</span>
                        <span className="font-medium text-fg mono">3%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted">Shipping:</span>
                        <span className="font-medium text-fg mono">£4.00</span>
                      </div>
                      <div className="border-t border-border/40 pt-3 flex justify-between text-sm">
                        <span className="font-medium text-fg">Total Fees:</span>
                        <span className="font-semibold text-fg mono">
                          {settings?.stockx_seller_level === 1 && '12%'}
                          {settings?.stockx_seller_level === 2 && '11.5%'}
                          {settings?.stockx_seller_level === 3 && '11%'}
                          {settings?.stockx_seller_level === 4 && '10.5%'}
                          {settings?.stockx_seller_level === 5 && '10%'}
                          {!settings?.stockx_seller_level && '12%'}
                          {' + £4'}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted">
                      Shipping cost applies to all regions
                    </p>
                  </div>
                </div>

                {/* Info Banner */}
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 md:p-4">
                  <p className="text-xs text-blue-400/90 leading-relaxed">
                    <DollarSign className="inline h-3.5 w-3.5 mr-1" />
                    <strong>Pro Tip:</strong> Setting your correct seller level ensures accurate payout calculations across all StockX listings and market data.
                  </p>
                </div>
              </div>

              {/* Mock Mode Warning */}
              {stockxStatus?.mode === 'mock' && (
                <div className="mt-4 p-3 md:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <p className="text-sm text-amber-400/90">
                    <strong>Mock Mode:</strong> Using test data for development. Set{' '}
                    <code className="bg-elev-1 px-2 py-1 rounded text-xs font-mono text-amber-400">NEXT_PUBLIC_STOCKX_MOCK=false</code> to enable live API calls.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* StockX Disabled State */}
      {!stockxEnabled && (
        <Card elevation="soft" className="p-0 opacity-50 overflow-hidden border border-border/40 bg-elev-1">
          <div className="flex flex-col md:flex-row items-stretch">
            <div className="w-full md:w-44 bg-white/10 flex items-center justify-center flex-shrink-0 p-8">
              <img
                src="/images/providers/stockx.png"
                alt="StockX"
                className="w-32 md:w-full h-auto object-contain opacity-40"
              />
            </div>

            <div className="flex-1 p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-3">
                <h3 className="text-xl md:text-2xl font-bold text-muted tracking-tight">StockX</h3>
                <span className="px-2.5 py-1 text-[10px] md:text-xs font-semibold rounded-full bg-muted/20 text-muted border border-muted/30">
                  Disabled
                </span>
              </div>

              <p className="text-sm md:text-base text-muted mb-6 md:mb-8 leading-relaxed max-w-2xl">
                StockX integration is currently disabled. Enable it to connect your account and sync data.
              </p>

              <Button disabled variant="secondary" size="sm">
                Not Available
              </Button>

              <p className="text-sm text-muted mt-4 p-3 md:p-4 rounded-xl bg-elev-2 border border-border/40">
                Set <code className="bg-elev-1 px-2 py-1 rounded text-xs font-mono text-accent">NEXT_PUBLIC_STOCKX_ENABLE=true</code> in .env.local to enable
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Shopify Integration - Coming Soon */}
      <Card elevation="soft" className="p-0 opacity-60 hover:opacity-80 transition-all duration-300 overflow-hidden group border border-border/40 bg-elev-1">
        <div className="flex flex-col md:flex-row items-stretch">
          <div className="w-full md:w-44 bg-gradient-to-br from-[#96BF48]/30 to-[#5E8E3E]/30 flex items-center justify-center flex-shrink-0 p-8 group-hover:from-[#96BF48]/40 group-hover:to-[#5E8E3E]/40 transition-all duration-300">
            <span className="text-7xl font-bold text-fg/30 group-hover:text-fg/40 transition-colors duration-300">S</span>
          </div>

          <div className="flex-1 p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-3">
              <h3 className="text-xl md:text-2xl font-bold text-muted tracking-tight">Shopify</h3>
              <span className="px-2.5 py-1 text-[10px] md:text-xs font-semibold rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                Coming Soon
              </span>
            </div>

            <p className="text-sm md:text-base text-muted mb-6 md:mb-8 leading-relaxed max-w-2xl">
              Connect your Shopify store to sync products, orders, and inventory.
            </p>

            <Button disabled variant="secondary" size="sm">
              Notify Me
            </Button>
          </div>
        </div>
      </Card>

      {/* eBay Integration - Coming Soon */}
      <Card elevation="soft" className="p-0 opacity-60 hover:opacity-80 transition-all duration-300 overflow-hidden group border border-border/40 bg-elev-1">
        <div className="flex flex-col md:flex-row items-stretch">
          <div className="w-full md:w-44 bg-gradient-to-br from-[#E53238]/30 to-[#0064D2]/30 flex items-center justify-center flex-shrink-0 p-8 group-hover:from-[#E53238]/40 group-hover:to-[#0064D2]/40 transition-all duration-300">
            <span className="text-7xl font-bold text-fg/30 group-hover:text-fg/40 transition-colors duration-300">E</span>
          </div>

          <div className="flex-1 p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-3">
              <h3 className="text-xl md:text-2xl font-bold text-muted tracking-tight">eBay</h3>
              <span className="px-2.5 py-1 text-[10px] md:text-xs font-semibold rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                Coming Soon
              </span>
            </div>

            <p className="text-sm md:text-base text-muted mb-6 md:mb-8 leading-relaxed max-w-2xl">
              Sync your eBay listings, sales, and inventory data.
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
