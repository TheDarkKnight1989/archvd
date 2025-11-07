'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'archvd_onboarding_v1';

type ChecklistItem = {
  id: string;
  label: string;
  completed: boolean;
};

const INITIAL_CHECKLIST: ChecklistItem[] = [
  { id: 'import', label: 'Import collection', completed: false },
  { id: 'expenses', label: 'Add expenses', completed: false },
  { id: 'portfolio', label: 'View portfolio', completed: false },
  { id: 'export', label: 'Export report', completed: false },
];

export default function OnboardingChecklist() {
  const [checklist, setChecklist] = useState<ChecklistItem[]>(INITIAL_CHECKLIST);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.dismissed) {
          setDismissed(true);
        } else if (data.checklist) {
          setChecklist(data.checklist);
        }
      } catch (err) {
        console.error('Failed to parse onboarding data:', err);
      }
    }
  }, []);

  const saveToStorage = (items: ChecklistItem[], isDismissed: boolean = false) => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        checklist: items,
        dismissed: isDismissed,
      })
    );
  };

  const toggleItem = (id: string) => {
    const updated = checklist.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    setChecklist(updated);
    saveToStorage(updated);

    // Auto-dismiss if all completed
    if (updated.every((item) => item.completed)) {
      setTimeout(() => handleDismiss(), 1000);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    saveToStorage(checklist, true);
  };

  if (dismissed) return null;

  const allCompleted = checklist.every((item) => item.completed);

  return (
    <div className="border border-blue-200 bg-blue-50 rounded-2xl p-4 mb-6">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-blue-900">Getting Started</h3>
          <p className="text-xs text-blue-700 mt-0.5">
            Complete these steps to get the most out of archvd
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-blue-600 hover:text-blue-800 text-lg leading-none"
        >
          ×
        </button>
      </div>

      <div className="space-y-2">
        {checklist.map((item) => (
          <label
            key={item.id}
            className="flex items-center gap-2 cursor-pointer group hover:bg-blue-100 p-2 rounded-lg transition-colors"
          >
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => toggleItem(item.id)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span
              className={`text-sm ${
                item.completed ? 'line-through text-blue-600' : 'text-blue-900'
              }`}
            >
              {item.label}
            </span>
          </label>
        ))}
      </div>

      {allCompleted && (
        <div className="mt-3 pt-3 border-t border-blue-200">
          <p className="text-xs text-blue-700 text-center">All done! This will dismiss automatically.</p>
        </div>
      )}
    </div>
  );
}
