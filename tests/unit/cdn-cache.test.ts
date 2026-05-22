import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  bumpTenantCdnVersion,
  buildPageEtag,
  resetTenantCdnVersions,
  tryEarlyHtml304,
  withCdnHtmlCache,
  withCdnPublicAssetCache,
} from '../../src/lib/cdn-cache.js'

describe('cdn-cache', () => {
  beforeEach(() => {
    resetTenantCdnVersions()
    vi.stubEnv('CDN_HTML_CACHE_MODE', 'revalidate')
  })

  it('modo revalidate: no-cache y ETag por ruta', async () => {
    const res = withCdnHtmlCache(new Response('<html></html>', { status: 200 }), {
      hostname: 'cliente.example.com',
      tenantId: 't1',
      pathname: '/es/home',
    })

    expect(res.headers.get('Cache-Control')).toBe('public, no-cache, must-revalidate')
    expect(res.headers.get('Vary')).toContain('Host')
    expect(res.headers.get('ETag')).toBe('W/"t1-v0-cliente.example.com-/es/home"')
  })

  it('devuelve 304 si If-None-Match coincide', () => {
    const etag = buildPageEtag('a.com', 't1', '/es/')
    const res = withCdnHtmlCache(new Response('body', { status: 200 }), {
      hostname: 'a.com',
      tenantId: 't1',
      pathname: '/es/',
      ifNoneMatch: etag,
    })
    expect(res.status).toBe(304)
    expect(res.headers.get('ETag')).toBe(etag)
  })

  it('usa contentVersion explícito en ETag', () => {
    const etag = buildPageEtag('a.com', 't1', '/es/', 1710000000000)
    expect(etag).toBe('W/"t1-v1710000000000-a.com-/es/"')
    const res = withCdnHtmlCache(new Response('body', { status: 200 }), {
      hostname: 'a.com',
      tenantId: 't1',
      pathname: '/es/',
      contentVersion: 1710000000000,
      ifNoneMatch: etag,
    })
    expect(res.status).toBe(304)
  })

  it('tryEarlyHtml304 devuelve 304 cuando coincide', () => {
    const res = tryEarlyHtml304({
      hostname: 'a.com',
      tenantId: 't1',
      pathname: '/es/about',
      contentVersion: 42,
      ifNoneMatch: buildPageEtag('a.com', 't1', '/es/about', 42),
    })
    expect(res?.status).toBe(304)
  })

  it('cambia ETag al incrementar versión del tenant', () => {
    const first = buildPageEtag('a.com', 't1', '/es/')
    bumpTenantCdnVersion('t1')
    const second = buildPageEtag('a.com', 't1', '/es/')
    expect(first).not.toBe(second)
  })

  it('no cachea respuestas de error', () => {
    const res = withCdnHtmlCache(new Response('Not Found', { status: 404 }), {
      hostname: 'a.com',
      tenantId: 't1',
      pathname: '/es/',
    })
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('sitemap usa ETag con versión de tenant', () => {
    const res = withCdnPublicAssetCache(
      new Response('<urlset></urlset>', { status: 200, headers: { 'Content-Type': 'application/xml' } }),
      {
        hostname: 'a.com',
        tenantId: 't1',
        assetKind: 'sitemap',
        maxAgeSeconds: 600,
      },
    )
    expect(res.headers.get('ETag')).toBe('W/"t1-v0-sitemap-a.com"')
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=600, s-maxage=600')
  })

  it('modo edge-ttl usa s-maxage largo', () => {
    vi.stubEnv('CDN_HTML_CACHE_MODE', 'edge-ttl')
    vi.stubEnv('CDN_HTML_S_MAXAGE_SECONDS', '3600')
    const res = withCdnHtmlCache(new Response('', { status: 200 }), {
      hostname: 'a.com',
      tenantId: 't1',
      pathname: '/',
    })
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=3600')
  })
})
