// Genera sitemap.xml por dominio — Req 5.3, Property 14
export const prerender = false

import type { APIRoute } from 'astro'
import { getAllPublishedPages, getPosts } from '../lib/cms-client.js'
import { generateSitemap } from '../lib/seo.js'
import { cache, CACHE_TTL } from '../lib/cache.js'

export const GET: APIRoute = async ({ locals }) => {
  const { tenant, hostname, availableLanguages } = locals

  const cacheKey = `sitemap:${hostname}`
  const cached = cache.get<string>(cacheKey)
  if (cached) {
    return new Response(cached.data, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=600, s-maxage=600', // 10 min
      },
    })
  }

  const [pages, posts] = await Promise.all([
    getAllPublishedPages(tenant.id),
    getPosts(tenant.id),
  ])

  const sitemap = generateSitemap({ hostname, pages, posts, availableLanguages })
  cache.set(cacheKey, sitemap, CACHE_TTL.SITEMAP)

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=600, s-maxage=600',
    },
  })
}
