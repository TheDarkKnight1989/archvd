/**
 * Product Market Page - Redirects to new slug-based market page
 * OLD Route: /portfolio/inventory/market/[itemId]
 * NEW Route: /portfolio/market/[slug]?itemId=[itemId]
 */

import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateProductSlug } from '@/lib/utils/slug'

interface PageProps {
  params: Promise<{ itemId: string }>
}

export default async function ProductMarketRedirect({ params }: PageProps) {
  const { itemId } = await params

  // Fetch item to get SKU for slug generation
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  const { data: item } = await supabase
    .from('Inventory')
    .select('sku, brand, model')
    .eq('id', itemId)
    .maybeSingle()

  if (item?.sku) {
    // Generate slug and redirect to new market page
    const productName = `${item.brand || ''} ${item.model || ''}`.trim()
    const slug = generateProductSlug(productName, item.sku)
    redirect(`/portfolio/market/${slug}?itemId=${itemId}`)
  }

  // Fallback: redirect to inventory if item not found
  redirect('/portfolio/inventory')
}
