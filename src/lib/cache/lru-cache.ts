/**
 * Simple LRU (Least Recently Used) Cache
 * Used for caching search results and API responses
 */

interface CacheEntry<T> {
  value: T
  timestamp: number
}

export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private readonly maxSize: number
  private readonly ttl: number // Time to live in milliseconds

  constructor(maxSize: number = 200, ttlSeconds: number = 60) {
    this.maxSize = maxSize
    this.ttl = ttlSeconds * 1000
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }

    // Move to end (mark as recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)

    return entry.value
  }

  set(key: string, value: T): void {
    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    // Add new entry
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    })
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    // Check expiration
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }
}

// Global cache instance for market search
// NOTE: This will be reset on server restart (which is acceptable for dev/preview)
// In production, consider Redis or similar for distributed caching
export const marketSearchCache = new LRUCache<any>(200, 60)
