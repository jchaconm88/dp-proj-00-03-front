import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cache } from '../../src/lib/cache.js'

vi.mock('../../src/lib/cms-url.js', () => ({
  getCmsUrl: () => 'http://cms.test',
}))

describe('resolveMediaInTemplateData', () => {
  beforeEach(() => {
    cache.invalidateByPrefix('media:doc:')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('inyecta imageSrcset al resolver mediaId', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          url: '/media/x.webp',
          sizes: {
            small: { url: '/media/x-small.webp', width: 400 },
            medium: { url: '/media/x-medium.webp', width: 800 },
            large: { url: '/media/x-large.webp', width: 1600 },
          },
        }),
      }),
    )

    const { resolveMediaInTemplateData } = await import('../../src/lib/template-media.js')
    const result = await resolveMediaInTemplateData({
      hero: { image: { mediaId: '42' } },
    })

    const block = result.hero?.['image'] as Record<string, unknown>
    expect(block['imageUrl']).toBe('http://cms.test/media/x-medium.webp')
    expect(String(block['imageSrcset'])).toContain('800w')
  })
})

describe('buildMediaImageProps', () => {
  it('construye srcset desde sizes de Payload', async () => {
    const { buildMediaImageProps } = await import('../../src/lib/media-image-props.js')
    const props = buildMediaImageProps(
      {
        url: '/media/photo.webp',
        alt: 'Hero',
        sizes: {
          small: { url: '/media/photo-small.webp', width: 400, height: 200 },
          medium: { url: '/media/photo-medium.webp', width: 800, height: 400 },
          large: { url: '/media/photo-large.webp', width: 1600, height: 800 },
        },
      },
      'http://cms.test',
    )
    expect(props?.imageUrl).toBe('http://cms.test/media/photo-medium.webp')
    expect(props?.imageSrcset).toContain('400w')
    expect(props?.imageSrcset).toContain('800w')
    expect(props?.imageWidth).toBe(800)
    expect(props?.imageAlt).toBe('Hero')
  })
})
