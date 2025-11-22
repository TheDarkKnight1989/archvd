'use client'

import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { SubscriptionRow } from '@/components/SubscriptionRow'
import { IntegrationCard } from '@/components/IntegrationCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert } from '@/components/ui/alert'
import { cn } from '@/lib/utils/cn'
import {
  User,
  RefreshCw,
  Trash2,
  Palette,
  Bell,
  Shield,
  Upload,
  CreditCard,
  Lock,
  Smartphone,
  Check,
  AlertTriangle,
  Download,
  Eye,
  EyeOff,
  Plug,
} from 'lucide-react'

type TabId = 'account' | 'cache' | 'appearance' | 'notifications' | 'security' | 'import' | 'subscriptions' | 'integrations'

interface Tab {
  id: TabId
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const tabs: Tab[] = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'cache', label: 'Cache', icon: RefreshCw },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'import', label: 'Import', icon: Upload },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
]

export default function SettingsPage() {
  useRequireAuth()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<TabId>('account')
  const tabsRef = useRef<HTMLDivElement>(null)
  const [focusedTabIndex, setFocusedTabIndex] = useState(0)

  // Account tab state
  const [accountDirty, setAccountDirty] = useState(false)
  const [accountSaving, setAccountSaving] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('user@example.com')

  // Appearance tab state
  const [theme, setTheme] = useState<'matrix' | 'system'>('matrix')
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable')

  // Notifications tab state
  const [notifDirty, setNotifDirty] = useState(false)
  const [notifSaving, setNotifSaving] = useState(false)
  const [priceAlerts, setPriceAlerts] = useState(true)
  const [salesNotif, setSalesNotif] = useState(true)
  const [payoutsNotif, setPayoutsNotif] = useState(false)
  const [releasesNotif, setReleasesNotif] = useState(true)

  // Security tab state
  const [twoFAEnabled, setTwoFAEnabled] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Cache tab state
  const [lastRefresh, setLastRefresh] = useState<string>(new Date().toISOString())
  const [hydratingCatalog, setHydratingCatalog] = useState(false)
  const [catalogHydrationResult, setCatalogHydrationResult] = useState<string | null>(null)

  // Import tab state
  const [isDragging, setIsDragging] = useState(false)

  // Keyboard navigation for tabs
  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const newIndex = index > 0 ? index - 1 : tabs.length - 1
      setFocusedTabIndex(newIndex)
      setActiveTab(tabs[newIndex].id)
      // Focus the new tab
      const buttons = tabsRef.current?.querySelectorAll('button[role="tab"]')
      ;(buttons?.[newIndex] as HTMLButtonElement)?.focus()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      const newIndex = index < tabs.length - 1 ? index + 1 : 0
      setFocusedTabIndex(newIndex)
      setActiveTab(tabs[newIndex].id)
      // Focus the new tab
      const buttons = tabsRef.current?.querySelectorAll('button[role="tab"]')
      ;(buttons?.[newIndex] as HTMLButtonElement)?.focus()
    }
  }

  // Account handlers
  const handleAccountSave = async () => {
    setAccountSaving(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setAccountSaving(false)
    setAccountDirty(false)
    // TODO: Save to backend
  }

  const handleAccountCancel = () => {
    setDisplayName('')
    setAccountDirty(false)
  }

  // Notifications handlers
  const handleNotifSave = async () => {
    setNotifSaving(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setNotifSaving(false)
    setNotifDirty(false)
    // TODO: Save to backend
  }

  const handleNotifCancel = () => {
    // Reset to original values
    setPriceAlerts(true)
    setSalesNotif(true)
    setPayoutsNotif(false)
    setReleasesNotif(true)
    setNotifDirty(false)
  }

  // Cache handlers
  const handleRefreshMarketData = async () => {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setLastRefresh(new Date().toISOString())
    // TODO: Call refresh API
  }

  const handleHydrateCatalog = async () => {
    setHydratingCatalog(true)
    setCatalogHydrationResult(null)

    try {
      const response = await fetch('/api/stockx/backfill/catalog', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        setCatalogHydrationResult(
          `✅ Hydrated ${data.hydratedProducts} products (${data.links} mappings, ${data.errors || 0} errors)`
        )
      } else {
        setCatalogHydrationResult(`❌ Error: ${data.error || 'Failed to hydrate catalog'}`)
      }
    } catch (error: any) {
      setCatalogHydrationResult(`❌ Error: ${error.message}`)
    } finally {
      setHydratingCatalog(false)
    }
  }

  const handleClearCache = async () => {
    if (confirm('Are you sure you want to clear all cached data? This cannot be undone.')) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      // TODO: Clear cache
    }
  }

  // Security handlers
  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match')
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    // TODO: Change password
  }

  const getPasswordStrength = (password: string): number => {
    let strength = 0
    if (password.length >= 8) strength += 25
    if (password.length >= 12) strength += 25
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25
    if (/[0-9]/.test(password)) strength += 12.5
    if (/[^a-zA-Z0-9]/.test(password)) strength += 12.5
    return Math.min(strength, 100)
  }

  const passwordStrength = getPasswordStrength(newPassword)

  const getStrengthColor = (strength: number): string => {
    if (strength < 25) return 'bg-red-400'
    if (strength < 50) return 'bg-orange-400'
    if (strength < 75) return 'bg-yellow-400'
    return 'bg-green-400'
  }

  const getStrengthLabel = (strength: number): string => {
    if (strength < 25) return 'Weak'
    if (strength < 50) return 'Fair'
    if (strength < 75) return 'Good'
    return 'Strong'
  }

  // Import handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    // TODO: Handle file upload
    console.log('Files dropped:', files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const formatRelativeTime = (isoString: string): string => {
    const now = new Date()
    const then = new Date(isoString)
    const diffMs = now.getTime() - then.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`

    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  return (
    <div className="min-h-screen bg-elev-0">
      {/* Skip to content link for a11y */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-black focus:rounded-lg"
      >
        Skip to content
      </a>

      <div className="mx-auto max-w-[1200px] px-4 md:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-cinzel font-bold text-fg relative inline-block mb-2">
            Settings
            <span className="absolute bottom-0 left-0 w-16 h-[2px] bg-accent/40"></span>
          </h1>
          <p className="text-sm text-muted">Manage your account, preferences, and integrations</p>
        </div>

        {/* Sticky Tabs */}
        <div
          ref={tabsRef}
          className="sticky top-0 z-20 bg-elev-0/95 backdrop-blur supports-[backdrop-filter]:bg-elev-0/75 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 py-4 border-b border-border"
          role="tablist"
          aria-label="Settings sections"
        >
          <div className="flex items-center gap-2 overflow-x-auto snap-x scrollbar-hide">
            {tabs.map((tab, index) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`${tab.id}-panel`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => {
                    if (tab.id === 'integrations') {
                      router.push('/portfolio/settings/integrations')
                    } else {
                      setActiveTab(tab.id)
                      setFocusedTabIndex(index)
                    }
                  }}
                  onKeyDown={(e) => handleTabKeyDown(e, index)}
                  className={cn(
                    'relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-boutique whitespace-nowrap snap-start',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                    isActive
                      ? 'bg-accent-200 text-fg border border-accent'
                      : 'bg-elev-1 text-muted border border-border hover:bg-elev-2 hover:border-accent/50 hover:text-fg'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-[2px] bg-accent animate-[slideIn_120ms_ease-out]" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab Panels */}
        <div id="main-content">
          {/* Account Tab */}
          {activeTab === 'account' && (
            <div id="account-panel" role="tabpanel" aria-labelledby="account-tab" className="space-y-6">
              <div className="bg-elev-2 gradient-elev rounded-2xl border border-border shadow-soft p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-fg mb-1">Account Information</h2>
                  <p className="text-sm text-dim">Manage your personal details and preferences</p>
                </div>

                <div className="bg-elev-1 rounded-xl border border-border/40 p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Display Name */}
                    <div>
                      <Label htmlFor="display-name" className="text-dim uppercase tracking-wider text-xs font-semibold">
                        Display Name
                      </Label>
                      <Input
                        id="display-name"
                        value={displayName}
                        onChange={(e) => {
                          setDisplayName(e.target.value)
                          setAccountDirty(true)
                        }}
                        placeholder="Enter your name"
                        className="mt-2 bg-bg border-border focus:ring-focus transition-boutique"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <Label htmlFor="email" className="text-dim uppercase tracking-wider text-xs font-semibold">
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        disabled
                        className="mt-2 bg-bg border-border opacity-60 cursor-not-allowed"
                      />
                      <p className="text-xs text-dim mt-1">Email cannot be changed</p>
                    </div>
                  </div>

                  {/* Avatar Upload (Disabled) */}
                  <div>
                    <Label className="text-dim uppercase tracking-wider text-xs font-semibold">
                      Profile Picture
                    </Label>
                    <div className="mt-2 flex items-center gap-4">
                      <div className="h-16 w-16 rounded-lg bg-elev-3 flex items-center justify-center">
                        <User className="h-8 w-8 text-dim" />
                      </div>
                      <Button variant="outline" disabled className="border-border opacity-50 cursor-not-allowed">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload (Coming Soon)
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Sticky Save Footer */}
                {accountDirty && (
                  <div className="flex items-center justify-between pt-4 border-t border-border/40">
                    <p className="text-sm text-dim">You have unsaved changes</p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={handleAccountCancel}
                        disabled={accountSaving}
                        className="border-border"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAccountSave}
                        disabled={accountSaving}
                        className="bg-accent text-black hover:bg-accent-600 shadow-soft"
                      >
                        {accountSaving ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cache Tab */}
          {activeTab === 'cache' && (
            <div id="cache-panel" role="tabpanel" aria-labelledby="cache-tab" className="space-y-6">
              <div className="bg-elev-2 gradient-elev rounded-2xl border border-border shadow-soft p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-fg mb-1">Cache Management</h2>
                  <p className="text-sm text-dim">Refresh market data or clear cached information</p>
                </div>

                <div className="bg-elev-1 rounded-xl border border-border/40 p-4 space-y-4">
                  {/* Market Data Refresh */}
                  <div className="flex items-center justify-between pb-4 border-b border-border/40">
                    <div>
                      <h3 className="text-sm font-semibold text-fg">Market Data</h3>
                      <p className="text-xs text-dim mt-1">
                        Last refreshed: <span className="font-mono text-fg">{formatRelativeTime(lastRefresh)}</span>
                      </p>
                    </div>
                    <Button
                      onClick={handleRefreshMarketData}
                      className="bg-accent text-black hover:bg-accent-600 glow-accent-hover"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Re-sync Data
                    </Button>
                  </div>

                  {/* StockX Catalog Hydration */}
                  <div className="flex items-center justify-between pb-4 border-b border-border/40">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-fg">StockX Product Images</h3>
                      <p className="text-xs text-dim mt-1">
                        Fetch missing product images and metadata from StockX
                      </p>
                      {catalogHydrationResult && (
                        <p className="text-xs mt-2 font-mono text-fg">{catalogHydrationResult}</p>
                      )}
                    </div>
                    <Button
                      onClick={handleHydrateCatalog}
                      disabled={hydratingCatalog}
                      className="bg-blue-500 text-white hover:bg-blue-600"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {hydratingCatalog ? 'Hydrating...' : 'Hydrate Catalog'}
                    </Button>
                  </div>

                  {/* Clear Cache */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-fg">Clear Local Cache</h3>
                      <p className="text-xs text-dim mt-1">Remove all cached data from your browser</p>
                    </div>
                    <Button onClick={handleClearCache} variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear Cache
                    </Button>
                  </div>
                </div>

                <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  <div className="ml-2">
                    <p className="text-sm font-semibold">Destructive Action</p>
                    <p className="text-xs mt-1">Clearing cache will remove all locally stored data. This cannot be undone.</p>
                  </div>
                </Alert>
              </div>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div id="appearance-panel" role="tabpanel" aria-labelledby="appearance-tab" className="space-y-6">
              <div className="bg-elev-2 gradient-elev rounded-2xl border border-border shadow-soft p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-fg mb-1">Appearance Settings</h2>
                  <p className="text-sm text-dim">Customize the look and feel of your dashboard</p>
                </div>

                {/* Theme Selector */}
                <div className="bg-elev-1 rounded-xl border border-border/40 p-4 space-y-4">
                  <div>
                    <Label className="text-dim uppercase tracking-wider text-xs font-semibold">Theme</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      <button
                        onClick={() => setTheme('matrix')}
                        className={cn(
                          'p-4 rounded-lg border-2 transition-boutique text-left',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                          theme === 'matrix'
                            ? 'border-accent bg-accent-200 shadow-soft'
                            : 'border-border bg-elev-2 hover:border-accent/50'
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-fg">Matrix Theme</span>
                          {theme === 'matrix' && <Check className="h-5 w-5 text-accent" />}
                        </div>
                        <p className="text-xs text-dim">Dark theme with accent green highlights</p>
                      </button>
                      <button
                        onClick={() => setTheme('system')}
                        className={cn(
                          'p-4 rounded-lg border-2 transition-boutique text-left',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                          theme === 'system'
                            ? 'border-accent bg-accent-200 shadow-soft'
                            : 'border-border bg-elev-2 hover:border-accent/50'
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-fg">System</span>
                          {theme === 'system' && <Check className="h-5 w-5 text-accent" />}
                        </div>
                        <p className="text-xs text-dim">Follow your system preferences</p>
                      </button>
                    </div>
                  </div>

                  {/* Density Toggle */}
                  <div className="pt-4 border-t border-border/40">
                    <Label className="text-dim uppercase tracking-wider text-xs font-semibold">Display Density</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      <button
                        onClick={() => setDensity('comfortable')}
                        className={cn(
                          'p-4 rounded-lg border-2 transition-boutique text-left',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                          density === 'comfortable'
                            ? 'border-accent bg-accent-200 shadow-soft'
                            : 'border-border bg-elev-2 hover:border-accent/50'
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-fg">Comfortable</span>
                          {density === 'comfortable' && <Check className="h-5 w-5 text-accent" />}
                        </div>
                        <p className="text-xs text-dim">Spacious layout with more padding</p>
                      </button>
                      <button
                        onClick={() => setDensity('compact')}
                        className={cn(
                          'p-4 rounded-lg border-2 transition-boutique text-left',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                          density === 'compact'
                            ? 'border-accent bg-accent-200 shadow-soft'
                            : 'border-border bg-elev-2 hover:border-accent/50'
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-fg">Compact</span>
                          {density === 'compact' && <Check className="h-5 w-5 text-accent" />}
                        </div>
                        <p className="text-xs text-dim">Fit more content on screen</p>
                      </button>
                    </div>
                  </div>

                  {/* Number Format Preview */}
                  <div className="pt-4 border-t border-border/40">
                    <Label className="text-dim uppercase tracking-wider text-xs font-semibold">Number Format Preview</Label>
                    <div className="mt-3 bg-elev-2 rounded-lg border border-border/40 p-4 font-mono space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-dim">Currency:</span>
                        <span className="text-fg">£1,234.56</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-dim">Percentage:</span>
                        <span className="text-fg">15.8%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-dim">Large Number:</span>
                        <span className="text-fg">1,234,567</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div id="notifications-panel" role="tabpanel" aria-labelledby="notifications-tab" className="space-y-6">
              <div className="bg-elev-2 gradient-elev rounded-2xl border border-border shadow-soft p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-fg mb-1">Notification Preferences</h2>
                  <p className="text-sm text-dim">Choose what updates you want to receive</p>
                </div>

                <div className="bg-elev-1 rounded-xl border border-border/40 p-4 space-y-4">
                  {/* Price Alerts */}
                  <div className="flex items-center justify-between py-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-fg">Price Alerts</h3>
                      <p className="text-xs text-dim mt-1">Get notified when prices change significantly</p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={priceAlerts}
                      onClick={() => {
                        setPriceAlerts(!priceAlerts)
                        setNotifDirty(true)
                      }}
                      className={cn(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-120',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/25',
                        priceAlerts ? 'bg-accent' : 'bg-elev-3'
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-4 w-4 transform rounded-full bg-white transition-boutique',
                          priceAlerts ? 'translate-x-6' : 'translate-x-1'
                        )}
                      />
                    </button>
                  </div>

                  <div className="border-t border-border/40" />

                  {/* Sales Notifications */}
                  <div className="flex items-center justify-between py-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-fg">Sales Notifications</h3>
                      <p className="text-xs text-dim mt-1">Receive alerts about your sales activity</p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={salesNotif}
                      onClick={() => {
                        setSalesNotif(!salesNotif)
                        setNotifDirty(true)
                      }}
                      className={cn(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-120',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/25',
                        salesNotif ? 'bg-accent' : 'bg-elev-3'
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-4 w-4 transform rounded-full bg-white transition-boutique',
                          salesNotif ? 'translate-x-6' : 'translate-x-1'
                        )}
                      />
                    </button>
                  </div>

                  <div className="border-t border-border/40" />

                  {/* Payouts Notifications */}
                  <div className="flex items-center justify-between py-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-fg">Payout Updates</h3>
                      <p className="text-xs text-dim mt-1">Stay informed about payment processing</p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={payoutsNotif}
                      onClick={() => {
                        setPayoutsNotif(!payoutsNotif)
                        setNotifDirty(true)
                      }}
                      className={cn(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-120',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/25',
                        payoutsNotif ? 'bg-accent' : 'bg-elev-3'
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-4 w-4 transform rounded-full bg-white transition-boutique',
                          payoutsNotif ? 'translate-x-6' : 'translate-x-1'
                        )}
                      />
                    </button>
                  </div>

                  <div className="border-t border-border/40" />

                  {/* Release Notifications */}
                  <div className="flex items-center justify-between py-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-fg">Release Reminders</h3>
                      <p className="text-xs text-dim mt-1">Get notified about upcoming sneaker drops</p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={releasesNotif}
                      onClick={() => {
                        setReleasesNotif(!releasesNotif)
                        setNotifDirty(true)
                      }}
                      className={cn(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-120',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/25',
                        releasesNotif ? 'bg-accent' : 'bg-elev-3'
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-4 w-4 transform rounded-full bg-white transition-boutique',
                          releasesNotif ? 'translate-x-6' : 'translate-x-1'
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* Sticky Save Footer */}
                {notifDirty && (
                  <div className="flex items-center justify-between pt-4 border-t border-border/40">
                    <p className="text-sm text-dim">You have unsaved changes</p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={handleNotifCancel}
                        disabled={notifSaving}
                        className="border-border"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleNotifSave}
                        disabled={notifSaving}
                        className="bg-accent text-black hover:bg-accent-600 shadow-soft"
                      >
                        {notifSaving ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div id="security-panel" role="tabpanel" aria-labelledby="security-tab" className="space-y-6">
              <div className="bg-elev-2 gradient-elev rounded-2xl border border-border shadow-soft p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-fg mb-1">Security Settings</h2>
                  <p className="text-sm text-dim">Manage your account security and authentication</p>
                </div>

                {/* 2FA Status */}
                <div className="bg-elev-1 rounded-xl border border-border/40 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'h-10 w-10 rounded-lg flex items-center justify-center',
                        twoFAEnabled ? 'bg-green-500/10' : 'bg-elev-3'
                      )}>
                        <Shield className={cn('h-5 w-5', twoFAEnabled ? 'text-green-400' : 'text-dim')} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-fg">Two-Factor Authentication</h3>
                        <p className="text-xs text-dim mt-0.5">
                          {twoFAEnabled ? 'Enabled and protecting your account' : 'Not enabled'}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => setTwoFAEnabled(!twoFAEnabled)}
                      variant="outline"
                      className="border-border"
                    >
                      {twoFAEnabled ? 'Manage' : 'Enable'}
                    </Button>
                  </div>
                </div>

                {/* Password Change */}
                <div className="bg-elev-1 rounded-xl border border-border/40 p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-fg">Change Password</h3>

                  <div>
                    <Label htmlFor="current-password" className="text-dim uppercase tracking-wider text-xs font-semibold">
                      Current Password
                    </Label>
                    <div className="relative mt-2">
                      <Input
                        id="current-password"
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="bg-bg border-border focus:border-accent-400/50 focus:glow-accent-hover transition-all duration-120 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-fg transition-colors"
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="new-password" className="text-dim uppercase tracking-wider text-xs font-semibold">
                      New Password
                    </Label>
                    <div className="relative mt-2">
                      <Input
                        id="new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="bg-bg border-border focus:border-accent-400/50 focus:glow-accent-hover transition-all duration-120 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-fg transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {newPassword && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-dim">Password Strength</span>
                          <span className={cn(
                            'font-semibold',
                            passwordStrength < 50 ? 'text-red-400' : passwordStrength < 75 ? 'text-yellow-400' : 'text-green-400'
                          )}>
                            {getStrengthLabel(passwordStrength)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-elev-3 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full transition-all duration-300', getStrengthColor(passwordStrength))}
                            style={{ width: `${passwordStrength}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="confirm-password" className="text-dim uppercase tracking-wider text-xs font-semibold">
                      Confirm Password
                    </Label>
                    <div className="relative mt-2">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="bg-bg border-border focus:border-accent-400/50 focus:glow-accent-hover transition-all duration-120 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-fg transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    onClick={handlePasswordChange}
                    disabled={!currentPassword || !newPassword || !confirmPassword}
                    className="w-full bg-accent text-black hover:bg-accent-600 glow-accent-hover"
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    Change Password
                  </Button>
                </div>

                {/* Active Devices */}
                <div className="bg-elev-1 rounded-xl border border-border/40 p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-fg">Active Devices</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <Smartphone className="h-5 w-5 text-dim" />
                        <div>
                          <p className="text-sm text-fg font-medium">Current Device</p>
                          <p className="text-xs text-dim font-mono">Chrome on macOS • London, UK</p>
                        </div>
                      </div>
                      <span className="text-xs text-green-400 font-semibold">Active Now</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Import Tab */}
          {activeTab === 'import' && (
            <div id="import-panel" role="tabpanel" aria-labelledby="import-tab" className="space-y-6">
              <div className="bg-elev-2 gradient-elev rounded-2xl border border-border shadow-soft p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-fg mb-1">Import Data</h2>
                  <p className="text-sm text-dim">Upload CSV or XLSX files to bulk import your portfolio</p>
                </div>

                {/* Drop Zone */}
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={cn(
                    'bg-elev-1 rounded-xl border-2 border-dashed transition-all duration-120 p-12',
                    isDragging
                      ? 'border-accent bg-accent/5'
                      : 'border-border hover:border-accent/50'
                  )}
                >
                  <div className="flex flex-col items-center justify-center text-center space-y-4">
                    <div className="h-16 w-16 rounded-full bg-elev-3 flex items-center justify-center">
                      <Upload className="h-8 w-8 text-dim" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-fg">Drop your file here</p>
                      <p className="text-xs text-dim mt-1">or click to browse</p>
                    </div>
                    <Button className="bg-accent text-black hover:bg-accent-600 shadow-soft">
                      Select File
                    </Button>
                  </div>
                </div>

                <Alert className="bg-blue-500/10 border-blue-500/20 text-blue-400">
                  <Download className="h-4 w-4" />
                  <div className="ml-2">
                    <p className="text-sm font-semibold">Supported Formats</p>
                    <p className="text-xs mt-1">
                      CSV and XLSX files with columns: SKU, Brand, Model, Size, Purchase Price, Purchase Date
                    </p>
                    <button className="text-xs underline mt-2 hover:text-blue-300 transition-colors">
                      Download sample CSV
                    </button>
                  </div>
                </Alert>

                {/* Field Rules */}
                <div className="bg-elev-1 rounded-xl border border-border/40 p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-fg">Required Fields</h3>
                  <ul className="space-y-2 text-xs text-dim">
                    <li className="flex items-start gap-2">
                      <span className="text-accent mt-0.5">•</span>
                      <span><span className="font-mono text-fg">SKU</span> - Product style code (e.g., DZ5485-612)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-accent mt-0.5">•</span>
                      <span><span className="font-mono text-fg">Purchase Price</span> - Numeric value without currency symbol</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-accent mt-0.5">•</span>
                      <span><span className="font-mono text-fg">Purchase Date</span> - Format: YYYY-MM-DD</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Subscriptions Tab */}
          {activeTab === 'subscriptions' && (
            <div id="subscriptions-panel" role="tabpanel" aria-labelledby="subscriptions-tab" className="space-y-6">
              <div className="bg-elev-2 gradient-elev rounded-2xl border border-border shadow-soft p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-fg mb-1">Billing & Subscriptions</h2>
                  <p className="text-sm text-dim">Manage your subscription and billing details</p>
                </div>

                {/* Current Subscription */}
                <div className="bg-elev-1 rounded-xl border border-border/40 p-4">
                  <h3 className="text-sm font-semibold text-fg mb-4">Current Plan</h3>
                  <SubscriptionRow
                    planName="Pro Plan"
                    priceGBP={9.99}
                    interval="mo"
                    status="active"
                    renewalDateISO={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()}
                    seats={1}
                    onManage={() => console.log('Manage subscription')}
                    onUpgrade={() => console.log('Upgrade subscription')}
                  />
                </div>

                {/* Billing Portal */}
                <div className="bg-elev-1 rounded-xl border border-border/40 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-fg">Billing Portal</h3>
                      <p className="text-xs text-dim mt-1">Manage payment methods and view invoices</p>
                    </div>
                    <Button variant="outline" className="border-border">
                      Open Portal
                    </Button>
                  </div>
                </div>

                {/* Payment History (Empty State) */}
                <div className="bg-elev-1 rounded-xl border border-border/40 p-8">
                  <div className="text-center space-y-3">
                    <div className="h-12 w-12 rounded-full bg-elev-3 flex items-center justify-center mx-auto">
                      <CreditCard className="h-6 w-6 text-dim" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-fg">No payment history</p>
                      <p className="text-xs text-dim mt-1">Your invoices will appear here</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
