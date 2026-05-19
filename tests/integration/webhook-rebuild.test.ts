import { describe, it, expect, beforeEach } from 'vitest'
import crypto from 'node:crypto'
import { POST } from '../../src/pages/api/webhooks/rebuild.js'
import { cache } from '../../src/lib/cache.js'

describe('POST /api/webhooks/rebuild', () => {
  beforeEach(() => {
    cache.invalidateByPrefix('page:')
    cache.invalidateByPrefix('template:')
  })

  it('invalida caché del tenant con firma válida', async () => {
    const tenantId = 'tenant-webhook-test'
    cache.set(`page:${tenantId}:inicio:es`, { id: '1' }, 300)
    cache.set(`template:${tenantId}:demo`, { html: '<html></html>', baseUrl: 'http://x' }, 300)

    const event = {
      event: 'content.published',
      tenantId,
      collection: 'pages',
      documentId: 'doc-1',
      timestamp: new Date().toISOString(),
    }
    const body = JSON.stringify(event)
    const signature = `sha256=${crypto.createHmac('sha256', 'dev-webhook-secret').update(body).digest('hex')}`

    const request = new Request('http://localhost/api/webhooks/rebuild', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature-256': signature,
      },
      body,
    })

    const response = await POST({ request } as Parameters<typeof POST>[0])
    expect(response.status).toBe(200)

    expect(cache.get(`page:${tenantId}:inicio:es`)).toBeNull()
    expect(cache.get(`template:${tenantId}:demo`)).toBeNull()
  })

  it('invalida prefijo template al cambiar html-templates', async () => {
    const tenantId = 'tenant-tpl'
    cache.set(`template:${tenantId}:store`, { html: '<html></html>', baseUrl: 'http://x' }, 300)

    const event = {
      event: 'content.updated',
      tenantId,
      collection: 'html-templates',
      documentId: 'tpl-1',
      timestamp: new Date().toISOString(),
    }
    const body = JSON.stringify(event)

    const request = new Request('http://localhost/api/webhooks/rebuild', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    await POST({ request } as Parameters<typeof POST>[0])
    expect(cache.get(`template:${tenantId}:store`)).toBeNull()
  })
})
