import type { Tenant, Page, Post, SEOConfig, TenantLanguage } from '../types/api.js'
import type { MetaTags, HreflangEntry, SitemapEntry } from '../types/index.js'
import { richTextToPlainText } from './rich-text.js'

const MAX_META_TITLE_LENGTH = 70
const MAX_META_DESCRIPTION_LENGTH = 160

/**
 * Genera las meta tags SEO para una pagina.
 * Requisito 5.1, 5.7 — Properties 12, 13
 *
 * - Si no hay metaTitle: usa el titulo de la traduccion
 * - Si no hay metaDescription: usa los primeros 160 chars del contenido
 */
export function generateMetaTags(params: {
  page: Page | Post
  translation: { title: string; content: unknown; metaTitle?: string | null; metaDescription?: string | null; canonicalUrl?: string | null }
  tenant: Tenant
  hostname: string
  language: string
  slug: string
}): MetaTags {
  const { page, translation, tenant, hostname, language, slug } = params

  // Title fallback — Req 5.7
  const title = translation.metaTitle?.slice(0, MAX_META_TITLE_LENGTH) ??
    `${translation.title} — ${tenant.name}`.slice(0, MAX_META_TITLE_LENGTH)

  // Description fallback — Req 5.7
  const description = translation.metaDescription?.slice(0, MAX_META_DESCRIPTION_LENGTH) ??
    richTextToPlainText(translation.content).slice(0, MAX_META_DESCRIPTION_LENGTH)

  const canonicalUrl = translation.canonicalUrl ??
    page.seoConfig.canonicalUrl ??
    `https://${hostname}/${language}/${slug}`

  const ogImage = page.seoConfig.ogImage ?? null

  return {
    title,
    description,
    canonicalUrl,
    ogTitle: title, // Open Graph — Req 5.2, Property 13
    ogDescription: description,
    ogImage,
    ogUrl: canonicalUrl,
  }
}

/**
 * Genera etiquetas hreflang para soporte multi-idioma.
 * Requisito 7.3 — Property 20
 *
 * - Una etiqueta por cada idioma disponible (autorreferencial incluida)
 * - Una etiqueta x-default apuntando al idioma principal
 */
export function generateHreflangTags(params: {
  hostname: string
  slug: string
  availableLanguages: string[]
  primaryLanguage: string
  currentLanguage: string
}): HreflangEntry[] {
  const { hostname, slug, availableLanguages, primaryLanguage } = params

  const entries: HreflangEntry[] = availableLanguages.map((lang) => ({
    lang,
    url: `https://${hostname}/${lang}/${slug}`,
  }))

  // x-default apunta al idioma principal — Req 7.3
  entries.push({
    lang: 'x-default',
    url: `https://${hostname}/${primaryLanguage}/${slug}`,
  })

  return entries
}

/**
 * Genera datos estructurados Schema.org para posts y paginas marcadas.
 * Requisito 5.5 — Property 16
 */
export function generateSchemaOrg(params: {
  page: Page | Post
  translation: { title: string; content: unknown }
  tenant: Tenant
  hostname: string
  canonicalUrl: string
  type: 'page' | 'post'
}): object | null {
  const { page, translation, tenant, hostname, canonicalUrl, type } = params

  // Solo para posts o paginas con hasSchemaOrg=true — Req 5.5
  const shouldGenerate =
    type === 'post' || ('hasSchemaOrg' in page && page.hasSchemaOrg)

  if (!shouldGenerate) return null

  if (type === 'post') {
    return {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: translation.title.slice(0, 110),
      description: richTextToPlainText(translation.content).slice(0, 200),
      url: canonicalUrl,
      publisher: {
        '@type': 'Organization',
        name: tenant.name,
        url: `https://${hostname}`,
      },
      datePublished: ('publishDate' in page ? page.publishDate : null) ?? new Date().toISOString(),
    }
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: translation.title,
    description: richTextToPlainText(translation.content).slice(0, 200),
    url: canonicalUrl,
    publisher: {
      '@type': 'Organization',
      name: tenant.name,
      url: `https://${hostname}`,
    },
  }
}

/**
 * Genera el sitemap XML de un tenant.
 * Requisito 5.3, 5.4 — Property 14: solo URLs de contenido published
 */
export function generateSitemap(params: {
  hostname: string
  pages: Page[]
  posts: Post[]
  availableLanguages: string[]
}): string {
  const { hostname, pages, posts, availableLanguages } = params

  const entries: SitemapEntry[] = []

  // Solo contenido published — Property 14
  for (const page of pages.filter((p) => p.status === 'published')) {
    for (const lang of availableLanguages) {
      entries.push({
        url: `https://${hostname}/${lang}/${page.slug}`,
        lastmod: page.updatedAt.split('T')[0] ?? new Date().toISOString().split('T')[0] ?? '',
        changefreq: 'weekly',
        priority: page.pageType === 'landing' ? 1.0 : 0.8,
      })
    }
  }

  for (const post of posts.filter((p) => p.status === 'published')) {
    for (const lang of availableLanguages) {
      entries.push({
        url: `https://${hostname}/${lang}/blog/${post.slug}`,
        lastmod: post.updatedAt.split('T')[0] ?? new Date().toISOString().split('T')[0] ?? '',
        changefreq: 'monthly',
        priority: 0.6,
      })
    }
  }

  const urlsXml = entries
    .map(
      (entry) => `  <url>
    <loc>${escapeXml(entry.url)}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority.toFixed(1)}</priority>
  </url>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>`
}

/**
 * Genera el robots.txt para un dominio.
 * Requisito 5.4 — Property 15
 */
export function generateRobotsTxt(hostname: string): string {
  return `User-agent: *
Allow: /

Sitemap: https://${hostname}/sitemap.xml
`
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
