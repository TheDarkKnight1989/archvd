import { redirect } from 'next/navigation'

/**
 * Redirect from /portfolio/inventory-v4 to /portfolio/inventory
 *
 * V4 is now the default inventory page at /portfolio/inventory.
 * This redirect ensures old links/bookmarks continue to work.
 */
export default function InventoryV4Redirect() {
  redirect('/portfolio/inventory')
}
