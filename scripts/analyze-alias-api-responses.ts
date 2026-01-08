/**
 * Comprehensive Alias API Response Analyzer
 *
 * Extracts EVERY field, data type, and example value from all API responses
 * Shows complete data structure without assumptions
 */

import fs from 'fs/promises';
import path from 'path';

interface FieldInfo {
  path: string;
  type: string;
  examples: Set<any>;
  isArray: boolean;
  isNullable: boolean;
}

const fieldRegistry = new Map<string, FieldInfo>();

function analyzeValue(obj: any, currentPath: string = ''): void {
  if (obj === null || obj === undefined) {
    registerField(currentPath, 'null', null);
    return;
  }

  const type = typeof obj;

  if (Array.isArray(obj)) {
    registerField(currentPath, 'array', `[${obj.length} items]`);
    // Analyze first few items to understand array structure
    obj.slice(0, 3).forEach((item, index) => {
      analyzeValue(item, `${currentPath}[${index}]`);
    });
  } else if (type === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      analyzeValue(value, newPath);
    }
  } else {
    registerField(currentPath, type, obj);
  }
}

function registerField(path: string, type: string, value: any): void {
  if (!path) return;

  let fieldInfo = fieldRegistry.get(path);

  if (!fieldInfo) {
    fieldInfo = {
      path,
      type,
      examples: new Set(),
      isArray: type === 'array',
      isNullable: value === null,
    };
    fieldRegistry.set(path, fieldInfo);
  }

  // Track multiple types (e.g., string | number)
  if (type !== fieldInfo.type && type !== 'null') {
    fieldInfo.type = `${fieldInfo.type} | ${type}`;
  }

  if (value === null) {
    fieldInfo.isNullable = true;
  }

  // Keep up to 3 example values
  if (fieldInfo.examples.size < 3 && value !== null) {
    fieldInfo.examples.add(JSON.stringify(value).substring(0, 100));
  }
}

async function main() {
  console.log('🔍 Analyzing Alias API Responses...\n');

  const responseFile = path.join(
    process.cwd(),
    'api-responses/alias_v4_test/DD1391-100_1765317497218.json'
  );

  const content = await fs.readFile(responseFile, 'utf-8');
  const data = JSON.parse(content);

  console.log(`📦 File size: ${(content.length / 1024).toFixed(2)} KB`);
  console.log(`📊 Total API responses: ${data.responses.length}\n`);

  // Analyze each API response
  data.responses.forEach((response: any, index: number) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`API Response #${index + 1}: ${response.endpoint}`);
    console.log(`Status: ${response.status}`);
    console.log(`${'='.repeat(80)}\n`);

    analyzeValue(response.data, `responses[${index}].data`);
  });

  // Generate comprehensive report
  console.log('\n\n');
  console.log('█'.repeat(80));
  console.log('COMPLETE DATA STRUCTURE - ALL FIELDS');
  console.log('█'.repeat(80));
  console.log('\n');

  // Group by endpoint
  const byEndpoint = new Map<string, FieldInfo[]>();

  fieldRegistry.forEach((field) => {
    const match = field.path.match(/responses\[(\d+)\]\.data\.(.*)/);
    if (match) {
      const responseIndex = parseInt(match[1]);
      const endpoint = data.responses[responseIndex].endpoint;
      const fieldPath = match[2];

      if (!byEndpoint.has(endpoint)) {
        byEndpoint.set(endpoint, []);
      }

      byEndpoint.get(endpoint)!.push({
        ...field,
        path: fieldPath,
      });
    }
  });

  // Print grouped by endpoint
  byEndpoint.forEach((fields, endpoint) => {
    console.log(`\n${'▓'.repeat(80)}`);
    console.log(`ENDPOINT: ${endpoint}`);
    console.log(`${'▓'.repeat(80)}\n`);

    // Sort fields alphabetically
    fields.sort((a, b) => a.path.localeCompare(b.path));

    fields.forEach((field) => {
      const nullable = field.isNullable ? ' | null' : '';
      const typeStr = `${field.type}${nullable}`;
      const examples = Array.from(field.examples).slice(0, 2).join(', ');

      console.log(`  ${field.path}`);
      console.log(`    Type: ${typeStr}`);
      if (examples) {
        console.log(`    Examples: ${examples}`);
      }
      console.log();
    });
  });

  // Summary statistics
  console.log('\n');
  console.log('█'.repeat(80));
  console.log('SUMMARY');
  console.log('█'.repeat(80));
  console.log(`\nTotal unique fields: ${fieldRegistry.size}`);
  console.log(`Total API endpoints tested: ${byEndpoint.size}\n`);

  byEndpoint.forEach((fields, endpoint) => {
    console.log(`  ${endpoint}: ${fields.length} fields`);
  });

  // Save to file for reference
  const outputPath = path.join(
    process.cwd(),
    'api-responses/alias_v4_test/FIELD_ANALYSIS.txt'
  );

  let output = '='.repeat(80) + '\n';
  output += 'ALIAS V4 API - COMPLETE FIELD ANALYSIS\n';
  output += '='.repeat(80) + '\n\n';

  byEndpoint.forEach((fields, endpoint) => {
    output += `\nENDPOINT: ${endpoint}\n`;
    output += '-'.repeat(80) + '\n';
    fields.forEach((field) => {
      const nullable = field.isNullable ? ' | null' : '';
      output += `${field.path}: ${field.type}${nullable}\n`;
      if (field.examples.size > 0) {
        output += `  Examples: ${Array.from(field.examples).join(', ')}\n`;
      }
    });
  });

  await fs.writeFile(outputPath, output);
  console.log(`\n✅ Full analysis saved to: ${outputPath}\n`);
}

main();
