'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { User, Settings, Mail, Calendar, Shield } from 'lucide-react'

export default function ProfilePage() {
  useRequireAuth()
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      } catch (error) {
        console.error('Error fetching user:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-elev-0 flex items-center justify-center">
        <div className="text-muted">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-elev-0">
      <div className="mx-auto max-w-[1200px] px-4 md:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-cinzel font-bold text-fg relative inline-block mb-2">
            My Profile
            <span className="absolute bottom-0 left-0 w-16 h-[2px] bg-accent/40"></span>
          </h1>
          <p className="text-sm text-muted">View and manage your account information</p>
        </div>

        {/* Profile Card */}
        <div className="bg-elev-2 gradient-elev rounded-2xl border border-border shadow-soft p-6 space-y-6">
          {/* Avatar + Name */}
          <div className="flex items-center gap-6">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-accent/20 to-accent/5 border-2 border-accent/30 flex items-center justify-center">
              <span className="text-4xl font-bold text-accent">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-fg">
                {user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User'}
              </h2>
              <p className="text-sm text-muted mt-1">{user?.email}</p>
            </div>
          </div>

          {/* Account Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Email */}
            <div className="bg-elev-1 rounded-xl border border-border/40 p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 rounded-lg bg-elev-3 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-dim" />
                </div>
                <span className="text-xs font-semibold text-dim uppercase tracking-wider">Email Address</span>
              </div>
              <p className="text-sm text-fg font-medium">{user?.email || 'Not available'}</p>
            </div>

            {/* Member Since */}
            <div className="bg-elev-1 rounded-xl border border-border/40 p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 rounded-lg bg-elev-3 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-dim" />
                </div>
                <span className="text-xs font-semibold text-dim uppercase tracking-wider">Member Since</span>
              </div>
              <p className="text-sm text-fg font-medium">
                {user?.created_at ? formatDate(user.created_at) : 'Unknown'}
              </p>
            </div>

            {/* User ID */}
            <div className="bg-elev-1 rounded-xl border border-border/40 p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 rounded-lg bg-elev-3 flex items-center justify-center">
                  <User className="h-4 w-4 text-dim" />
                </div>
                <span className="text-xs font-semibold text-dim uppercase tracking-wider">User ID</span>
              </div>
              <p className="text-xs text-fg font-mono">{user?.id || 'Unknown'}</p>
            </div>

            {/* Account Status */}
            <div className="bg-elev-1 rounded-xl border border-border/40 p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 rounded-lg bg-elev-3 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-green-400" />
                </div>
                <span className="text-xs font-semibold text-dim uppercase tracking-wider">Status</span>
              </div>
              <p className="text-sm text-green-400 font-medium">Active</p>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-border/40 flex items-center gap-3">
            <Button
              onClick={() => router.push('/settings')}
              className="bg-accent text-black hover:bg-accent-600 shadow-soft"
            >
              <Settings className="h-4 w-4 mr-2" />
              Manage Account
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/portfolio')}
              className="border-border"
            >
              Back to Portfolio
            </Button>
          </div>
        </div>

        {/* Additional Info Section (Placeholder for future features) */}
        <div className="bg-elev-2 gradient-elev rounded-2xl border border-border shadow-soft p-6">
          <h3 className="text-lg font-semibold text-fg mb-4">Account Features</h3>
          <div className="space-y-3 text-sm text-muted">
            <div className="flex items-center gap-2">
              <span className="text-accent">✓</span>
              <span>Unlimited inventory items</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-accent">✓</span>
              <span>Real-time market data syncing</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-accent">✓</span>
              <span>Multi-platform integration (StockX, Alias)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-accent">✓</span>
              <span>Advanced analytics and reports</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
