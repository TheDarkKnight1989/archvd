/**
 * Shareable Reports Component
 * Generate public/private shareable dashboard links
 */

'use client'

import { useState } from 'react'
import { Share2, Link, Eye, EyeOff, Copy, Check, Clock, Settings } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'

interface ShareableReport {
  id: string
  name: string
  url: string
  visibility: 'public' | 'private' | 'password'
  createdAt: Date
  expiresAt: Date | null
  views: number
  includeMetrics: {
    revenue: boolean
    profit: boolean
    expenses: boolean
    items: boolean
    charts: boolean
  }
}

interface ShareableReportsProps {
  kpis: {
    revenue: number
    profit: number
    expenses: number
    numSales: number
  }
  dateRange: { from: string; to: string }
  formatCurrency: (value: number) => string
  className?: string
}

export function ShareableReports({
  kpis,
  dateRange,
  formatCurrency,
  className
}: ShareableReportsProps) {
  const [reports, setReports] = useState<ShareableReport[]>([
    {
      id: '1',
      name: 'Q4 2024 Investor Report',
      url: 'https://archvd.app/share/abc123xyz',
      visibility: 'private',
      createdAt: new Date(2024, 10, 15),
      expiresAt: new Date(2025, 0, 15),
      views: 12,
      includeMetrics: {
        revenue: true,
        profit: true,
        expenses: false,
        items: false,
        charts: true
      }
    }
  ])

  const [isCreating, setIsCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [newReport, setNewReport] = useState({
    name: '',
    visibility: 'private' as ShareableReport['visibility'],
    expiresIn: '30',
    includeMetrics: {
      revenue: true,
      profit: true,
      expenses: true,
      items: true,
      charts: true
    }
  })

  const handleCreate = () => {
    if (!newReport.name) return

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + parseInt(newReport.expiresIn))

    const report: ShareableReport = {
      id: Date.now().toString(),
      name: newReport.name,
      url: `https://archvd.app/share/${Math.random().toString(36).substring(7)}`,
      visibility: newReport.visibility,
      createdAt: new Date(),
      expiresAt: newReport.expiresIn === 'never' ? null : expiresAt,
      views: 0,
      includeMetrics: newReport.includeMetrics
    }

    setReports([report, ...reports])
    setNewReport({
      name: '',
      visibility: 'private',
      expiresIn: '30',
      includeMetrics: {
        revenue: true,
        profit: true,
        expenses: true,
        items: true,
        charts: true
      }
    })
    setIsCreating(false)
  }

  const handleCopy = (id: string, url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDelete = (id: string) => {
    setReports(reports.filter(r => r.id !== id))
  }

  return (
    <div className={cn('bg-elev-1 border border-border rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-accent" />
          <div>
            <h3 className="text-lg font-semibold text-fg">Shareable Reports</h3>
            <p className="text-sm text-muted mt-0.5">Generate links to share your P&L data</p>
          </div>
        </div>
        <Button
          onClick={() => setIsCreating(!isCreating)}
          size="sm"
          className="bg-accent/20 text-fg hover:bg-accent/30"
        >
          <Share2 className="h-4 w-4 mr-2" />
          Create Share Link
        </Button>
      </div>

      {/* Create New Share Form */}
      {isCreating && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-5">
          <div className="text-sm font-semibold text-blue-400 mb-3">Create Shareable Report</div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-dim uppercase tracking-wide mb-1 block">Report Name</label>
              <input
                type="text"
                value={newReport.name}
                onChange={(e) => setNewReport({ ...newReport, name: e.target.value })}
                placeholder="e.g., Monthly Performance - December 2024"
                className="w-full px-3 py-2 bg-elev-0 border border-border rounded text-sm text-fg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-dim uppercase tracking-wide mb-1 block">Visibility</label>
                <select
                  value={newReport.visibility}
                  onChange={(e) => setNewReport({ ...newReport, visibility: e.target.value as any })}
                  className="w-full px-3 py-2 bg-elev-0 border border-border rounded text-sm text-fg"
                >
                  <option value="private">Private (Link Only)</option>
                  <option value="password">Password Protected</option>
                  <option value="public">Public (Searchable)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-dim uppercase tracking-wide mb-1 block">Expires In</label>
                <select
                  value={newReport.expiresIn}
                  onChange={(e) => setNewReport({ ...newReport, expiresIn: e.target.value })}
                  className="w-full px-3 py-2 bg-elev-0 border border-border rounded text-sm text-fg"
                >
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="never">Never</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-dim uppercase tracking-wide mb-2 block">Include in Report</label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-sm text-fg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newReport.includeMetrics.revenue}
                    onChange={(e) => setNewReport({
                      ...newReport,
                      includeMetrics: { ...newReport.includeMetrics, revenue: e.target.checked }
                    })}
                    className="rounded"
                  />
                  Revenue
                </label>
                <label className="flex items-center gap-2 text-sm text-fg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newReport.includeMetrics.profit}
                    onChange={(e) => setNewReport({
                      ...newReport,
                      includeMetrics: { ...newReport.includeMetrics, profit: e.target.checked }
                    })}
                    className="rounded"
                  />
                  Profit
                </label>
                <label className="flex items-center gap-2 text-sm text-fg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newReport.includeMetrics.expenses}
                    onChange={(e) => setNewReport({
                      ...newReport,
                      includeMetrics: { ...newReport.includeMetrics, expenses: e.target.checked }
                    })}
                    className="rounded"
                  />
                  Expenses
                </label>
                <label className="flex items-center gap-2 text-sm text-fg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newReport.includeMetrics.items}
                    onChange={(e) => setNewReport({
                      ...newReport,
                      includeMetrics: { ...newReport.includeMetrics, items: e.target.checked }
                    })}
                    className="rounded"
                  />
                  Item Details
                </label>
                <label className="flex items-center gap-2 text-sm text-fg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newReport.includeMetrics.charts}
                    onChange={(e) => setNewReport({
                      ...newReport,
                      includeMetrics: { ...newReport.includeMetrics, charts: e.target.checked }
                    })}
                    className="rounded"
                  />
                  Charts & Graphs
                </label>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCreate}
                disabled={!newReport.name}
                size="sm"
                className="bg-blue-500 text-white hover:bg-blue-600"
              >
                Generate Link
              </Button>
              <Button
                onClick={() => setIsCreating(false)}
                size="sm"
                variant="outline"
                className="border-border/30"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Reports */}
      {reports.length > 0 ? (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="p-4 bg-elev-0 rounded-lg border border-border/30"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-fg mb-1">{report.name}</div>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <div className="flex items-center gap-1">
                      {report.visibility === 'private' && <EyeOff className="h-3 w-3" />}
                      {report.visibility === 'public' && <Eye className="h-3 w-3" />}
                      <span className="capitalize">{report.visibility}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {report.expiresAt
                        ? `Expires ${report.expiresAt.toLocaleDateString()}`
                        : 'Never expires'
                      }
                    </div>
                    <div>{report.views} views</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleCopy(report.id, report.url)}
                    size="sm"
                    variant="outline"
                    className="border-border/30"
                  >
                    {copiedId === report.id ? (
                      <>
                        <Check className="h-4 w-4 mr-1.5 text-[#00FF94]" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1.5" />
                        Copy Link
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => handleDelete(report.id)}
                    size="sm"
                    variant="outline"
                    className="border-red-400/30 hover:bg-red-500/10"
                  >
                    Revoke
                  </Button>
                </div>
              </div>

              {/* URL Display */}
              <div className="p-2 bg-elev-1 rounded border border-border/20 font-mono text-xs text-dim break-all">
                {report.url}
              </div>

              {/* Included Metrics */}
              <div className="mt-3 flex flex-wrap gap-2">
                {report.includeMetrics.revenue && (
                  <div className="px-2 py-0.5 bg-accent/10 text-accent text-xs rounded">Revenue</div>
                )}
                {report.includeMetrics.profit && (
                  <div className="px-2 py-0.5 bg-[#00FF94]/10 text-[#00FF94] text-xs rounded">Profit</div>
                )}
                {report.includeMetrics.expenses && (
                  <div className="px-2 py-0.5 bg-red-400/10 text-red-400 text-xs rounded">Expenses</div>
                )}
                {report.includeMetrics.items && (
                  <div className="px-2 py-0.5 bg-blue-400/10 text-blue-400 text-xs rounded">Items</div>
                )}
                {report.includeMetrics.charts && (
                  <div className="px-2 py-0.5 bg-purple-400/10 text-purple-400 text-xs rounded">Charts</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="text-dim text-sm mb-2">No shared reports yet</div>
          <div className="text-xs text-muted">Create a shareable link to share your P&L data with stakeholders</div>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-5 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
        <strong>Privacy:</strong> Shared links only include the data you select. Sensitive information is never exposed without your permission.
      </div>
    </div>
  )
}
