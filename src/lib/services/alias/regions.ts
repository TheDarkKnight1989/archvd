/**
 * Alias Regions Service
 * Fetch and manage Alias API regions
 */

import { AliasClient } from './client';
import type { Region } from './types';

/**
 * Fetch all available regions from Alias API
 * @param client - AliasClient instance
 * @returns Array of regions with id and name
 */
export async function getAliasRegions(client: AliasClient): Promise<Region[]> {
  const response = await client.listRegions();
  return response.regions;
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
