'use client';

import { useRequireAuth } from '@/hooks/useRequireAuth';
import Link from 'next/link';

export default function SettingsPage() {
  useRequireAuth();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-blue-600 hover:text-blue-800">
          ← Back to Dashboard
        </Link>
      </div>

      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Data & Privacy Section */}
        <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Data & Privacy</h2>

          <div className="space-y-4 text-sm text-gray-700">
            <p>
              Your data is stored securely in Supabase Postgres with Row Level Security (RLS) enabled.
              This ensures that only you can access your inventory, expenses, and transaction data.
            </p>

            <p>
              You can export or delete your data at any time from this Settings page. All exports are
              generated client-side and downloaded directly to your device.
            </p>

            <p>
              Backups are automatically managed by our infrastructure provider (Supabase) with
              point-in-time recovery capabilities. Your data is replicated across multiple
              availability zones for redundancy.
            </p>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold mb-3">Data Management</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <button className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                  Export All Data
                </button>
                <button className="px-4 py-2 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors">
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Account Section */}
        <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Account</h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-700">Email</span>
              <span className="text-gray-900 font-medium">Loading...</span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-gray-700">Member since</span>
              <span className="text-gray-900 font-medium">Loading...</span>
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Preferences</h2>

          <div className="space-y-4">
            <div>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-700">Email notifications</span>
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </label>
            </div>

            <div>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-700">Show onboarding checklist</span>
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
