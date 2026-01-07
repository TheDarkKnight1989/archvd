/**
 * INTENTIONALLY V3
 * This admin page manages V3 `inventory_market_links` mappings.
 * V4 uses `inventory_v4_style_catalog` for product linking.
 * Kept for backwards compatibility and debugging V3 data.
 */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createClient as createServiceClient } from '@/lib/supabase/service'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle } from 'lucide-react'
import { MappingActions } from './_components/MappingActions'

interface InventoryItem {
  id: string
  sku: string
  size: string
  size_uk: string | null
  status: string
  brand: string
  model: string
}

interface MappingData {
  itemId: string
  sku: string
  size: string
  brand: string
  model: string
  status: string
  stockx_product_id: string | null
  stockx_variant_id: string | null
  hasMapping: boolean
}

async function getMappingData(userId: string): Promise<MappingData[]> {
  const serviceSupabase = createServiceClient()

  // 1. Fetch active portfolio items
  const { data: inventory, error: inventoryError } = await serviceSupabase
    .from('Inventory')
    .select('id, sku, size, size_uk, status, brand, model')
    .eq('user_id', userId)
    .in('status', ['active', 'listed', 'worn'])
    .order('created_at', { ascending: false })

  if (inventoryError) {
    console.error('[StockX Mappings] Error fetching inventory:', inventoryError)
    return []
  }

  // 2. Fetch all StockX mappings for these items
  const inventoryIds = inventory.map(item => item.id)
  const { data: mappings } = await serviceSupabase
    .from('inventory_market_links')
    .select('item_id, stockx_product_id, stockx_variant_id')
    .in('item_id', inventoryIds)

  // Create mapping lookup
  const mappingLookup = new Map<string, { stockx_product_id: string; stockx_variant_id: string }>()
  mappings?.forEach(m => {
    mappingLookup.set(m.item_id, {
      stockx_product_id: m.stockx_product_id,
      stockx_variant_id: m.stockx_variant_id,
    })
  })

  // 3. Build result
  return inventory.map(item => {
    const mapping = mappingLookup.get(item.id)

    return {
      itemId: item.id,
      sku: item.sku,
      size: item.size_uk || item.size,
      brand: item.brand,
      model: item.model,
      status: item.status,
      stockx_product_id: mapping?.stockx_product_id || null,
      stockx_variant_id: mapping?.stockx_variant_id || null,
      hasMapping: !!mapping,
    }
  })
}

function MappingStatusBadge({ hasMapping }: { hasMapping: boolean }) {
  if (hasMapping) {
    return (
      <Badge variant="default" className="bg-green-600 hover:bg-green-700">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Mapped
      </Badge>
    )
  }

  return (
    <Badge variant="danger">
      <XCircle className="mr-1 h-3 w-3" />
      Not mapped
    </Badge>
  )
}


export default async function StockXMappingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const mappings = await getMappingData(user.id)

  const mappedCount = mappings.filter(m => m.hasMapping).length
  const unmappedCount = mappings.filter(m => !m.hasMapping).length

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">StockX Mapping Management</h1>
        <p className="text-muted-foreground">
          Manage StockX product and variant mappings for your active portfolio items
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-6 border rounded-lg bg-card">
          <div className="text-2xl font-bold">{mappings.length}</div>
          <div className="text-sm text-muted-foreground">Total Active Items</div>
        </div>
        <div className="p-6 border rounded-lg bg-card">
          <div className="text-2xl font-bold text-green-600">{mappedCount}</div>
          <div className="text-sm text-muted-foreground">Mapped to StockX</div>
        </div>
        <div className="p-6 border rounded-lg bg-card">
          <div className="text-2xl font-bold text-red-600">{unmappedCount}</div>
          <div className="text-sm text-muted-foreground">Not Mapped</div>
        </div>
      </div>

      {/* Mappings Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-4 font-medium">SKU</th>
              <th className="text-left p-4 font-medium">Size</th>
              <th className="text-left p-4 font-medium">Brand / Model</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">StockX Product ID</th>
              <th className="text-left p-4 font-medium">StockX Variant ID</th>
              <th className="text-left p-4 font-medium">Mapping Status</th>
              <th className="text-left p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {mappings.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  No active portfolio items found
                </td>
              </tr>
            ) : (
              mappings.map((item) => (
                <tr key={item.itemId} className="hover:bg-muted/50">
                  <td className="p-4 font-mono text-sm">{item.sku}</td>
                  <td className="p-4">{item.size}</td>
                  <td className="p-4">
                    <div className="font-medium">{item.brand}</div>
                    <div className="text-sm text-muted-foreground">{item.model}</div>
                  </td>
                  <td className="p-4">
                    <Badge variant="outline" className="capitalize">
                      {item.status}
                    </Badge>
                  </td>
                  <td className="p-4 font-mono text-xs text-muted-foreground">
                    {item.stockx_product_id ? (
                      <span title={item.stockx_product_id}>
                        {item.stockx_product_id.slice(0, 8)}...
                      </span>
                    ) : (
                      <span className="text-red-500">—</span>
                    )}
                  </td>
                  <td className="p-4 font-mono text-xs text-muted-foreground">
                    {item.stockx_variant_id ? (
                      <span title={item.stockx_variant_id}>
                        {item.stockx_variant_id.slice(0, 8)}...
                      </span>
                    ) : (
                      <span className="text-red-500">—</span>
                    )}
                  </td>
                  <td className="p-4">
                    <MappingStatusBadge hasMapping={item.hasMapping} />
                  </td>
                  <td className="p-4">
                    {!item.hasMapping && <MappingActions itemId={item.itemId} sku={item.sku} />}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Help Text */}
      <div className="mt-8 p-6 border rounded-lg bg-muted/50">
        <h3 className="font-semibold mb-2">How to use this page</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          <li>Items with a <span className="text-green-600 font-medium">Mapped</span> badge are linked to StockX and will show market prices</li>
          <li>Items with a <span className="text-red-600 font-medium">Not mapped</span> badge need to be mapped before you can list them on StockX</li>
          <li>Click "Attempt StockX Mapping" to automatically search for the product using SKU and size</li>
          <li>If mapping fails, the product may not exist on StockX or the SKU/size may not match exactly</li>
        </ul>
      </div>
    </div>
  )
}
