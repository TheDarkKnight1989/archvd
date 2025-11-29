'use client'

export function DashboardPreview() {
  return (
    <section id="dashboard-preview" className="py-20 border-b border-border/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-block px-3 py-1 bg-accent/10 border border-accent/20 rounded-full text-xs font-semibold text-accent uppercase tracking-wider mb-4">
            Alpha – Evolving With Our Early Users
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-fg mb-4">
            One Place For <span className="text-accent">Everything</span>
          </h2>
          <p className="text-lg text-muted max-w-2xl mx-auto">
            Your sales, expenses, and performance metrics all in one dashboard.
          </p>
        </div>

        {/* Dashboard Mockup */}
        <div className="relative max-w-6xl mx-auto">
          <div className="relative bg-gradient-to-br from-elev-2 to-elev-0 border border-border rounded-2xl overflow-hidden shadow-2xl shadow-accent/10">
            {/* Browser chrome */}
            <div className="bg-elev-2 border-b border-border/50 px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/50" />
              </div>
              <div className="flex-1 bg-elev-0 border border-border/50 rounded px-3 py-1 text-xs text-muted font-mono">
                app.archvd.io/portfolio/p-and-l
              </div>
            </div>

            {/* Dashboard content */}
            <div className="p-6 space-y-6">
              {/* KPI Cards Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Revenue', value: '£18,234', color: 'blue' },
                  { label: 'Net Profit', value: '£12,450', color: 'green' },
                  { label: 'Expenses', value: '£4,123', color: 'orange' },
                  { label: 'Margin', value: '68.2%', color: 'purple' },
                ].map((kpi, i) => (
                  <div key={i} className="bg-elev-1/50 border border-border/30 rounded-lg p-4">
                    <div className="text-xs text-muted mb-1 uppercase tracking-wider">{kpi.label}</div>
                    <div className={`text-xl font-bold font-mono text-${kpi.color}-400`}>{kpi.value}</div>
                  </div>
                ))}
              </div>

              {/* Chart Area */}
              <div className="bg-elev-1/50 border border-border/30 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-fg">Profit Over Time</span>
                  <span className="text-xs text-muted">Last 12 months</span>
                </div>
                {/* Fake area chart */}
                <div className="grid grid-cols-12 gap-1 h-32 items-end">
                  {[30, 45, 40, 60, 50, 70, 65, 80, 75, 85, 90, 95].map((height, i) => (
                    <div key={i} className="relative">
                      <div
                        className="bg-gradient-to-t from-accent/60 to-accent/20 rounded-t"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Table Preview */}
              <div className="bg-elev-1/50 border border-border/30 rounded-lg overflow-hidden">
                <div className="bg-elev-2/80 border-b border-border/50 px-4 py-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-fg">Recent Transactions</span>
                  <span className="text-xs text-muted">24 items</span>
                </div>
                <div className="divide-y divide-border/30">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-elev-2" />
                        <div>
                          <div className="text-sm text-fg">Nike Dunk Low</div>
                          <div className="text-xs text-muted">UK 9 • SKU-{1234 + i}</div>
                        </div>
                      </div>
                      <div className="text-sm font-mono text-green-400">+£{(120 + i * 15).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-accent/10 to-blue-500/10 rounded-2xl blur-2xl -z-10" />
          </div>
        </div>
      </div>
    </section>
  )
}
