import { describe, it, expect, beforeEach } from 'vitest'
import {
  bumpTenantCdnVersion,
  CDN_HTML_S_MAXAGE,
  resetTenantCdnVersions,
  withCdnHtmlCache,
  withCdnPublicAssetCache,
} from '../../src/lib/cdn-cache.js'

describe('cdn-cache', () => {
  beforeEach(() => {
    resetTenantCdnVersions()
  })

  it('añade Cache-Control y Vary en HTML 200', async () => {
    const res = withCdnHtmlCache(new Response('<html></html>', { status: 200 }), {
      hostname: 'cliente.example.com',
      tenantId: 't1',
    })

    expect(res.headers.get('Cache-Control')).toContain(`s-maxage=${CDN_HTML_S_MAXAGE}`)
    expect(res.headers.get('Vary')).toContain('Host')
    expect(res.headers.get('ETag')).toBe('W/"t1-v0-cliente.example.com"')
  })

  it('cambia ETag al incrementar versión del tenant', () => {
    const base = new Response('', { status: 200 })
    const first = withCdnHtmlCache(base, {
      hostname: 'a.com',
      tenantId: 't1',
    })
    bumpTenantCdnVersion('t1')
    const second = withCdnHtmlCache(new Response('', { status: 200 }), {
      hostname: 'a.com',
      tenantId: 't1',
    })
    expect(first.headers.get('ETag')).not.toBe(second.headers.get('ETag'))
  })

  it('no cachea respuestas de error', () => {
    const res = withCdnHtmlCache(new Response('Not Found', { status: 404 }), {
      hostname: 'a.com',
      tenantId: 't1',
    })
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('cachea XML con s-maxage configurado', () => {
    const res = withCdnPublicAssetCache(
      new Response('<urlset></urlset>', { status: 200, headers: { 'Content-Type': 'application/xml' } }),
      { hostname: 'a.com', maxAgeSeconds: 600 },
    )
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=600, s-maxage=600')
    expect(res.headers.get('Vary')).toContain('X-Forwarded-Host')
  })
})
