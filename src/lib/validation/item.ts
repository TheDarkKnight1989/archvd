import { z } from 'zod';

export const itemSchema = z.object({
  // Required base
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'), // e.g. "Air Jordan 1 High OG"
  purchase_price: z.number({ message: 'Enter a number' }).nonnegative(),

  // Optional enrichment
  style_id: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  colorway: z.string().optional(),
  condition: z.enum(['New', 'Used', 'Worn', 'Defect']).optional(),
  category: z.string().optional(),         // default sneaker in UI
  size_uk: z.string().optional(),
  size_alt: z.string().optional(),

  // Costs
  tax: z.number().optional(),
  shipping: z.number().optional(),

  // Purchase meta
  place_of_purchase: z.string().optional(),
  purchase_date: z.string().optional(),    // ISO date from input
  order_number: z.string().optional(),

  // Org
  tags: z.array(z.string()).optional(),
  watchlist_id: z.string().optional(),

  // Price override
  custom_market_value: z.number().optional(),

  // Notes
  notes: z.string().max(250).optional(),
});

export type NewItemInput = z.infer<typeof itemSchema>;
