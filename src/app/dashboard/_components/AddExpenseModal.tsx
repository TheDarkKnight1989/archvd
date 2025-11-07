/*
 * DEPRECATED: This component has been migrated to /dashboard/expenses
 * The expense functionality now exists as a dedicated page instead of a modal.
 * This file is kept for reference but is no longer used in the application.
 */

'use client';

import { useState, FormEvent, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase/client';
import { TABLE_ITEMS, TABLE_EXPENSES, type ExpenseCategory, type InventoryItem } from '@/lib/portfolio/types';

type AddExpenseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function AddExpenseModal({ isOpen, onClose, onSuccess }: AddExpenseModalProps) {
  const [category, setCategory] = useState<ExpenseCategory>('shipping');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [linkedItemId, setLinkedItemId] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Set mounted state (for portal)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch items when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchItems();
    }
  }, [isOpen]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Auto-focus first field when modal opens (only if nothing else focused)
  useEffect(() => {
    if (!isOpen) return;
    const el = firstFieldRef.current;
    // Only focus if nothing else is already focused (avoid stealing focus)
    if (el && document.activeElement === document.body) {
      el.focus();
    }
  }, [isOpen]);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from(TABLE_ITEMS)
        .select('id, sku, brand, model')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setItems(data || []);
    } catch (err: any) {
      console.error('Failed to fetch items:', err);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (!userId) {
        throw new Error('No authenticated user found');
      }

      const insertData: any = {
        user_id: userId,
        category,
        amount: parseFloat(amount),
        date,
        description,
      };

      if (linkedItemId) {
        insertData.linked_item_id = linkedItemId;
      }

      const { error } = await supabase.from(TABLE_EXPENSES).insert(insertData);

      if (error) throw error;

      // Reset form
      setCategory('shipping');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setDescription('');
      setLinkedItemId('');

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add expense');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-start md:items-center justify-center bg-black/40 backdrop-blur-sm p-4 pt-8"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        // Close on click outside card
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[85vh] overflow-y-auto">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 text-gray-500 hover:text-black text-2xl leading-none"
        >
          ×
        </button>

        <h2 className="mb-4 text-lg font-semibold">Add Expense</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="expense-category" className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              id="expense-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="shipping">Shipping</option>
              <option value="fees">Fees</option>
              <option value="ads">Advertising</option>
              <option value="supplies">Supplies</option>
              <option value="misc">Miscellaneous</option>
            </select>
          </div>

          <div>
            <label htmlFor="expense-amount" className="block text-sm font-medium text-gray-700 mb-1">
              Amount (£)
            </label>
            <input
              ref={firstFieldRef}
              type="number"
              id="expense-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              step="0.01"
              min="0"
              placeholder="15.00"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="expense-date" className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              id="expense-date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="expense-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              id="expense-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="E.g., Royal Mail shipping"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="linked-item" className="block text-sm font-medium text-gray-700 mb-1">
              Linked Item (Optional)
            </label>
            <select
              id="linked-item"
              value={linkedItemId}
              onChange={(e) => setLinkedItemId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">None</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} - {item.brand} {item.model}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Adding...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
