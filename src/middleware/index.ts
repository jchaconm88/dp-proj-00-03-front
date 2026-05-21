import { defineMiddleware, sequence } from 'astro:middleware'
import { resolveTenantByHostname } from '../lib/cms-client.js'
import { getTenantLanguages } from '../lib/cms-client.js'
import {
  CDN_XML_S_MAXAGE,
  isCdnManagedPath,
  withCdnHtmlCache,
  withCdnPublicAssetCache,
} from '../lib/cdn-cache.js'
import { getRequestHostname } from '../lib/request-hostname.js'

/**
 * Middleware de resolución de tenant por hostname.
 * Requisito 2.2, 1.3, 15.3, 15.6 — Property 7
 *
 * - Extrae el hostname (x-forwarded-host en Firebase Hosting, Host en local)
 * - Consulta la API del CMS para resolver el tenant activo
 * - Retorna 404 para dominios no registrados (sin exponer info de otros tenants)
 * - Retorna 503 para tenants desactivados
 */
const tenantResolver = defineMiddleware(async (context, next) => {
  const hostname = getRequestHostname(context.request)

  // Rutas internas no requieren resolución de tenant
  const isInternalRoute =
    context.url.pathname === '/api/health' ||
    context.url.pathname.startsWith('/api/webhooks') ||
    context.url.pathname.startsWith('/_astro') ||
    context.url.pathname === '/favicon.ico'

  if (isInternalRoute) {
    return next()
  }

  // Corregir /es/es/... (redirect 301 antiguo en caché del navegador)
  const duplicateLang = context.url.pathname.match(/^\/([a-z]{2})\/\1(\/.*)?$/)
  if (duplicateLang) {
    const fixedPath = `/${duplicateLang[1]}${duplicateLang[2] ?? ''}`
    return context.redirect(fixedPath, 301)
  }

  if (!hostname) {
    return new Response('Not Found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  const resolution = await resolveTenantByHostname(hostname)

  if (!resolution.ok) {
    if (resolution.reason === 'unavailable') {
      return new Response('Service Temporarily Unavailable', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '30' },
      })
    }
    return new Response('Not Found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  const tenant = resolution.tenant

  if (!tenant.isActive) {
    return new Response('Site Temporarily Unavailable', {
      status: 503,
      headers: { 'Retry-After': '300' },
    })
  }

  if (context.url.pathname === '/' || context.url.pathname === '') {
    const lang = tenant.defaultLanguage?.trim().toLowerCase() || 'es'
    return context.redirect(`/${lang}/`, 302)
  }

  // Obtener idiomas configurados del tenant
  const languages = await getTenantLanguages(tenant.id)
  const primaryLanguage = (
    languages.find((l) => l.isPrimary)?.languageCode ?? tenant.defaultLanguage
  )
    .trim()
    .toLowerCase()
  const availableLanguages =
    languages.length > 0
      ? languages.map((l) => l.languageCode.trim().toLowerCase())
      : [primaryLanguage]

  // Exponer tenant en locals para las páginas
  context.locals.tenant = tenant
  context.locals.hostname = hostname
  context.locals.primaryLanguage = primaryLanguage
  context.locals.availableLanguages = availableLanguages

  return next()
})

/**
 * Cabeceras Cache-Control / Vary / ETag para Firebase CDN (req. 14.4).
 * HTML y sitemap/robots cacheables por host; APIs y errores sin store.
 */
const cdnCacheHeaders = defineMiddleware(async (context, next) => {
  const response = await next()

  if (!isCdnManagedPath(context.url.pathname)) {
    return response
  }

  if (response.status !== 200) {
    return withCdnHtmlCache(
      new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      }),
      { hostname: null, tenantId: undefined },
    )
  }

  const hostname = getRequestHostname(context.request)
  const tenantId = context.locals.tenant?.id
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('text/html')) {
    return withCdnHtmlCache(response, { hostname, tenantId })
  }

  if (contentType.includes('application/xml')) {
    return withCdnPublicAssetCache(response, {
      hostname,
      maxAgeSeconds: CDN_XML_S_MAXAGE,
    })
  }

  if (contentType.includes('text/plain') && context.url.pathname === '/robots.txt') {
    return withCdnPublicAssetCache(response, {
      hostname,
      maxAgeSeconds: 86400,
    })
  }

  return response
})

export const onRequest = sequence(tenantResolver, cdnCacheHeaders)

// Extender tipos de Astro locals
declare global {
  namespace App {
    interface Locals {
      tenant: import('../types/api.js').Tenant
      hostname: string
      primaryLanguage: string
      availableLanguages: string[]
    }
  }
}
