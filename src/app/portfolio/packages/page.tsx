'use client'

import { useRequireAuth } from '@/hooks/useRequireAuth'
import { PackageRow, PackageRowSkeleton, type ShippingCarrier, type ShippingStatus } from '@/components/PackageRow'
import { Package as PackageIcon } from 'lucide-react'

// Mock data for demonstration - replace with real data from database
const mockPackages = [
  {
    id: '1',
    carrier: 'RoyalMail' as ShippingCarrier,
    trackingId: 'RM123456789GB',
    status: 'in_transit' as ShippingStatus,
    etaISO: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdateISO: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    carrier: 'DPD' as ShippingCarrier,
    trackingId: 'DPD987654321UK',
    status: 'out_for_delivery' as ShippingStatus,
    etaISO: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    lastUpdateISO: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    carrier: 'UPS' as ShippingCarrier,
    trackingId: 'UPS1234567890',
    status: 'delivered' as ShippingStatus,
    lastUpdateISO: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    carrier: 'Evri' as ShippingCarrier,
    trackingId: 'EVRI567890123',
    status: 'exception' as ShippingStatus,
    etaISO: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdateISO: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
]

export default function PackagesPage() {
  useRequireAuth()

  const handleTrack = (trackingId: string) => {
    // TODO: Implement tracking handler/URL
    console.log('Track package:', trackingId)
  }

  return (
    <div className="mx-auto max-w-[1280px] px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6 text-fg">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-fg relative inline-block">
          Packages
          <span className="absolute bottom-0 left-0 w-16 h-0.5 bg-accent-400 opacity-40"></span>
        </h1>
        <p className="text-sm text-dim mt-1">Track your shipments and deliveries</p>
      </div>

      {/* Packages List */}
      <div className="space-y-3">
        {mockPackages.length === 0 ? (
          <div className="text-center py-20 bg-elev-1 rounded-2xl border border-border">
            <PackageIcon className="h-12 w-12 mx-auto text-dim opacity-40 mb-4" />
            <p className="text-dim font-medium mb-1">No packages to track</p>
            <p className="text-sm text-dim/70">Your tracked shipments will appear here</p>
          </div>
        ) : (
          mockPackages.map((pkg) => (
            <PackageRow
              key={pkg.id}
              carrier={pkg.carrier}
              trackingId={pkg.trackingId}
              status={pkg.status}
              etaISO={pkg.etaISO}
              lastUpdateISO={pkg.lastUpdateISO}
              onTrack={() => handleTrack(pkg.trackingId)}
            />
          ))
        )}
      </div>
    </div>
  )
}
