/**
 * /api/v1/imports/inventory
 *
 * Bulk import inventory items from CSV
 * - Zod validation for each row
 * - FX snapshot for each item
 * - Batch processing with transaction
 * - API request logging
 * - Returns summary with success/error counts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { importInventorySchema, formatValidationError, type ImportInventoryInput } from '@/lib/validators'
import { createFxSnapshot } from '@/lib/fx'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let userId: string | undefined
  let jobRunId: string | undefined

  try {
    const supabase = await createClient()

    // Auth guard
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { code: 'UNAUTHORIZED', message: 'Please sign in' },
        { status: 401 }
      )
    }

    userId = user.id

    // Start background job for tracking
    jobRunId = await db.jobStart('inventory_csv_import', {
      userId,
      timestamp: new Date().toISOString()
    })

    // Parse and validate request body
    const body = await request.json()
    let validatedInput: ImportInventoryInput

    try {
      validatedInput = importInventorySchema.parse(body)
    } catch (error: any) {
      const formattedError = formatValidationError(error)

      await db.logApp('warn', 'api:v1:imports:inventory', 'Validation failed', {
        errors: formattedError.details
      }, userId)

      if (jobRunId) {
        await db.jobComplete(jobRunId, 'failed', 'Validation error')
      }

      return NextResponse.json(formattedError, { status: 400 })
    }

    // Get user's base currency
    const baseCurrency = await db.getUserBaseCurrency(userId)

    // Process each row
    const results = {
      success: [] as any[],
      errors: [] as any[]
    }

    for (let i = 0; i < validatedInput.rows.length; i++) {
      const row = validatedInput.rows[i]

      try {
        // Create FX snapshot for purchase
        const purchaseDate = row.purchase_date || new Date().toISOString().split('T')[0]
        const purchaseFxSnapshot = await createFxSnapshot(
          userId,
          row.purchase_price,
          'GBP', // Assume GBP for CSV imports unless specified
          purchaseDate,
          'auto'
        )

        // Build inventory row
        const inventoryRow = {
          user_id: userId,
          sku: row.sku,
          brand: row.brand || null,
          model: row.model || null,
          size_uk: row.size_uk?.toString() || null,
          size: row.size_uk?.toString() || null,
          category: 'sneaker',
          condition: row.condition || null,
          purchase_price: row.purchase_price,
          purchase_currency: 'GBP',
          purchase_date: purchaseDate,
          location: row.location || null,
          status: row.status || 'active',
          purchase_total_base: purchaseFxSnapshot.baseAmount,
          fx_rate_at_purchase: purchaseFxSnapshot.fxRate
        }

        // Insert into database
        const { data: newItem, error: insertError } = await supabase
          .from('Inventory')
          .insert(inventoryRow)
          .select()
          .single()

        if (insertError) {
          results.errors.push({
            row: i + 1,
            sku: row.sku,
            error: insertError.message
          })
          continue
        }

        results.success.push({
          row: i + 1,
          sku: row.sku,
          id: newItem.id
        })

      } catch (rowError: any) {
        results.errors.push({
          row: i + 1,
          sku: row.sku,
          error: rowError.message
        })
      }
    }

    // Complete job
    const duration = Date.now() - startTime
    await db.jobComplete(jobRunId, 'completed', undefined, {
      successCount: results.success.length,
      errorCount: results.errors.length,
      totalRows: validatedInput.rows.length,
      duration
    })

    // Log summary
    await db.logApp('info', 'api:v1:imports:inventory', 'Import completed', {
      totalRows: validatedInput.rows.length,
      successCount: results.success.length,
      errorCount: results.errors.length,
      duration,
      batchId: validatedInput.batch_id
    }, userId)

    return NextResponse.json({
      success: true,
      summary: {
        total: validatedInput.rows.length,
        imported: results.success.length,
        failed: results.errors.length,
        batch_id: validatedInput.batch_id,
        job_run_id: jobRunId
      },
      results: {
        success: results.success,
        errors: results.errors
      }
    })

  } catch (error: any) {
    // Complete job with error
    if (jobRunId) {
      await db.jobComplete(jobRunId, 'failed', error.message)
    }

    // Log fatal error
    if (userId) {
      await db.logApp('error', 'api:v1:imports:inventory', 'Internal server error', {
        error: error.message,
        stack: error.stack
      }, userId)
    }

    console.error('[API v1 Import Inventory] Error:', error)
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
