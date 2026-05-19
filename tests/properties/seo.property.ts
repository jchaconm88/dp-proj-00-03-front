import { describe, it } from 'vitest'
import fc from 'fast-check'
import { generateMetaTags, generateSitemap, generateRobotsTxt, generateSchemaOrg } from '../../src/lib/seo.js'
import type { Page, Post, Tenant } from '../../src/types/api.js'

/**
 * Property tests para SEO.
 * Feature: multi-tenant-web-platform
 * Properties 12, 13, 14, 15, 16
 */

const mockTenant: Tenant = {
  id: 'test-tenant-id',
  name: 'Test Tenant',
  defaultLanguage: 'es',
  timezone: 'UTC',
  isActive: true,
  settings: {
    contactEmail: 'test@test.com',
    maxStorageBytes: 5 * 1024 * 1024 * 1024,
    currentStorageBytes: 0,
    captchaEnabled: true,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const buildPage = (overrides: Partial<Page> = {}): Page => ({
  id: 'page-id',
  tenantId: 'test-tenant-id',
  slug: 'test-page',
  status: 'published',
  pageType: 'static',
  publishDate: new Date().toISOString(),
  scheduledDate: null,
  hasSchemaOrg: false,
  seoConfig: { metaTitle: null, metaDescription: null, canonicalUrl: null, ogImage: null },
  translations: [
    {
      id: 'trans-id',
      pageId: 'page-id',
      languageCode: 'es',
      title: 'Página de prueba',
      content: '<p>Contenido de ejemplo para probar el generador SEO de la plataforma multi-tenant.</p>',
      metaTitle: null,
      metaDescription: null,
      canonicalUrl: null,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

describe('Feature: multi-tenant-web-platform, Property 12: Validación de Configuración SEO', () => {
  it('genera title de máximo 70 caracteres', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }),
        (randomTitle) => {
          const page = buildPage({
            seoConfig: { metaTitle: randomTitle, metaDescription: null, canonicalUrl: null, ogImage: null },
          })
          const translation = page.translations[0]!

          const meta = generateMetaTags({
            page,
            translation,
            tenant: mockTenant,
            hostname: 'example.com',
            language: 'es',
            slug: 'test-page',
          })

          return meta.title.length <= 70
        },
      ),
      { numRuns: 100 },
    )
  })

  it('genera description de máximo 160 caracteres', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 400 }),
        (randomDesc) => {
          const page = buildPage({
            seoConfig: { metaTitle: null, metaDescription: randomDesc, canonicalUrl: null, ogImage: null },
          })
          const translation = page.translations[0]!

          const meta = generateMetaTags({
            page,
            translation,
            tenant: mockTenant,
            hostname: 'example.com',
            language: 'es',
            slug: 'test-page',
          })

          return meta.description.length <= 160
        },
      ),
      { numRuns: 100 },
    )
  })

  it('genera title fallback si no esta configurado', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (pageTitle) => {
          const page = buildPage()
          const translation = { ...page.translations[0]!, title: pageTitle }

          const meta = generateMetaTags({
            page,
            translation,
            tenant: mockTenant,
            hostname: 'example.com',
            language: 'es',
            slug: 'test-page',
          })

          return meta.title.length > 0 && meta.title.includes(pageTitle.slice(0, 10))
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('Feature: multi-tenant-web-platform, Property 13: Completitud de Open Graph', () => {
  it('todas las paginas tienen og:title, og:description, og:url con valores no vacios', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        (title, content) => {
          const page = buildPage()
          const translation = { ...page.translations[0]!, title, content }

          const meta = generateMetaTags({
            page,
            translation,
            tenant: mockTenant,
            hostname: 'example.com',
            language: 'es',
            slug: 'test',
          })

          return (
            meta.ogTitle.length > 0 &&
            meta.ogDescription.length > 0 &&
            meta.ogUrl.length > 0
          )
        },
      ),
      { numRuns: 100 },
    )
  })
})

/** Comprueba presencia de slug solo en entradas <loc>, no como subcadena del XML. */
function sitemapHasPageUrl(sitemap: string, hostname: string, lang: string, slug: string): boolean {
  return sitemap.includes(`<loc>https://${hostname}/${lang}/${slug}</loc>`)
}

describe('Feature: multi-tenant-web-platform, Property 14: Consistencia de Sitemap', () => {
  it('sitemap contiene solo URLs de contenido published', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            slug: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9-]+$/.test(s)),
            status: fc.constantFrom('published', 'draft', 'scheduled') as fc.Arbitrary<'published' | 'draft' | 'scheduled'>,
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (pageData) => {
          const hostname = 'example.com'
          const lang = 'es'
          const pages: Page[] = pageData.map((d, idx) => buildPage({
            id: `page-${idx}`,
            slug: d.slug,
            status: d.status,
          }))

          const sitemap = generateSitemap({
            hostname,
            pages,
            posts: [],
            availableLanguages: [lang],
          })

          // El sitemap indexa por slug: un slug aparece si existe al menos una página published.
          const uniqueSlugs = [...new Set(pageData.map((d) => d.slug))]

          return uniqueSlugs.every((slug) => {
            const shouldInclude = pageData.some(
              (d) => d.slug === slug && d.status === 'published',
            )
            const isIncluded = sitemapHasPageUrl(sitemap, hostname, lang, slug)
            return shouldInclude === isIncluded
          })
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('Feature: multi-tenant-web-platform, Property 15: Robots.txt con Referencia a Sitemap', () => {
  it('robots.txt contiene directiva Sitemap apuntando al dominio', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 50 })
          .filter((s) => /^[a-z0-9.-]+$/.test(s) && s.includes('.')),
        (hostname) => {
          const robotsTxt = generateRobotsTxt(hostname)
          return (
            robotsTxt.includes(`Sitemap: https://${hostname}/sitemap.xml`) &&
            robotsTxt.includes('User-agent: *')
          )
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('Feature: multi-tenant-web-platform, Property 16: Schema.org en Contenido Elegible', () => {
  it('posts generan JSON-LD con tipo BlogPosting', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (title) => {
          const post: Post = {
            id: 'post-id',
            tenantId: 'test-tenant-id',
            slug: 'test-post',
            status: 'published',
            publishDate: new Date().toISOString(),
            scheduledDate: null,
            seoConfig: { metaTitle: null, metaDescription: null, canonicalUrl: null, ogImage: null },
            translations: [{ id: 't', postId: 'post-id', languageCode: 'es', title, content: '<p>Test</p>', excerpt: '', metaTitle: null, metaDescription: null }],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }

          const schema = generateSchemaOrg({
            page: post,
            translation: post.translations[0]!,
            tenant: mockTenant,
            hostname: 'example.com',
            canonicalUrl: 'https://example.com/es/blog/test-post',
            type: 'post',
          })

          return (
            schema !== null &&
            typeof schema === 'object' &&
            (schema as { '@type': string })['@type'] === 'BlogPosting'
          )
        },
      ),
      { numRuns: 100 },
    )
  })

  it('paginas sin hasSchemaOrg no generan JSON-LD', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (hasSchemaOrg) => {
          const page = buildPage({ hasSchemaOrg })

          const schema = generateSchemaOrg({
            page,
            translation: page.translations[0]!,
            tenant: mockTenant,
            hostname: 'example.com',
            canonicalUrl: 'https://example.com/es/test',
            type: 'page',
          })

          if (hasSchemaOrg) return schema !== null
          return schema === null
        },
      ),
      { numRuns: 100 },
    )
  })
})
