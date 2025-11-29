'use client'

import { useState, useEffect } from 'react'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { supabase } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, Check, AlertCircle, Info, TrendingUp } from 'lucide-react'

type Currency = 'GBP' | 'EUR' | 'USD'

export default function AccountingSettingsPage() {
  useRequireAuth()

  const [baseCurrency, setBaseCurrency] = useState<Currency>('GBP')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
          setError('Not authenticated')
          setLoading(false)
          return
        }

        setUserId(user.id)

        // Fetch current base currency from profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('base_currency')
          .eq('id', user.id)
          .single()

        if (profileError) {
          console.error('[Accounting Settings] Profile fetch error:', profileError)
          setError('Failed to load settings')
        } else {
          setBaseCurrency((profile?.base_currency || 'GBP') as Currency)
        }

        setLoading(false)
      } catch (err: any) {
        console.error('[Accounting Settings] Error:', err)
        setError(err.message || 'Failed to load settings')
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const handleSave = async () => {
    if (!userId) {
      setError('Not authenticated')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ base_currency: baseCurrency })
        .eq('id', userId)

      if (updateError) throw updateError

      setSuccess('Base currency updated successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error('[Accounting Settings] Save error:', err)
      setError(err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1600px] px-3 md:px-6 lg:px-8 py-4 md:py-6 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1600px] px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-6 text-fg">
      {/* Page Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-elev-1 to-elev-1/80 border-2 border-[#00FF94]/10 shadow-lg">
        <h1 className="font-display text-3xl font-semibold text-fg tracking-tight mb-2">
          Accounting
        </h1>
        <p className="text-sm text-fg/70 max-w-2xl">
          Configure your base currency and manage accounting preferences
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="p-4 rounded-xl bg-[#00FF94]/10 border border-[#00FF94]/30 flex items-start gap-3">
          <Check className="h-5 w-5 text-[#00FF94] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[#00FF94]">Success</p>
            <p className="text-sm text-[#00FF94]/80">{success}</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-400">Error</p>
            <p className="text-sm text-red-400/80">{error}</p>
          </div>
        </div>
      )}

      {/* Base Currency Card */}
      <Card elevation="soft" className="border border-border/40 rounded-xl bg-elev-1">
        <CardHeader className="p-6 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-accent/10 border border-accent/20">
              <TrendingUp className="h-5 w-5 text-accent" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold text-fg mb-1">Base Currency</CardTitle>
              <CardDescription className="text-sm text-muted leading-relaxed">
                Select your accounting base currency. All transactions will be converted to this currency for P&L and VAT calculations.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-2 space-y-6">
          <div className="space-y-3">
            <Label htmlFor="base-currency" className="text-sm font-medium text-fg">
              Currency
            </Label>
            <Select
              value={baseCurrency}
              onValueChange={(value) => setBaseCurrency(value as Currency)}
              disabled={saving}
            >
              <SelectTrigger
                id="base-currency"
                className="w-full md:w-80 bg-elev-0 border-border hover:border-accent/50 transition-colors"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-elev-2 border-border">
                <SelectItem value="GBP">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">GBP</span>
                    <span className="text-muted">— British Pound</span>
                  </div>
                </SelectItem>
                <SelectItem value="EUR">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">EUR</span>
                    <span className="text-muted">— Euro</span>
                  </div>
                </SelectItem>
                <SelectItem value="USD">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">USD</span>
                    <span className="text-muted">— US Dollar</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Info Notices */}
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
              <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-400/90 leading-relaxed">
                All new transactions will be automatically converted to <span className="font-semibold">{baseCurrency}</span> using the exchange rate on the transaction date.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400/90 leading-relaxed">
                Changing your base currency will not retroactively convert existing transactions. Existing transactions will retain their stored base amounts.
              </p>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-accent text-black hover:bg-[#00E085] transition-all shadow-lg hover:shadow-accent/20"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* FX Rates Info Card */}
      <Card elevation="soft" className="border border-border/40 rounded-xl bg-elev-1">
        <CardHeader className="p-6 pb-4">
          <CardTitle className="text-lg font-semibold text-fg mb-1">Exchange Rates</CardTitle>
          <CardDescription className="text-sm text-muted">
            How currency conversion works in your accounting
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-2 space-y-5">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-fg">Automatic Conversion</h3>
            <p className="text-sm text-muted leading-relaxed">
              When you record a transaction in a different currency, the system automatically converts it to your base currency ({baseCurrency}) using the exchange rate from the transaction date.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-fg">Exchange Rate Source</h3>
            <p className="text-sm text-muted leading-relaxed">
              Exchange rates are stored in the <code className="text-xs bg-elev-2 px-1.5 py-0.5 rounded font-mono text-accent">fx_rates</code> table with GBP as the pivot currency. Historical rates ensure accurate conversion for past transactions.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-fg">Audit Trail</h3>
            <p className="text-sm text-muted leading-relaxed">
              Every currency conversion is logged in the audit trail, showing the original amount, currency, exchange rate used, and the converted base amount.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
