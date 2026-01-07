/**
 * Inngest Client Configuration
 * Production-grade background job processing for market data sync
 */

import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'archvd',
  name: 'ARCHVD Market Data Sync',
})
