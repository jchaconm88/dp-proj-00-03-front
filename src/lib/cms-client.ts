import type { Tenant, Domain, Page, Post, Menu, TenantLanguage } from '../types/api.js'
import { cache, CACHE_TTL } from './cache.js'

const CMS_URL = import.meta.env.CMS_URL ?? 'http://localhost:3000'
const CMS_TIMEOUT_MS = 5000 // Req 15.4: timeout de 5 segundos

async function fetchCMS<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CMS_TIMEOUT_MS)

  try {
    const response = await fetch(`${CMS_URL}/api${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`CMS API error: ${response.status} ${response.statusText}`)
    }

    return (await response.json()) as T
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Resuelve el tenant a partir del hostname.
 * Req 15.3, 2.2 — Property 7
 */
export async function resolveTenantByHostname(hostname: string): Promise<Tenant | null> {
  const normalized = hostname.toLowerCase().trim().split(':')[0]
  const cacheKey = `tenant:hostname:${normalized}`

  const cached = cache.get<Tenant | null>(cacheKey)
  if (cached !== null) return cached.data

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CMS_TIMEOUT_MS)

  try {
    const response = await fetch(
      `${CMS_URL}/api/public/resolve-tenant?hostname=${encodeURIComponent(normalized)}`,
      {
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
      },
    )

    if (response.status === 404) {
      cache.set(cacheKey, null, CACHE_TTL.TENANT_RESOLUTION)
      return null
    }

    if (!response.ok) {
      throw new Error(`CMS resolve-tenant error: ${response.status} ${response.statusText}`)
    }

    const tenant = (await response.json()) as Tenant
    cache.set(cacheKey, tenant, CACHE_TTL.TENANT_RESOLUTION)
    return tenant
  } catch {
    const stale = cache.getStale<Tenant | null>(cacheKey, CACHE_TTL.STALE_MAX)
    return stale?.data ?? null
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Obtiene el contenido de una pagina por tenant y slug.
 * Req 15.1, 15.4: fallback a cache de hasta 24h
 */
export async function getPage(tenantId: string, slug: string, lang: string): Promise<Page | null> {
  const cacheKey = `page:${tenantId}:${slug}:${lang}`

  try {
    const result = await fetchCMS<{ docs: Page[] }>(
      `/pages?where[tenant][equals]=${tenantId}&where[slug][equals]=${encodeURIComponent(slug)}&where[status][equals]=published&depth=2`,
    )
    const raw = result.docs[0] ?? null
    const page = raw ? normalizePage(raw) : null
    if (page) cache.set(cacheKey, page, CACHE_TTL.CONTENT)
    return page
  } catch {
    const stale = cache.getStale<Page>(cacheKey, CACHE_TTL.STALE_MAX)
    return stale?.data ?? null
  }
}

/**
 * Obtiene todos los posts publicados de un tenant.
 */
export async function getPosts(tenantId: string): Promise<Post[]> {
  const cacheKey = `posts:${tenantId}`

  try {
    const result = await fetchCMS<{ docs: Post[] }>(
      `/posts?where[tenant][equals]=${tenantId}&where[status][equals]=published&sort=-publishDate&limit=100`,
    )
    cache.set(cacheKey, result.docs, CACHE_TTL.CONTENT)
    return result.docs
  } catch {
    const stale = cache.getStale<Post[]>(cacheKey, CACHE_TTL.STALE_MAX)
    return stale?.data ?? []
  }
}

/**
 * Obtiene un post por slug.
 */
export async function getPost(tenantId: string, slug: string): Promise<Post | null> {
  const cacheKey = `post:${tenantId}:${slug}`

  try {
    const result = await fetchCMS<{ docs: Post[] }>(
      `/posts?where[tenant][equals]=${tenantId}&where[slug][equals]=${encodeURIComponent(slug)}&where[status][equals]=published`,
    )
    const post = result.docs[0] ?? null
    if (post) cache.set(cacheKey, post, CACHE_TTL.CONTENT)
    return post
  } catch {
    const stale = cache.getStale<Post>(cacheKey, CACHE_TTL.STALE_MAX)
    return stale?.data ?? null
  }
}

/**
 * Obtiene el menu de un tenant por ubicacion.
 */
export async function getMenu(tenantId: string, location: string): Promise<Menu | null> {
  const cacheKey = `menu:${tenantId}:${location}`

  try {
    const result = await fetchCMS<{ docs: Menu[] }>(
      `/menus?where[tenant][equals]=${tenantId}&where[location][equals]=${location}&depth=3`,
    )
    const menu = result.docs[0] ?? null
    if (menu) cache.set(cacheKey, menu, CACHE_TTL.CONTENT)
    return menu
  } catch {
    const stale = cache.getStale<Menu>(cacheKey, CACHE_TTL.STALE_MAX)
    return stale?.data ?? null
  }
}

/**
 * Obtiene los idiomas configurados de un tenant.
 */
export async function getTenantLanguages(tenantId: string): Promise<TenantLanguage[]> {
  const cacheKey = `languages:${tenantId}`

  try {
    const result = await fetchCMS<{ docs: TenantLanguage[] }>(
      `/tenant-languages?where[tenant][equals]=${tenantId}`,
    )
    cache.set(cacheKey, result.docs, CACHE_TTL.TENANT_RESOLUTION)
    return result.docs
  } catch {
    const stale = cache.getStale<TenantLanguage[]>(cacheKey, CACHE_TTL.STALE_MAX)
    return stale?.data ?? []
  }
}

/**
 * Obtiene todas las paginas publicadas de un tenant (para sitemap).
 */
export async function getAllPublishedPages(tenantId: string): Promise<Page[]> {
  const cacheKey = `all-pages:${tenantId}`

  try {
    const result = await fetchCMS<{ docs: Page[] }>(
      `/pages?where[tenant][equals]=${tenantId}&where[status][equals]=published&limit=1000`,
    )
    cache.set(cacheKey, result.docs, CACHE_TTL.SITEMAP)
    return result.docs
  } catch {
    const stale = cache.getStale<Page[]>(cacheKey, CACHE_TTL.STALE_MAX)
    return stale?.data ?? []
  }
}

/**
 * Invalida el cache de un tenant (llamado por el webhook).
 */
export function invalidateTenantCache(tenantId: string): void {
  cache.invalidateByPrefix(`page:${tenantId}`)
  cache.invalidateByPrefix(`posts:${tenantId}`)
  cache.invalidateByPrefix(`post:${tenantId}`)
  cache.invalidateByPrefix(`menu:${tenantId}`)
  cache.invalidateByPrefix(`all-pages:${tenantId}`)
  cache.invalidateByPrefix(`template:${tenantId}`)
}

function normalizePage(doc: Record<string, unknown>): Page {
  const tenantRef = doc['tenant']
  const tenantId =
    typeof tenantRef === 'object' && tenantRef !== null && 'id' in tenantRef
      ? String((tenantRef as { id: unknown }).id)
      : String(tenantRef ?? '')

  return {
    ...(doc as unknown as Page),
    tenantId,
    templateId: (doc['templateId'] as string | null | undefined) ?? null,
  }
}
