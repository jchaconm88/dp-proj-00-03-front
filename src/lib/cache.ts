/**
 * Cache en memoria simple con TTL.
 * Usado para cache de resolución de tenants y contenido del CMS.
 * Req 15.4: fallback a cache de hasta 24h cuando el CMS no responde
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
  cachedAt: number
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>()

  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
      cachedAt: Date.now(),
    })
  }

  get<T>(key: string): { data: T; ageSeconds: number } | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined
    if (!entry) return null

    const now = Date.now()
    if (now > entry.expiresAt) {
      this.store.delete(key)
      return null
    }

    return {
      data: entry.data,
      ageSeconds: Math.floor((now - entry.cachedAt) / 1000),
    }
  }

  /**
   * Obtiene un valor aunque esté expirado (para fallback).
   * Devuelve null solo si nunca fue cacheado.
   */
  getStale<T>(key: string, maxAgeSeconds: number): { data: T; ageSeconds: number } | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined
    if (!entry) return null

    const ageSeconds = Math.floor((Date.now() - entry.cachedAt) / 1000)
    if (ageSeconds > maxAgeSeconds) return null

    return { data: entry.data, ageSeconds }
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  invalidateByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key)
      }
    }
  }
}

// Singleton — compartido en el proceso Node.js del servidor Astro
export const cache = new MemoryCache()

export const CACHE_TTL = {
  TENANT_RESOLUTION: 5 * 60, // 5 minutos (dominios cambian poco)
  CONTENT: 2 * 60, // 2 minutos (para actualizarse tras webhook)
  SITEMAP: 10 * 60, // 10 minutos
  STALE_MAX: 24 * 60 * 60, // 24h máximo para contenido stale
} as const
