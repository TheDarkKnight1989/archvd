/**
 * Accounting Software Integration Component
 * Connect to QuickBooks, Xero, and other accounting platforms
 */

'use client'

import { useState } from 'react'
import { Link2, Check, RefreshCw, AlertCircle, Download, Upload } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'

interface AccountingPlatform {
  id: string
  name: string
  logo: string
  connected: boolean
  lastSync?: Date
  syncStatus?: 'success' | 'error' | 'syncing'
  features: {
    exportTransactions: boolean
    importExpenses: boolean
    autoSync: boolean
    taxReporting: boolean
  }
}

interface AccountingIntegrationProps {
  onConnect?: (platformId: string) => Promise<void>
  onDisconnect?: (platformId: string) => Promise<void>
  onSync?: (platformId: string) => Promise<void>
  className?: string
}

export function AccountingIntegration({
  onConnect,
  onDisconnect,
  onSync,
  className
}: AccountingIntegrationProps) {
  const [platforms, setPlatforms] = useState<AccountingPlatform[]>([
    {
      id: 'quickbooks',
      name: 'QuickBooks Online',
      logo: '📊',
      connected: false,
      features: {
        exportTransactions: true,
        importExpenses: true,
        autoSync: true,
        taxReporting: true
      }
    },
    {
      id: 'xero',
      name: 'Xero',
      logo: '📈',
      connected: false,
      features: {
        exportTransactions: true,
        importExpenses: true,
        autoSync: true,
        taxReporting: true
      }
    },
    {
      id: 'sage',
      name: 'Sage Business Cloud',
      logo: '💼',
      connected: false,
      features: {
        exportTransactions: true,
        importExpenses: true,
        autoSync: false,
        taxReporting: true
      }
    },
    {
      id: 'freeagent',
      name: 'FreeAgent',
      logo: '🔷',
      connected: false,
      features: {
        exportTransactions: true,
        importExpenses: true,
        autoSync: true,
        taxReporting: true
      }
    }
  ])

  const [syncing, setSyncing] = useState<string | null>(null)

  const handleConnect = async (platformId: string) => {
    if (onConnect) {
      await onConnect(platformId)
    }
    setPlatforms(platforms.map(p =>
      p.id === platformId ? { ...p, connected: true, lastSync: new Date() } : p
    ))
  }

  const handleDisconnect = async (platformId: string) => {
    if (onDisconnect) {
      await onDisconnect(platformId)
    }
    setPlatforms(platforms.map(p =>
      p.id === platformId ? { ...p, connected: false, lastSync: undefined } : p
    ))
  }

  const handleSync = async (platformId: string) => {
    setSyncing(platformId)
    try {
      if (onSync) {
        await onSync(platformId)
      }
      setPlatforms(platforms.map(p =>
        p.id === platformId ? { ...p, lastSync: new Date(), syncStatus: 'success' } : p
      ))
    } catch (error) {
      setPlatforms(platforms.map(p =>
        p.id === platformId ? { ...p, syncStatus: 'error' } : p
      ))
    } finally {
      setSyncing(null)
    }
  }

  const connectedPlatforms = platforms.filter(p => p.connected)

  return (
    <div className={cn('bg-elev-1 border border-border rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-accent" />
          <div>
            <h3 className="text-lg font-semibold text-fg">Accounting Integration</h3>
            <p className="text-sm text-muted mt-0.5">Connect your accounting software for seamless sync</p>
          </div>
        </div>
        {connectedPlatforms.length > 0 && (
          <div className="px-3 py-1 bg-[#00FF94]/10 text-[#00FF94] text-xs rounded-full font-semibold">
            {connectedPlatforms.length} Connected
          </div>
        )}
      </div>

      {/* Connected Platforms Summary */}
      {connectedPlatforms.length > 0 && (
        <div className="mb-5 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="text-sm font-semibold text-blue-400 mb-2">Active Integrations</div>
          <div className="space-y-2">
            {connectedPlatforms.map((platform) => (
              <div key={platform.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span>{platform.logo}</span>
                  <span className="text-fg">{platform.name}</span>
                  {platform.syncStatus === 'success' && (
                    <Check className="h-3 w-3 text-[#00FF94]" />
                  )}
                  {platform.syncStatus === 'error' && (
                    <AlertCircle className="h-3 w-3 text-red-400" />
                  )}
                </div>
                <div className="text-dim">
                  {platform.lastSync
                    ? `Last sync: ${platform.lastSync.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                    : 'Never synced'
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Platform Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {platforms.map((platform) => (
          <div
            key={platform.id}
            className={cn(
              'p-4 rounded-lg border transition-all',
              platform.connected
                ? 'bg-[#00FF94]/5 border-[#00FF94]/30'
                : 'bg-elev-0 border-border/30'
            )}
          >
            {/* Platform Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="text-3xl">{platform.logo}</div>
                <div>
                  <div className="text-sm font-semibold text-fg">{platform.name}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {platform.connected ? 'Connected' : 'Not connected'}
                  </div>
                </div>
              </div>
              {platform.connected && (
                <div className="p-1.5 bg-[#00FF94]/10 rounded-full">
                  <Check className="h-4 w-4 text-[#00FF94]" />
                </div>
              )}
            </div>

            {/* Features */}
            <div className="mb-4 space-y-1">
              <div className="text-xs text-dim uppercase tracking-wide mb-2">Features</div>
              {platform.features.exportTransactions && (
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Download className="h-3 w-3" />
                  Export transactions
                </div>
              )}
              {platform.features.importExpenses && (
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Upload className="h-3 w-3" />
                  Import expenses
                </div>
              )}
              {platform.features.autoSync && (
                <div className="flex items-center gap-2 text-xs text-muted">
                  <RefreshCw className="h-3 w-3" />
                  Automatic sync
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {!platform.connected ? (
                <Button
                  onClick={() => handleConnect(platform.id)}
                  size="sm"
                  className="flex-1 bg-accent/20 text-fg hover:bg-accent/30"
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Connect
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => handleSync(platform.id)}
                    disabled={syncing === platform.id}
                    size="sm"
                    className="flex-1 bg-blue-500 text-white hover:bg-blue-600"
                  >
                    {syncing === platform.id ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sync Now
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => handleDisconnect(platform.id)}
                    size="sm"
                    variant="outline"
                    className="border-red-400/30 hover:bg-red-500/10"
                  >
                    Disconnect
                  </Button>
                </>
              )}
            </div>

            {/* Last Sync Status */}
            {platform.connected && platform.lastSync && (
              <div className="mt-3 pt-3 border-t border-border/30">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-dim">Last sync</span>
                  <span className="text-fg">
                    {platform.lastSync.toLocaleString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Sync Settings */}
      {connectedPlatforms.length > 0 && (
        <div className="mt-5 p-4 bg-elev-0 rounded-lg border border-border/30">
          <div className="text-sm font-semibold text-fg mb-3">Sync Settings</div>
          <div className="space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="text-sm text-fg">Auto-sync daily</div>
                <div className="text-xs text-muted">Automatically sync at 9am every day</div>
              </div>
              <input
                type="checkbox"
                defaultChecked
                className="rounded"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="text-sm text-fg">Include expenses</div>
                <div className="text-xs text-muted">Sync expense data to accounting platform</div>
              </div>
              <input
                type="checkbox"
                defaultChecked
                className="rounded"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="text-sm text-fg">Sync VAT information</div>
                <div className="text-xs text-muted">Include VAT breakdown in synced data</div>
              </div>
              <input
                type="checkbox"
                defaultChecked
                className="rounded"
              />
            </label>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-5 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
        <strong>Note:</strong> Integrations are currently in beta. Data is synced securely using OAuth 2.0. You can disconnect at any time.
      </div>
    </div>
  )
}
