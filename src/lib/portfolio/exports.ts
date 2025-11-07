import type { InventoryItem } from './types';

type TaxExportRow = {
  date: string;
  sku: string;
  brand: string;
  model: string;
  size_uk: string;
  purchase_price: number;
  purchase_date: string;
  sold_price: number | string;
  sold_date: string;
  sales_fee: number | string;
  platform: string;
  expenses_allocated: number;
  net_profit: number | string;
};

type InsuranceExportRow = {
  brand: string;
  model: string;
  sku: string;
  purchase_date: string;
  purchase_price: number;
  current_value: number | string;
  location: string;
  image_url: string;
};

export function exportTaxCsv(
  items: InventoryItem[],
  options: { from?: string; to?: string } = {}
): void {
  // Default to UK tax year (Apr 6 - Apr 5)
  const now = new Date();
  const currentYear = now.getFullYear();
  const taxYearStart = options.from || `${currentYear}-04-06`;
  const taxYearEnd = options.to || `${currentYear + 1}-04-05`;

  const soldItems = items.filter((item) => item.status === 'sold' && item.sold_date);

  // Filter by tax year range
  const filteredItems = soldItems.filter((item) => {
    const soldDate = item.sold_date || '';
    return soldDate >= taxYearStart && soldDate <= taxYearEnd;
  });

  const rows: TaxExportRow[] = filteredItems.map((item) => ({
    date: item.sold_date || '',
    sku: item.sku,
    brand: item.brand,
    model: item.model,
    size_uk: item.size,
    purchase_price: item.purchase_price,
    purchase_date: item.purchase_date || item.created_at.split('T')[0],
    sold_price: item.sold_price || item.sale_price || '',
    sold_date: item.sold_date || '',
    sales_fee: item.sales_fee || 0,
    platform: item.platform || '',
    expenses_allocated: 0, // For now
    net_profit:
      (item.sold_price || item.sale_price || 0) -
      item.purchase_price -
      (item.sales_fee || 0),
  }));

  const headers = [
    'date',
    'sku',
    'brand',
    'model',
    'size_uk',
    'purchase_price',
    'purchase_date',
    'sold_price',
    'sold_date',
    'sales_fee',
    'platform',
    'expenses_allocated',
    'net_profit',
  ];

  const csvRows = rows.map((row) =>
    headers.map((header) => `"${row[header as keyof TaxExportRow]}"`).join(',')
  );

  const csv = [headers.join(','), ...csvRows].join('\n');
  downloadCsv(csv, `archvd-tax-${taxYearStart}-to-${taxYearEnd}.csv`);
}

export function exportInsuranceCsv(items: InventoryItem[]): void {
  const activeItems = items.filter((item) => item.status === 'in_stock');

  const rows: InsuranceExportRow[] = activeItems.map((item) => ({
    brand: item.brand,
    model: item.model,
    sku: item.sku,
    purchase_date: item.purchase_date || item.created_at.split('T')[0],
    purchase_price: item.purchase_price,
    current_value: item.market_value || item.purchase_price,
    location: item.location,
    image_url: item.image_url || '',
  }));

  const headers = [
    'brand',
    'model',
    'sku',
    'purchase_date',
    'purchase_price',
    'current_value',
    'location',
    'image_url',
  ];

  const csvRows = rows.map((row) =>
    headers.map((header) => `"${row[header as keyof InsuranceExportRow]}"`).join(',')
  );

  const csv = [headers.join(','), ...csvRows].join('\n');
  downloadCsv(csv, `archvd-insurance-${new Date().toISOString().split('T')[0]}.csv`);
}

function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
