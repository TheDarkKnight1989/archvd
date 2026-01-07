/**
 * Alias Regions Service
 * Fetch and manage Alias API regions
 */

import { AliasClient } from './client';
import type { Region } from './types';

/**
 * HARDCODED ALIAS REGIONS (workaround for broken /regions endpoint)
 * The /regions endpoint returns 415 error, so we use known region IDs instead
 * These region IDs are stable and documented in Alias sync code
 */
const ALIAS_REGIONS: Region[] = [
  { id: '1', name: 'United States' },
  { id: '2', name: 'Europe' },
  { id: '3', name: 'United Kingdom' },
];

/**
 * Get all available Alias regions
 * @param client - AliasClient instance (unused, kept for backwards compatibility)
 * @returns Array of regions with id and name
 *
 * NOTE: This now returns hardcoded regions instead of calling the API
 * because the /regions endpoint is broken (returns 415 error)
 */
export async function getAliasRegions(client?: AliasClient): Promise<Region[]> {
  // Return hardcoded regions instead of calling broken API endpoint
  return ALIAS_REGIONS;
}

/**
 * Find a specific region by ID
 * @param client - AliasClient instance
 * @param regionId - Region ID to search for (e.g., 'REGION_UK')
 * @returns Region object if found, undefined otherwise
 */
export async function findRegionById(
  client: AliasClient,
  regionId: string
): Promise<Region | undefined> {
  const regions = await getAliasRegions(client);
  return regions.find(region => region.id === regionId);
}

/**
 * Find region ID by name (case-insensitive)
 * @param client - AliasClient instance
 * @param name - Region name to search for (e.g., 'United Kingdom', 'UK')
 * @returns Region ID if found, undefined otherwise
 */
export async function findRegionByName(
  client: AliasClient,
  name: string
): Promise<string | undefined> {
  const regions = await getAliasRegions(client);
  const normalizedName = name.toLowerCase();

  const region = regions.find(
    r => r.name.toLowerCase().includes(normalizedName) ||
         r.id.toLowerCase().includes(normalizedName)
  );

  return region?.id;
}

/**
 * Get UK region ID (convenience method)
 * @param client - AliasClient instance
 * @returns UK region ID if found, undefined otherwise
 */
export async function getUKRegionId(client: AliasClient): Promise<string | undefined> {
  return findRegionByName(client, 'uk');
}
