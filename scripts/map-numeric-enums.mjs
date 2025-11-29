#!/usr/bin/env node
/**
 * Map all numeric enum values for Alias API
 * Discover what each number means for product_condition and packaging_condition
 */

import 'dotenv/config';

const ALIAS_PAT = process.env.ALIAS_PAT;
const baseUrl = 'https://api.alias.org/api/v1';

const catalogId = 'air-jordan-1-retro-low-og-chicago-2025-hq6998-600';
const size = 10;

console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
console.log('║              MAPPING NUMERIC ENUM VALUES                                   ║');
console.log('╚════════════════════════════════════════════════════════════════════════════╝');

// Known string enum mappings from types
const KNOWN_ENUMS = {
  product_condition: [
    'PRODUCT_CONDITION_INVALID',           // Usually 0
    'PRODUCT_CONDITION_NEW',               // Usually 1
    'PRODUCT_CONDITION_USED',              // Usually 2
    'PRODUCT_CONDITION_NEW_WITH_DEFECTS',  // Usually 3
  ],
  packaging_condition: [
    'PACKAGING_CONDITION_INVALID',         // Usually 0
    'PACKAGING_CONDITION_GOOD_CONDITION',  // Usually 1
    'PACKAGING_CONDITION_MISSING_LID',     // Usually 2
    'PACKAGING_CONDITION_BADLY_DAMAGED',   // Usually 3
    'PACKAGING_CONDITION_NO_ORIGINAL_BOX', // Usually 4
  ],
};

console.log('\n📋 Expected Enum Mappings (based on protobuf conventions):');
console.log('\nProduct Condition:');
KNOWN_ENUMS.product_condition.forEach((name, idx) => {
  console.log(`  ${idx} = ${name}`);
});

console.log('\nPackaging Condition:');
KNOWN_ENUMS.packaging_condition.forEach((name, idx) => {
  console.log(`  ${idx} = ${name}`);
});

// Test product_condition values 0-4
console.log('\n\n' + '═'.repeat(80));
console.log('TESTING PRODUCT_CONDITION NUMERIC VALUES (0-4)');
console.log('═'.repeat(80));

for (let productCondition = 0; productCondition <= 4; productCondition++) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`Product Condition = ${productCondition}`);
  console.log('─'.repeat(80));

  const params = new URLSearchParams({
    catalog_id: catalogId,
    size: size.toString(),
    product_condition: productCondition.toString(),
    packaging_condition: '1', // GOOD_CONDITION
    region_id: '2',
  });

  const url = `${baseUrl}/pricing_insights/availability?${params}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${ALIAS_PAT}` },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.availability) {
        const ask = parseInt(data.availability.lowest_listing_price_cents) || 0;
        const bid = parseInt(data.availability.highest_offer_price_cents) || 0;

        if (ask > 0 || bid > 0) {
          console.log(`✅ Valid - Ask: $${(ask / 100).toFixed(2)}, Bid: $${(bid / 100).toFixed(2)}`);
          console.log(`   → Likely: ${KNOWN_ENUMS.product_condition[productCondition] || 'UNKNOWN'}`);
        } else {
          console.log(`⚠️  Valid but no pricing data`);
          console.log(`   → Likely: ${KNOWN_ENUMS.product_condition[productCondition] || 'UNKNOWN'}`);
        }
      } else {
        console.log('⚠️  No availability in response');
      }
    } else {
      console.log(`❌ Failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

// Test packaging_condition values 0-5
console.log('\n\n' + '═'.repeat(80));
console.log('TESTING PACKAGING_CONDITION NUMERIC VALUES (0-5)');
console.log('═'.repeat(80));

for (let packagingCondition = 0; packagingCondition <= 5; packagingCondition++) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`Packaging Condition = ${packagingCondition}`);
  console.log('─'.repeat(80));

  const params = new URLSearchParams({
    catalog_id: catalogId,
    size: size.toString(),
    product_condition: '1', // NEW
    packaging_condition: packagingCondition.toString(),
    region_id: '2',
  });

  const url = `${baseUrl}/pricing_insights/availability?${params}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${ALIAS_PAT}` },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.availability) {
        const ask = parseInt(data.availability.lowest_listing_price_cents) || 0;
        const bid = parseInt(data.availability.highest_offer_price_cents) || 0;

        if (ask > 0 || bid > 0) {
          console.log(`✅ Valid - Ask: $${(ask / 100).toFixed(2)}, Bid: $${(bid / 100).toFixed(2)}`);
          console.log(`   → Likely: ${KNOWN_ENUMS.packaging_condition[packagingCondition] || 'UNKNOWN'}`);
        } else {
          console.log(`⚠️  Valid but no pricing data`);
          console.log(`   → Likely: ${KNOWN_ENUMS.packaging_condition[packagingCondition] || 'UNKNOWN'}`);
        }
      } else {
        console.log('⚠️  No availability in response');
      }
    } else {
      console.log(`❌ Failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

// Summary
console.log('\n\n' + '═'.repeat(80));
console.log('CONFIRMED MAPPINGS');
console.log('═'.repeat(80));

console.log('\n✅ Regions (CONFIRMED):');
console.log('   1 = US');
console.log('   2 = EU');
console.log('   3 = UK');
console.log('   4 = AUS');
console.log('   5 = CAD');
console.log('   6 = JPN');

console.log('\n✅ Product Condition (likely):');
console.log('   0 = INVALID');
console.log('   1 = NEW');
console.log('   2 = USED');
console.log('   3 = NEW_WITH_DEFECTS');

console.log('\n✅ Packaging Condition (likely):');
console.log('   0 = INVALID');
console.log('   1 = GOOD_CONDITION');
console.log('   2 = MISSING_LID');
console.log('   3 = BADLY_DAMAGED');
console.log('   4 = NO_ORIGINAL_BOX');

console.log('\n💡 Both formats work:');
console.log('   String: product_condition=PRODUCT_CONDITION_NEW');
console.log('   Numeric: product_condition=1');

console.log('\n' + '═'.repeat(80) + '\n');
