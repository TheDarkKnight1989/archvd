/**
 * Shopify Import Button Component
 * Triggers import of sneaker inventory from Shopify
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  total: number;
}

interface ShopifyImportButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg';
  onImportComplete?: (result: ImportResult) => void;
}

export function ShopifyImportButton({
  variant = 'default',
  size = 'default',
  onImportComplete,
}: ShopifyImportButtonProps) {
  const [importing, setImporting] = useState(false);

  async function handleImport() {
    try {
      setImporting(true);

      toast.loading('Importing from Shopify...', { id: 'shopify-import' });

      const response = await fetch('/api/shopify/import', {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Import failed');
      }

      const data = await response.json();
      const result = data.result as ImportResult;

      toast.success(
        `✅ Import complete! ${result.imported} new, ${result.updated} updated, ${result.skipped} skipped`,
        { id: 'shopify-import' }
      );

      // Call callback if provided
      if (onImportComplete) {
        onImportComplete(result);
      }

      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error('Shopify import failed:', error);
      toast.error(`Import failed: ${error.message}`, { id: 'shopify-import' });
    } finally {
      setImporting(false);
    }
  }

  return (
    <Button
      onClick={handleImport}
      disabled={importing}
      variant={variant}
      size={size}
    >
      {importing ? (
        <>
          <span className="mr-2">⏳</span>
          Importing...
        </>
      ) : (
        <>
          <span className="mr-2">🛒</span>
          Import from Shopify
        </>
      )}
    </Button>
  );
}
