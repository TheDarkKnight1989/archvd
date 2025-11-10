import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SubscriptionsContent } from './SubscriptionsContent'

export const metadata: Metadata = {
  title: 'Subscriptions • archvd',
  description: 'Manage your recurring expenses and subscriptions',
}

export default async function SubscriptionsPage() {
  const supabase = await createClient()

  // Fetch all subscriptions
  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Subscriptions] Error fetching subscriptions:', error)
  }

  // Fetch monthly total
  const { data: monthlyCost } = await supabase
    .from('subscription_monthly_cost')
    .select('*')
    .single()

  return (
    <div className="min-h-screen bg-bg text-fg p-6">
      <div className="max-w-5xl mx-auto">
        <SubscriptionsContent
          initialSubscriptions={subscriptions || []}
          monthlyTotal={monthlyCost?.monthly_total || 0}
        />
      </div>
    </div>
  )
}
