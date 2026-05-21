/**
 * Cabeceras de caché para Firebase Hosting CDN (req. 14.4, 15.2).
 * Multi-tenant: Vary por host. Invalidación por versión de tenant (webhook / manual), no por TTL corto.
 */

const tenantVersions = new Map<string, number>()

/**
 * revalidate (defecto): CDN guarda HTML pero valida con ETag en cada petición;
 *   al publicar (bump de versión) la siguiente visita recibe contenido nuevo.
 * edge-ttl: CDN sirve sin revalidar hasta CDN_HTML_S_MAXAGE_SECONDS (más barato en origen;
 *   tras publicar puede tardar hasta ese TTL en reflejarse en borde).
 */
export type CdnHtmlCacheMode = 'revalidate' | 'edge-ttl'

export function getCdnHtmlCacheMode(): CdnHtmlCacheMode {
  const raw = (import.meta.env.CDN_HTML_CACHE_MODE ?? 'revalidate').toLowerCase()
  return raw === 'edge-ttl' ? 'edge-ttl' : 'revalidate'
}

/** Solo en modo edge-ttl; por defecto 24 h */
export function getCdnHtmlSMaxAge(): number {
  const n = Number(import.meta.env.CDN_HTML_S_MAXAGE_SECONDS ?? 86400)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 86400
}

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

export function resetTenantCdnVersions(): void {
  tenantVersions.clear()
}

export function isCdnManagedPath(pathname: string): boolean {
  if (pathname === '/favicon.ico') return false
  if (pathname.startsWith('/api/')) return false
  if (pathname.startsWith('/_astro')) return false
  return true
}

/** ETag por tenant + ruta; al publicar sube la versión y cambia en todas las URLs del tenant. */
export function buildPageEtag(
  hostname: string,
  tenantId: string,
  pathname: string,
): string {
  const version = getTenantCdnVersion(tenantId)
  const path = pathname || '/'
  return `W/"${tenantId}-v${version}-${hostname}-${path}"`
}

export function buildAssetEtag(hostname: string, tenantId: string, assetKind: string): string {
  const version = getTenantCdnVersion(tenantId)
  return `W/"${tenantId}-v${version}-${assetKind}-${hostname}"`
}

function etagMatches(ifNoneMatch: string, etag: string): boolean {
  const candidates = ifNoneMatch.split(',').map((s) => s.trim())
  return candidates.some((c) => c === etag || c === etag.replace(/^W\//, ''))
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

function htmlCacheControl(): string {
  if (getCdnHtmlCacheMode() === 'edge-ttl') {
    const max = getCdnHtmlSMaxAge()
    return `public, s-maxage=${max}, max-age=${max}, stale-while-revalidate=${CDN_HTML_STALE_WHILE_REVALIDATE}`
  }
  return 'public, no-cache, must-revalidate'
}

export type CdnHtmlCacheOptions = {
  hostname: string | null
  tenantId?: string
  pathname: string
  ifNoneMatch?: string | null
}

/**
 * HTML 200: cache CDN con invalidación por versión de tenant (webhook / POST rebuild).
 */
export function withCdnHtmlCache(response: Response, options: CdnHtmlCacheOptions): Response {
  const { hostname, tenantId, pathname, ifNoneMatch } = options

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

  const etag = buildPageEtag(hostname, tenantId, pathname)

  if (ifNoneMatch && etagMatches(ifNoneMatch, etag)) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        Vary: VARY_HOST,
        'Cache-Control': htmlCacheControl(),
      },
    })
  }

  return cloneWithHeaders(response, (h) => {
    h.set('Cache-Control', htmlCacheControl())
    h.set('Vary', VARY_HOST)
    h.set('ETag', etag)
  })
}

export type CdnPublicAssetCacheOptions = {
  hostname: string | null
  tenantId?: string
  assetKind: string
  maxAgeSeconds: number
  ifNoneMatch?: string | null
}

/**
 * Sitemap / robots: TTL largo; ETag con versión de tenant para invalidar al publicar.
 */
export function withCdnPublicAssetCache(
  response: Response,
  options: CdnPublicAssetCacheOptions,
): Response {
  if (response.status !== 200) {
    return cloneWithHeaders(response, (h) => {
      h.set('Cache-Control', 'no-store')
    })
  }

  const { hostname, tenantId, assetKind, maxAgeSeconds, ifNoneMatch } = options
  const etag =
    hostname && tenantId
      ? buildAssetEtag(hostname, tenantId, assetKind)
      : hostname != null
        ? `W/"${hostname}-asset-${assetKind}"`
        : undefined

  if (etag && ifNoneMatch && etagMatches(ifNoneMatch, etag)) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        Vary: VARY_HOST,
        'Cache-Control': `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}`,
      },
    })
  }

  return cloneWithHeaders(response, (h) => {
    h.set('Cache-Control', `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}`)
    h.set('Vary', VARY_HOST)
    if (etag) h.set('ETag', etag)
  })
}
