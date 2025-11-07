'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatGBP } from '@/lib/utils/currency';
import { TABLE_ITEMS, TABLE_EXPENSES } from '@/lib/portfolio/types';

type MonthlyStats = {
  revenue: number;
  cost: number;
  sales_fees: number;
  expenses: number;
  net_profit: number;
};

export default function MonthlyPnLCard() {
  const [stats, setStats] = useState<MonthlyStats>({
    revenue: 0,
    cost: 0,
    sales_fees: 0,
    expenses: 0,
    net_profit: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMonthlyStats();
  }, []);

  const fetchMonthlyStats = async () => {
    try {
      // Get current month boundaries
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      // Fetch sold items for current month
      const { data: soldItems, error: itemsError } = await supabase
        .from(TABLE_ITEMS)
        .select('sold_price, sale_price, purchase_price, sales_fee, sold_date')
        .eq('status', 'sold')
        .gte('sold_date', monthStart)
        .lte('sold_date', monthEnd);

      if (itemsError) throw itemsError;

      // Fetch expenses for current month
      const { data: expenses, error: expensesError } = await supabase
        .from(TABLE_EXPENSES)
        .select('amount')
        .gte('date', monthStart.split('T')[0])
        .lte('date', monthEnd.split('T')[0]);

      if (expensesError) throw expensesError;

      // Calculate stats
      let revenue = 0;
      let cost = 0;
      let salesFees = 0;

      (soldItems || []).forEach((item) => {
        const soldPrice = item.sold_price || item.sale_price || 0;
        revenue += soldPrice;
        cost += item.purchase_price;
        salesFees += item.sales_fee || 0;
      });

      const totalExpenses = (expenses || []).reduce((sum, exp) => sum + exp.amount, 0);
      const netProfit = revenue - cost - salesFees - totalExpenses;

      setStats({
        revenue,
        cost,
        sales_fees: salesFees,
        expenses: totalExpenses,
        net_profit: netProfit,
      });
    } catch (err: any) {
      console.error('Failed to fetch monthly stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentMonth = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
        <h3 className="text-lg font-semibold text-white">Monthly P&L</h3>
        <p className="text-sm text-blue-100 mt-0.5">{currentMonth}</p>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-sm text-gray-600">Loading stats...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {/* Revenue */}
              <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                <div className="text-xs font-medium text-green-700 mb-2">Revenue</div>
                <div className="text-xl font-bold text-green-600">{formatGBP(stats.revenue)}</div>
              </div>

              {/* Cost */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="text-xs font-medium text-gray-700 mb-2">Cost</div>
                <div className="text-xl font-bold text-gray-900">{formatGBP(stats.cost)}</div>
              </div>

              {/* Sales Fees */}
              <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                <div className="text-xs font-medium text-orange-700 mb-2">Sales Fees</div>
                <div className="text-xl font-bold text-orange-600">{formatGBP(stats.sales_fees)}</div>
              </div>

              {/* Expenses */}
              <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                <div className="text-xs font-medium text-red-700 mb-2">Expenses</div>
                <div className="text-xl font-bold text-red-600">{formatGBP(stats.expenses)}</div>
              </div>

              {/* Net Profit */}
              <div className={`p-4 rounded-xl border ${
                stats.net_profit >= 0
                  ? 'bg-blue-50 border-blue-100'
                  : 'bg-red-50 border-red-100'
              }`}>
                <div className={`text-xs font-medium mb-2 ${stats.net_profit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                  Net Profit
                </div>
                <div className={`text-xl font-bold ${
                  stats.net_profit >= 0 ? 'text-blue-600' : 'text-red-600'
                }`}>
                  {formatGBP(stats.net_profit)}
                </div>
              </div>
            </div>

            {/* Formula Display */}
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center justify-center text-xs text-gray-600 space-x-2">
                <span className="font-medium">Net Profit</span>
                <span>=</span>
                <span className="text-green-600">Revenue</span>
                <span>−</span>
                <span className="text-gray-700">Cost</span>
                <span>−</span>
                <span className="text-orange-600">Sales Fees</span>
                <span>−</span>
                <span className="text-red-600">Expenses</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
