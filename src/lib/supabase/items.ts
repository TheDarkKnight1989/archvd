// Supabase helpers for bulk import

import { supabase } from './client'
import { TABLE_ITEMS } from '../portfolio/types'
import type { NormalisedRow, ImportResult } from '../import/types'

/**
 * Insert batch of items with import_batch_id
 */
export async function insertBatch(
  rows: NormalisedRow[],
  importBatchId: string,
  userId: string
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0
  let skipped = 0

  // Process in batches of 200
  const BATCH_SIZE = 200

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)

    const itemsToInsert = batch.map((row) => ({
      user_id: userId,
      sku: row.sku,
      brand: row.brand || 'Unknown',
      model: row.model || row.sku,
      size: row.size_uk?.toString() || null,
      category: 'sneaker' as const,
      purchase_price: row.purchase_price,
      purchase_date: row.purchase_date,
      status: row.status || 'in_stock',
      location: row.location || 'warehouse',
      import_batch_id: importBatchId,
      import_source: 'bulk' as const,
    }))

    try {
      const { data, error } = await supabase.from(TABLE_ITEMS).insert(itemsToInsert).select('id')

      if (error) {
        console.error('Batch insert error:', error)
        skipped += batch.length
      } else {
        inserted += data?.length || 0
      }
    } catch (err) {
      console.error('Batch insert failed:', err)
      skipped += batch.length
    }

    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < rows.length) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  return { inserted, skipped }
}

/**
 * Undo import by batch ID
 */
export async function undoImport(
  importBatchId: string,
  userId: string
): Promise<{ deleted: number }> {
  try {
    const { data, error } = await supabase
      .from(TABLE_ITEMS)
      .delete()
      .eq('user_id', userId)
      .eq('import_batch_id', importBatchId)
      .select('id')

    if (error) {
      console.error('Undo import error:', error)
      return { deleted: 0 }
    }

    return { deleted: data?.length || 0 }
  } catch (err) {
    console.error('Undo import failed:', err)
    return { deleted: 0 }
  }
}

/**
 * Get recent imports for history
 */
export async function getRecentImports(userId: string, limit: number = 5) {
  try {
    const { data, error } = await supabase
      .from(TABLE_ITEMS)
      .select('import_batch_id, created_at')
      .eq('user_id', userId)
      .not('import_batch_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000) // Get enough to find unique batches

    if (error) {
      console.error('Get recent imports error:', error)
      return []
    }

    // Group by import_batch_id and count
    const grouped = (data || []).reduce((acc: Record<string, { count: number; date: string }>, item) => {
      const batchId = item.import_batch_id
      if (!batchId) return acc

      if (!acc[batchId]) {
        acc[batchId] = { count: 1, date: item.created_at }
      } else {
        acc[batchId].count++
      }
      return acc
    }, {})

    // Convert to array and sort by date
    const imports = Object.entries(grouped)
      .map(([batchId, info]) => ({
        importBatchId: batchId,
        count: info.count,
        date: info.date,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit)

    return imports
  } catch (err) {
    console.error('Get recent imports failed:', err)
    return []
  }
}
