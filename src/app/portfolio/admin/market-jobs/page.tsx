'use client'

/**
 * Market Jobs Admin Page
 * WHY: Monitor and manage the market data job queue
 */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Job {
  id: string
  provider: string
  sku: string
  size: string | null
  priority: number
  status: string
  error_message: string | null
  retry_count: number
  created_at: string
  started_at: string | null
  completed_at: string | null
}

interface Budget {
  provider: string
  hour_window: string
  rate_limit: number
  used: number
}

interface Metrics {
  provider: string
  batch_size: number
  succeeded: number
  failed: number
  deferred: number
  created_at: string
}

interface JobRun {
  run_id: string
  started_at: string
  completed_at: string | null
  jobs_selected: number
  jobs_succeeded: number
  jobs_failed: number
}

export default function MarketJobsAdminPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [metrics, setMetrics] = useState<Metrics[]>([])
  const [runs, setRuns] = useState<JobRun[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)

    // Load pending/running jobs
    const { data: jobsData } = await supabase
      .from('market_jobs')
      .select('*')
      .in('status', ['pending', 'running', 'failed'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(50)

    if (jobsData) setJobs(jobsData as Job[])

    // Load current budgets
    const currentHour = new Date()
    currentHour.setMinutes(0, 0, 0)
    const hourKey = currentHour.toISOString()

    const { data: budgetsData } = await supabase
      .from('market_budgets')
      .select('*')
      .eq('hour_window', hourKey)

    if (budgetsData) setBudgets(budgetsData as Budget[])

    // Load recent metrics
    const { data: metricsData } = await supabase
      .from('market_provider_metrics')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    if (metricsData) setMetrics(metricsData as Metrics[])

    // Load recent runs
    const { data: runsData } = await supabase
      .from('market_job_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10)

    if (runsData) setRuns(runsData as JobRun[])

    setLoading(false)
  }

  const triggerScheduler = async () => {
    try {
      // Note: This will fail in production unless you're service role authenticated
      // In development, you can manually trigger via curl with the cron secret
      const res = await fetch('/api/market/scheduler/run', {
        method: 'POST',
      })

      if (res.ok) {
        alert('Scheduler triggered successfully')
        loadData()
      } else {
        const data = await res.json()
        alert(`Failed: ${data.error}\n\nTip: Use curl with cron secret or service role key`)
      }
    } catch (error) {
      alert(`Error: ${error}`)
    }
  }

  const resetFailedJobs = async () => {
    const { error } = await supabase
      .from('market_jobs')
      .update({ status: 'pending', retry_count: 0, error_message: null })
      .eq('status', 'failed')

    if (error) {
      alert(`Failed to reset jobs: ${error.message}`)
    } else {
      alert('Failed jobs reset to pending')
      loadData()
    }
  }

  useEffect(() => {
    loadData()

    // Auto-refresh every 10 seconds
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Market Jobs Queue</h1>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline">
            Refresh
          </Button>
          <Button onClick={triggerScheduler}>
            Trigger Scheduler
          </Button>
          <Button onClick={resetFailedJobs} variant="destructive">
            Reset Failed
          </Button>
        </div>
      </div>

      {/* Budgets */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Limit Budgets (Current Hour)</CardTitle>
        </CardHeader>
        <CardContent>
          {budgets.length === 0 ? (
            <p className="text-sm text-gray-500">No budgets initialized for this hour</p>
          ) : (
            <div className="space-y-2">
              {budgets.map((budget) => (
                <div key={budget.provider} className="flex items-center justify-between p-3 border rounded">
                  <span className="font-medium capitalize">{budget.provider}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm">
                      {budget.used} / {budget.rate_limit} used
                    </span>
                    <div className="w-32 h-2 bg-gray-200 rounded overflow-hidden">
                      <div
                        className={`h-full ${
                          budget.used / budget.rate_limit > 0.8 ? 'bg-red-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${(budget.used / budget.rate_limit) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Pending/Running Jobs ({jobs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-gray-500">No pending jobs</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="p-2">Provider</th>
                    <th className="p-2">SKU</th>
                    <th className="p-2">Size</th>
                    <th className="p-2">Priority</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Retries</th>
                    <th className="p-2">Created</th>
                    <th className="p-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b">
                      <td className="p-2 capitalize">{job.provider}</td>
                      <td className="p-2 font-mono text-xs">{job.sku}</td>
                      <td className="p-2">{job.size || '—'}</td>
                      <td className="p-2">{job.priority}</td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            job.status === 'running'
                              ? 'bg-blue-100 text-blue-800'
                              : job.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="p-2">{job.retry_count}</td>
                      <td className="p-2 text-xs">{new Date(job.created_at).toLocaleTimeString()}</td>
                      <td className="p-2 text-xs text-red-600 max-w-xs truncate">
                        {job.error_message || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Runs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Scheduler Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-gray-500">No recent runs</p>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <div key={run.run_id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-mono text-xs text-gray-500">{run.run_id.substring(0, 8)}</div>
                    <div className="text-sm">
                      {new Date(run.started_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span>Selected: {run.jobs_selected}</span>
                    <span className="text-green-600">✓ {run.jobs_succeeded}</span>
                    <span className="text-red-600">✗ {run.jobs_failed}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Provider Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.length === 0 ? (
            <p className="text-sm text-gray-500">No metrics yet</p>
          ) : (
            <div className="space-y-2">
              {metrics.map((metric, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium capitalize">{metric.provider}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(metric.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span>Batch: {metric.batch_size}</span>
                    <span className="text-green-600">✓ {metric.succeeded}</span>
                    <span className="text-red-600">✗ {metric.failed}</span>
                    <span className="text-yellow-600">⊙ {metric.deferred}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
