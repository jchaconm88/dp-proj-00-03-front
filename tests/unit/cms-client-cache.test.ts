import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { cache } from '../../src/lib/cache.js'
import { getPage, invalidateTenantCache } from '../../src/lib/cms-client.js'

describe('cms-client content cache', () => {
  const tenantId = 'tenant-1'
  const slug = 'home'
  const lang = 'es'

  beforeEach(() => {
    invalidateTenantCache(tenantId)
    vi.stubEnv('CMS_URL', 'http://cms.test')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    invalidateTenantCache(tenantId)
  })

  it('devuelve página cacheada sin segunda llamada al CMS', async () => {
    const page = {
      id: '1',
      slug,
      tenantId,
      status: 'published',
      translations: [{ languageCode: lang, title: 'Home', templateData: null }],
      templateId: null,
    }

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ docs: [page] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const first = await getPage(tenantId, slug, lang)
    const second = await getPage(tenantId, slug, lang)

    expect(first?.slug).toBe(slug)
    expect(second?.slug).toBe(slug)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(cache.get(`page:${tenantId}:${slug}:${lang}`)?.data).toMatchObject({ slug })
  })

  it('invalidateTenantCache borra entradas de páginas del tenant', async () => {
    cache.set(`page:${tenantId}:${slug}:${lang}`, { slug }, 60)
    invalidateTenantCache(tenantId)
    expect(cache.get(`page:${tenantId}:${slug}:${lang}`)).toBeNull()
  })
})
