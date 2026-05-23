import { describe, it, expect } from 'vitest'
import { optimizeImagesInHtml } from '../../src/lib/optimize-html-images.js'
import { deriveSrcsetFromSrc } from '../../src/lib/media-image-props.js'

describe('deriveSrcsetFromSrc', () => {
  it('deriva small/medium/large desde URL medium', () => {
    const src = 'https://cdn.example.com/photo-medium.webp'
    const srcset = deriveSrcsetFromSrc(src)
    expect(srcset).toContain('photo-small.webp 400w')
    expect(srcset).toContain('photo-medium.webp 800w')
    expect(srcset).toContain('photo-large.webp 1600w')
  })
})

describe('optimizeImagesInHtml', () => {
  it('marca la primera imagen como LCP con fetchpriority high', () => {
    const html =
      '<img src="https://x.com/a-medium.webp" alt="hero" />' +
      '<img src="https://x.com/b-medium.webp" alt="card" />'
    const out = optimizeImagesInHtml(html)
    expect(out).toMatch(/fetchpriority="high"/)
    expect(out.indexOf('fetchpriority="high"')).toBeLessThan(out.indexOf('loading="lazy"'))
  })

  it('usa ds-hero__img como LCP aunque no sea la primera', () => {
    const html =
      '<img src="https://x.com/logo.svg" alt="logo" />' +
      '<img class="ds-hero__img" src="https://x.com/hero-medium.webp" alt="hero" />'
    const out = optimizeImagesInHtml(html)
    expect(out).toContain('class="ds-hero__img"')
    expect(out).toMatch(/ds-hero__img[^>]*fetchpriority="high"/)
  })

  it('añade lazy a imágenes below-fold', () => {
    const html = '<img src="https://x.com/a-medium.webp" /><img src="https://x.com/b-medium.webp" />'
    const out = optimizeImagesInHtml(html)
    const lazyCount = (out.match(/loading="lazy"/g) ?? []).length
    expect(lazyCount).toBe(1)
  })

  it('respeta srcset existente', () => {
    const html =
      '<img src="https://x.com/a.webp" srcset="https://x.com/a.webp 800w" alt="x" />'
    const out = optimizeImagesInHtml(html)
    expect(out).toContain('srcset="https://x.com/a.webp 800w"')
    expect(out).not.toContain('srcset="https://x.com/a-small.webp')
  })

  it('no lazy en SVG', () => {
    const html = '<img src="/assets/logo.svg" alt="logo" />'
    const out = optimizeImagesInHtml(html)
    expect(out).not.toContain('loading="lazy"')
  })
})
