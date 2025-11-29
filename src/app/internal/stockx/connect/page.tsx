/**
 * INTERNAL USE ONLY - StockX App-Level Token Capture
 *
 * ⚠️  WARNING: This page is for one-time internal use only.
 * ⚠️  REMOVE or DISABLE this after obtaining the refresh token.
 * ⚠️  This should NOT be accessible in production.
 *
 * Purpose: Initiate OAuth flow to capture YOUR StockX refresh token
 * Usage: Visit this page once and click "Connect" to begin OAuth flow
 */

'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function InternalStockXConnectPage() {
  const [loading, setLoading] = useState(false)

  const handleConnect = () => {
    setLoading(true)
    // Redirect to internal OAuth start
    window.location.href = '/api/stockx/internal/start'
  }

  return (
    <div className="min-h-screen bg-[#050608] flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8 bg-elev-1 border border-border/40">
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-fg">
              ⚠️ Internal: StockX App-Level Token
            </h1>
            <p className="text-muted text-sm">
              This is an internal-only page for capturing your StockX refresh token.
            </p>
          </div>

          <div className="border-l-4 border-amber-500 bg-amber-500/10 p-4 rounded-r-lg">
            <h3 className="text-amber-400 font-semibold mb-2">⚠️ IMPORTANT</h3>
            <ul className="text-amber-200/90 text-sm space-y-1 list-disc list-inside">
              <li>This page should ONLY be used ONCE to get your refresh token</li>
              <li>REMOVE or DISABLE this page after obtaining the token</li>
              <li>Do NOT expose this in production</li>
              <li>This will connect using YOUR personal StockX account</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-fg">Instructions</h2>
            <ol className="text-muted space-y-2 list-decimal list-inside">
              <li>Click "Connect with StockX" below</li>
              <li>Log in with YOUR StockX account (the one you want to use for app-level access)</li>
              <li>Authorize the app</li>
              <li>Copy the <code className="bg-elev-0 px-2 py-1 rounded text-accent">refresh_token</code> from the response</li>
              <li>Add it to Vercel environment variables as: <code className="bg-elev-0 px-2 py-1 rounded text-accent">STOCKX_REFRESH_TOKEN=...</code></li>
              <li>Redeploy your application</li>
              <li>DELETE or DISABLE this page and the <code className="bg-elev-0 px-1 rounded text-xs">/api/stockx/internal/*</code> routes</li>
            </ol>
          </div>

          <div className="pt-4">
            <Button
              onClick={handleConnect}
              disabled={loading}
              size="lg"
              className="w-full bg-[#00FF94] text-black hover:bg-[#00E085] font-semibold"
            >
              {loading ? 'Redirecting...' : '🔗 Connect with StockX (Internal)'}
            </Button>
          </div>

          <div className="border-t border-border/40 pt-4">
            <h3 className="text-sm font-semibold text-fg mb-2">What happens next?</h3>
            <p className="text-sm text-muted">
              After authorizing, you'll be redirected to a callback page that displays your refresh token in JSON format.
              The token will also be logged to the server console. Copy it and add it to your Vercel environment variables.
            </p>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <h3 className="text-blue-400 font-semibold mb-2">💡 Why is this needed?</h3>
            <p className="text-blue-200/90 text-sm">
              Since your StockX OAuth app doesn't support <code className="bg-elev-0 px-1 rounded text-xs">client_credentials</code> grant,
              we use a refresh token from YOUR account to enable app-level StockX access for all users. This allows any Archvd user
              to search StockX products and get market data without connecting their own StockX account.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
