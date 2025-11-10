'use client'

import { useState, useEffect } from 'react'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { supabase } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, Check, AlertCircle } from 'lucide-react'

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
    <div className="mx-auto max-w-[1600px] px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6 text-fg">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fg relative inline-block">
          Accounting Settings
          <span className="absolute bottom-0 left-0 w-16 h-0.5 bg-accent opacity-40"></span>
        </h1>
      </div>

      {/* Success/Error Alerts */}
      {success && (
        <Alert variant="default" className="bg-success/10 border-success/30">
          <Check className="h-4 w-4 text-success" />
          <AlertTitle className="text-success">Success</AlertTitle>
          <AlertDescription className="text-success/80">{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Base Currency Card */}
      <Card elevation={1} className="border border-border rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-fg">Base Currency</CardTitle>
          <CardDescription className="text-sm text-muted">
            Select your accounting base currency. All transactions will be converted to this currency for P&L and VAT calculations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="base-currency" className="text-sm font-medium text-fg">
              Currency
            </Label>
            <Select
              value={baseCurrency}
              onValueChange={(value) => setBaseCurrency(value as Currency)}
            >
              <SelectTrigger id="base-currency" className="w-full md:w-64 bg-elev-1 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-elev-2 border-border">
                <SelectItem value="GBP">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">GBP</span>
                    <span className="text-muted">— British Pound</span>
                  </div>
                </SelectItem>
                <SelectItem value="EUR">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">EUR</span>
                    <span className="text-muted">— Euro</span>
                  </div>
                </SelectItem>
                <SelectItem value="USD">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">USD</span>
                    <span className="text-muted">— US Dollar</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="pt-2 space-y-3 text-xs text-muted">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-accent/40 text-accent shrink-0">
                INFO
              </Badge>
              <p>
                All new transactions will be automatically converted to {baseCurrency} using the exchange rate on the transaction date.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-warning/40 text-warning shrink-0">
                NOTE
              </Badge>
              <p>
                Changing your base currency will not retroactively convert existing transactions. Existing transactions will retain their stored base amounts.
              </p>
            </div>
          </div>

          <div className="pt-4">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-accent text-black hover:bg-accent-600 glow-accent-hover"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* FX Rates Info Card */}
      <Card elevation={1} className="border border-border rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-fg">Exchange Rates</CardTitle>
          <CardDescription className="text-sm text-muted">
            How currency conversion works in your accounting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-2">
            <h3 className="font-medium text-fg">Automatic Conversion</h3>
            <p className="text-muted">
              When you record a transaction in a different currency, the system automatically converts it to your base currency ({baseCurrency}) using the exchange rate from the transaction date.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-fg">Exchange Rate Source</h3>
            <p className="text-muted">
              Exchange rates are stored in the <code className="text-xs bg-elev-2 px-1.5 py-0.5 rounded font-mono">fx_rates</code> table with GBP as the pivot currency. Historical rates ensure accurate conversion for past transactions.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-fg">Audit Trail</h3>
            <p className="text-muted">
              Every currency conversion is logged in the audit trail, showing the original amount, currency, exchange rate used, and the converted base amount.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
