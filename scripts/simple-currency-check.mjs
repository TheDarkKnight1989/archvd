#!/usr/bin/env node
import 'dotenv/config';

const ALIAS_PAT = process.env.ALIAS_PAT;
const url = 'https://api.alias.org/api/v1/pricing_insights/availabilities/air-jordan-1-retro-low-og-chicago-2025-hq6998-600?region_id=2';

const response = await fetch(url, {
  headers: { 'Authorization': `Bearer ${ALIAS_PAT}` }
});

const data = await response.json();
console.log(JSON.stringify(data, null, 2));
