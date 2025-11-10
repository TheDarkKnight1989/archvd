import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { ActivityFeed } from './ActivityFeed'

export const metadata: Metadata = {
  title: 'Activity Feed • archvd',
  description: 'View all your portfolio activity and events',
}

export default async function ActivityPage() {
  const supabase = await createClient()

  // Fetch recent activity events
  const { data: events, error } = await supabase
    .from('audit_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[Activity] Error fetching events:', error)
  }

  return (
    <div className="min-h-screen bg-bg text-fg p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-fg mb-2">Activity Feed</h1>
          <p className="text-muted">
            Track all actions and events across your portfolio
          </p>
        </div>

        {/* Activity Feed */}
        <ActivityFeed initialEvents={events || []} />
      </div>
    </div>
  )
}
