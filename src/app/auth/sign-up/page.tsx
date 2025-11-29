'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, CheckCircle2, Shield } from 'lucide-react'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setInfo('Check your email to confirm your account, then come back to sign in.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-bg text-fg relative overflow-hidden flex items-center justify-center px-4">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-purple-500/10 pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Back to home link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-muted hover:text-fg transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        {/* Glassmorphic card */}
        <div className="relative bg-elev-1/50 backdrop-blur-md border border-border/50 rounded-2xl p-8 shadow-2xl">
          {/* Glow effect */}
          <div className="absolute -inset-0.5 bg-gradient-to-br from-accent/20 to-purple-500/20 rounded-2xl blur opacity-20 -z-10" />

          {/* Logo */}
          <div className="text-center mb-8">
            <div className="text-3xl font-bold font-cinzel mb-2">
              <span className="text-accent">A</span>RCHVD
            </div>
            <h1 className="text-2xl font-bold text-fg mb-2">Create your account</h1>
            <p className="text-sm text-muted">Start tracking your collection and profits</p>
          </div>

          {/* Info message */}
          {info && (
            <div className="mb-6 p-4 bg-accent/10 border border-accent/30 rounded-xl">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                <div className="text-sm text-fg">
                  {info}{' '}
                  <Link href="/auth/sign-in" className="text-accent hover:underline font-medium">
                    Sign in here
                  </Link>
                  .
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-fg mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-elev-0 border border-border rounded-xl text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-fg mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 bg-elev-0 border border-border rounded-xl text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                placeholder="Minimum 6 characters"
              />
              <p className="mt-2 text-xs text-dim">Must be at least 6 characters long</p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full !bg-accent !text-white h-12 text-base"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>

          {/* Trust indicators */}
          <div className="mt-6 pt-6 border-t border-border/30">
            <div className="flex items-center justify-center gap-2 text-xs text-dim">
              <Shield className="h-3.5 w-3.5" />
              <span>Secure & encrypted</span>
              <span>•</span>
              <span>No credit card required</span>
            </div>
          </div>

          {/* Sign in link */}
          <p className="mt-6 text-center text-sm text-muted">
            Already have an account?{' '}
            <Link href="/auth/sign-in" className="text-accent hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
