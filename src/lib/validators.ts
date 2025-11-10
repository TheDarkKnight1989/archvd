/**
 * Zod Validation Schemas
 * Centralized request/response validation for APIs
 */

import { z } from 'zod'

// ============================================================================
// Common Schemas
// ============================================================================

export const currencySchema = z.enum(['GBP', 'EUR', 'USD'])

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')

export const uuidSchema = z.string().uuid()

export const platformSchema = z.enum(['ebay', 'stockx', 'goat', 'private', 'other'])

export const itemStatusSchema = z.enum(['active', 'listed', 'worn', 'sold', 'archived'])

// ============================================================================
// Item/Inventory Schemas
// ============================================================================

export const createItemSchema = z.object({
  sku: z.string().min(1),
  brand: z.string().optional(),
  model: z.string().optional(),
  size_uk: z.string().optional(),
  size: z.string().optional(),
  category: z.string().optional(),
  condition: z.string().optional(),
  purchase_price: z.number().min(0),
  purchase_currency: currencySchema.optional().default('GBP'),
  purchase_date: dateSchema.optional(),
  tax: z.number().min(0).optional(),
  shipping: z.number().min(0).optional(),
  place_of_purchase: z.string().optional(),
  order_number: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  custom_market_value: z.number().min(0).optional()
})

export type CreateItemInput = z.infer<typeof createItemSchema>

export const updateItemSchema = createItemSchema.partial()

export type UpdateItemInput = z.infer<typeof updateItemSchema>

// ============================================================================
// Mark as Sold Schemas
// ============================================================================

export const markAsSoldSchema = z.object({
  sold_price: z.number().min(0),
  sold_date: dateSchema,
  sale_currency: currencySchema.optional().default('GBP'),
  platform: z.string().optional(),
  fees: z.number().min(0).optional().default(0),
  shipping: z.number().min(0).optional().default(0),
  notes: z.string().optional()
})

export type MarkAsSoldInput = z.infer<typeof markAsSoldSchema>

// ============================================================================
// CSV Import Schemas
// ============================================================================

export const importInventoryRowSchema = z.object({
  sku: z.string(),
  brand: z.string().optional(),
  model: z.string().optional(),
  size_uk: z.union([z.string(), z.number()]).optional(),
  purchase_price: z.number().min(0),
  purchase_date: z.string().optional(),
  condition: z.string().optional(),
  location: z.string().optional(),
  status: itemStatusSchema.optional()
})

export const importInventorySchema = z.object({
  rows: z.array(importInventoryRowSchema),
  batch_id: z.string().optional()
})

export type ImportInventoryInput = z.infer<typeof importInventorySchema>

// ============================================================================
// Expense Schemas
// ============================================================================

export const createExpenseSchema = z.object({
  category: z.enum(['shipping', 'fees', 'ads', 'supplies', 'misc']),
  amount: z.number().min(0),
  date: dateSchema,
  description: z.string().optional(),
  expense_currency: currencySchema.optional().default('GBP'),
  linked_item_id: uuidSchema.optional()
})

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>

// ============================================================================
// Subscription Schemas
// ============================================================================

export const createSubscriptionSchema = z.object({
  name: z.string().min(1),
  vendor: z.string().optional(),
  amount: z.number().min(0),
  currency: currencySchema.optional().default('GBP'),
  interval: z.enum(['monthly', 'annual']).optional().default('monthly'),
  subscription_currency: currencySchema.optional().default('GBP')
})

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>

// ============================================================================
// Query Parameter Schemas
// ============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20)
})

export type PaginationParams = z.infer<typeof paginationSchema>

export const itemFiltersSchema = z.object({
  status: itemStatusSchema.optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(['created_at', 'purchase_price', 'sold_date']).optional()
})

export type ItemFiltersParams = z.infer<typeof itemFiltersSchema>

// ============================================================================
// API Response Schemas
// ============================================================================

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.array(z.any()).optional()
})

export type ApiError = z.infer<typeof apiErrorSchema>

export const apiSuccessSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema
  })

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate request body with Zod schema
 * Returns parsed data or throws validation error
 */
export function validateBody<T>(
  schema: z.ZodType<T>,
  body: unknown
): T {
  try {
    return schema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid request body', error.issues)
    }
    throw error
  }
}

/**
 * Validate query parameters with Zod schema
 */
export function validateQuery<T>(
  schema: z.ZodType<T>,
  query: unknown
): T {
  try {
    return schema.parse(query)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid query parameters', error.issues)
    }
    throw error
  }
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  public readonly issues: z.ZodIssue[]

  constructor(message: string, issues: z.ZodIssue[]) {
    super(message)
    this.name = 'ValidationError'
    this.issues = issues
  }

  toJSON(): ApiError {
    return {
      code: 'VALIDATION_ERROR',
      message: this.message,
      details: this.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code
      }))
    }
  }
}

/**
 * Format Zod validation error for API response
 */
export function formatValidationError(error: z.ZodError): ApiError {
  return {
    code: 'VALIDATION_ERROR',
    message: 'Invalid request',
    details: error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code
    }))
  }
}
