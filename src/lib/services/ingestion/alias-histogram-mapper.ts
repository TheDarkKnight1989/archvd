/**
 * Alias Offer Histogram Ingestion
 * Maps offer histogram data (bid depth) to database format
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { OfferHistogramResponse } from '../alias/types';

interface IngestHistogramOptions {
  catalogId: string;
  sizeValue: number;
  sku: string;
  regionCode?: string;
  consigned?: boolean;
  snapshotAt: Date;
  supabase: SupabaseClient; // Accept supabase client as parameter
}

/**
 * Ingest offer histogram (bid depth) data
 * Stores complete bid ladder for depth chart visualization
 */
export async function ingestAliasOfferHistogram(
  rawSnapshotId: string | null,
  histogramResponse: OfferHistogramResponse,
  options: IngestHistogramOptions
): Promise<{ success: boolean; binsIngested: number; error?: string }> {
  const {
    catalogId,
    sizeValue,
    sku,
    regionCode = 'global',
    consigned = false,
    snapshotAt,
    supabase,
  } = options;

  try {

    const bins = histogramResponse?.offer_histogram?.bins || [];

    if (bins.length === 0) {
      console.log(`[Alias Histogram] No bins returned for ${sku} size ${sizeValue}`);
      return { success: true, binsIngested: 0 };
    }

    console.log(`[Alias Histogram] Ingesting ${bins.length} bins for ${sku} size ${sizeValue}`);

    // Delete existing histogram data for this catalog + size + region + consigned
    // We replace the entire histogram on each sync
    const { error: deleteError } = await supabase
      .from('alias_offer_histograms')
      .delete()
      .eq('catalog_id', catalogId)
      .eq('size_value', sizeValue)
      .eq('region_code', regionCode)
      .eq('consigned', consigned);

    if (deleteError) {
      console.error('[Alias Histogram] Delete error:', deleteError);
      return {
        success: false,
        binsIngested: 0,
        error: `Delete failed: ${deleteError.message}`,
      };
    }

    // Insert all bins
    const rows = bins.map((bin) => ({
      catalog_id: catalogId,
      sku,
      size_value: sizeValue,
      size_unit: 'US',
      price_cents: parseInt(bin.offer_price_cents, 10),
      offer_count: parseInt(bin.count, 10),
      region_code: regionCode,
      product_condition: 'PRODUCT_CONDITION_NEW',
      packaging_condition: 'PACKAGING_CONDITION_GOOD_CONDITION',
      consigned,
      snapshot_at: snapshotAt.toISOString(),
      raw_snapshot_id: rawSnapshotId,
    }));

    const { error: insertError } = await supabase
      .from('alias_offer_histograms')
      .insert(rows);

    if (insertError) {
      console.error('[Alias Histogram] Insert error:', insertError);
      return {
        success: false,
        binsIngested: 0,
        error: `Insert failed: ${insertError.message}`,
      };
    }

    console.log(`[Alias Histogram] ✅ Ingested ${bins.length} bins for ${sku} size ${sizeValue}`);

    return {
      success: true,
      binsIngested: bins.length,
    };
  } catch (error: any) {
    console.error('[Alias Histogram] Unexpected error:', error);
    return {
      success: false,
      binsIngested: 0,
      error: error.message,
    };
  }
}

/**
 * Get latest histogram for a catalog + size
 * Useful for displaying depth charts
 */
export async function getLatestOfferHistogram(
  supabase: SupabaseClient,
  catalogId: string,
  sizeValue: number,
  options?: {
    regionCode?: string;
    consigned?: boolean;
  }
) {
  const { regionCode = 'global', consigned = false } = options || {};

  const { data, error } = await supabase
    .from('alias_offer_histograms')
    .select('*')
    .eq('catalog_id', catalogId)
    .eq('size_value', sizeValue)
    .eq('region_code', regionCode)
    .eq('consigned', consigned)
    .order('snapshot_at', { ascending: false })
    .limit(100); // Get all bins from latest snapshot

  if (error) {
    console.error('[Alias Histogram] Query error:', error);
    return null;
  }

  return data;
}
