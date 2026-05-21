/**
 * Cabeceras de caché para Firebase Hosting CDN (req. 14.4, 15.2).
 * Multi-tenant: Vary por host para no mezclar HTML entre dominios.
 */

const tenantVersions = new Map<string, number>()

/** s-maxage ≤ 2 min (req. 15.2); SWR hasta 24h (req. 15.4) */
export const CDN_HTML_S_MAXAGE = 120
export const CDN_HTML_STALE_WHILE_REVALIDATE = 24 * 60 * 60

export const CDN_XML_S_MAXAGE = 600

const VARY_HOST = 'Host, X-Forwarded-Host, Accept-Encoding'

export function bumpTenantCdnVersion(tenantId: string): number {
  const next = (tenantVersions.get(tenantId) ?? 0) + 1
  tenantVersions.set(tenantId, next)
  return next
}

export function getTenantCdnVersion(tenantId: string): number {
  return tenantVersions.get(tenantId) ?? 0
}

/** Reinicia versiones (tests). */
export function resetTenantCdnVersions(): void {
  tenantVersions.clear()
}

export function isCdnManagedPath(pathname: string): boolean {
  if (pathname === '/favicon.ico') return false
  if (pathname.startsWith('/api/')) return false
  if (pathname.startsWith('/_astro')) return false
  return true
}

function buildEtag(hostname: string, tenantId: string): string {
  const version = getTenantCdnVersion(tenantId)
  return `W/"${tenantId}-v${version}-${hostname}"`
}

function cloneWithHeaders(response: Response, mutate: (headers: Headers) => void): Response {
  const headers = new Headers(response.headers)
  mutate(headers)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * HTML de páginas: cacheable en CDN solo en 200, con variación por host.
 */
export function withCdnHtmlCache(
  response: Response,
  options: { hostname: string | null; tenantId?: string },
): Response {
  const { hostname, tenantId } = options

  if (response.status !== 200) {
    return cloneWithHeaders(response, (h) => {
      h.set('Cache-Control', 'no-store')
      h.set('Vary', VARY_HOST)
    })
  }

  if (!hostname || !tenantId) {
    return cloneWithHeaders(response, (h) => {
      h.set('Cache-Control', 'no-store')
    })
  }

  return cloneWithHeaders(response, (h) => {
    h.set(
      'Cache-Control',
      `public, s-maxage=${CDN_HTML_S_MAXAGE}, stale-while-revalidate=${CDN_HTML_STALE_WHILE_REVALIDATE}`,
    )
    h.set('Vary', VARY_HOST)
    h.set('ETag', buildEtag(hostname, tenantId))
  })
}

/**
 * XML (sitemap) y texto (robots): cache CDN con Vary por host.
 */
export function withCdnPublicAssetCache(
  response: Response,
  options: { hostname: string | null; maxAgeSeconds: number },
): Response {
  if (response.status !== 200) {
    return cloneWithHeaders(response, (h) => {
      h.set('Cache-Control', 'no-store')
    })
  }

  const { hostname, maxAgeSeconds } = options
  const etag =
    hostname != null ? `W/"${hostname}-asset-${maxAgeSeconds}"` : undefined

  return cloneWithHeaders(response, (h) => {
    h.set('Cache-Control', `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}`)
    h.set('Vary', VARY_HOST)
    if (etag) h.set('ETag', etag)
  })
}
