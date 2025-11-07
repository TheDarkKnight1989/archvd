export const TABLE_ITEMS = 'Inventory'; // IMPORTANT: Must match Supabase table name exactly
export const TABLE_EXPENSES = 'expenses';

export type Category = 'sneaker' | 'apparel' | 'accessory' | 'other';
export type Status = 'in_stock' | 'sold' | 'reserved';
export type Platform = 'StockX' | 'eBay' | 'Vinted' | 'Instagram' | 'Other';
export type ExpenseCategory = 'shipping' | 'fees' | 'ads' | 'supplies' | 'misc';

export type InventoryItem = {
  id: string;
  user_id: string;
  sku: string;
  brand: string;
  model: string;
  size: string;
  category?: Category;
  purchase_price: number;
  purchase_date?: string;
  sale_price?: number | null;
  sold_price?: number | null;
  sold_date?: string | null;
  platform?: Platform | null;
  sales_fee?: number | null;
  market_value?: number | null;
  status: Status;
  location: string;
  image_url?: string | null;
  created_at: string;
};

export type Expense = {
  id: string;
  user_id: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  description: string;
  linked_item_id?: string | null;
  created_at: string;
};

export type MonthlyPnL = {
  month: string;
  revenue: number;
  cost: number;
  sales_fees: number;
  expenses: number;
  net_profit: number;
};
