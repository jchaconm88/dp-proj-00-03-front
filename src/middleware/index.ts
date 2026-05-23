import { defineMiddleware, sequence } from 'astro:middleware'
import { resolveTenantByHostname } from '../lib/cms-client.js'
import { getTenantLanguages } from '../lib/cms-client.js'
import {
  CDN_XML_S_MAXAGE,
  isCdnManagedPath,
  tryEarlyHtml304,
  withCdnHtmlCache,
  withCdnPublicAssetCache,
} from '../lib/cdn-cache.js'
import { getPublishedContentVersion } from '../lib/content-version-store.js'
import { getHomePageSlug } from '../lib/home-page.js'
import {
  fallbackLanguagesFromPath,
  resolveContentRoute,
} from '../lib/resolve-content-route.js'
import { getRequestHostname } from '../lib/request-hostname.js'

/**
 * Resolución de tenant por hostname (sin idiomas del CMS).
 * Requisito 2.2, 1.3, 15.3, 15.6 — Property 7
 */
const tenantCore = defineMiddleware(async (context, next) => {
  const hostname = getRequestHostname(context.request)

  const isInternalRoute =
    context.url.pathname === '/api/health' ||
    context.url.pathname.startsWith('/api/webhooks') ||
    context.url.pathname.startsWith('/_astro') ||
    context.url.pathname === '/favicon.ico'

  if (isInternalRoute) {
    return next()
  }

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

  context.locals.tenant = tenant
  context.locals.hostname = hostname

  return next()
})

/**
 * 304 temprano con versión en BD: evita SSR y llamadas al CMS si If-None-Match coincide.
 * Usa idiomas inferidos del path (sin getTenantLanguages) para no bloquear el 304.
 */
const earlyDbRevalidate = defineMiddleware(async (context, next) => {
  const { request, url, locals } = context
  const pathname = url.pathname

  if (request.method !== 'GET') return next()
  if (!isCdnManagedPath(pathname)) return next()

  const accept = request.headers.get('accept') ?? ''
  if (!accept.includes('text/html')) return next()

  const tenant = locals.tenant
  const hostname = locals.hostname
  if (!tenant || !hostname) return next()

  const availableLanguages =
    locals.availableLanguages ??
    fallbackLanguagesFromPath(tenant.defaultLanguage, pathname)

  const contentRoute = resolveContentRoute(pathname, {
    availableLanguages,
    homePageSlug: getHomePageSlug(tenant),
  })
  if (!contentRoute) return next()

  locals.contentRouteKey = contentRoute

  const contentVersion = await getPublishedContentVersion(tenant.id, contentRoute)
  if (contentVersion == null) return next()

  locals.publishedContentVersion = contentVersion

  const early304 = tryEarlyHtml304({
    hostname,
    tenantId: tenant.id,
    pathname,
    contentVersion,
    ifNoneMatch: request.headers.get('if-none-match'),
  })
  if (early304) return early304

  return next()
})

/** Idiomas del tenant desde CMS (después del 304 temprano). */
const tenantLanguages = defineMiddleware(async (context, next) => {
  const tenant = context.locals.tenant
  if (!tenant) return next()

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

  context.locals.primaryLanguage = primaryLanguage
  context.locals.availableLanguages = availableLanguages

  return next()
})

/**
 * Cabeceras Cache-Control / Vary / ETag para Firebase CDN (req. 14.4).
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
      { hostname: null, tenantId: undefined, pathname: context.url.pathname },
    )
  }

  const hostname = getRequestHostname(context.request)
  const tenantId = context.locals.tenant?.id
  const contentType = response.headers.get('content-type') ?? ''

  const ifNoneMatch = context.request.headers.get('if-none-match')
  const pathname = context.url.pathname

  if (contentType.includes('text/html')) {
    let contentVersion = context.locals.publishedContentVersion
    if (contentVersion === undefined && tenantId && context.locals.contentRouteKey) {
      contentVersion =
        (await getPublishedContentVersion(tenantId, context.locals.contentRouteKey)) ?? undefined
    }
    return withCdnHtmlCache(response, {
      hostname,
      tenantId,
      pathname,
      ifNoneMatch,
      contentVersion,
    })
  }

  if (contentType.includes('application/xml')) {
    return withCdnPublicAssetCache(response, {
      hostname,
      tenantId,
      assetKind: 'sitemap',
      maxAgeSeconds: CDN_XML_S_MAXAGE,
      ifNoneMatch,
    })
  }

  if (contentType.includes('text/plain') && pathname === '/robots.txt') {
    return withCdnPublicAssetCache(response, {
      hostname,
      tenantId,
      assetKind: 'robots',
      maxAgeSeconds: 86400,
      ifNoneMatch,
    })
  }

  return response
})

export const onRequest = sequence(tenantCore, earlyDbRevalidate, tenantLanguages, cdnCacheHeaders)

declare global {
  namespace App {
    interface Locals {
      tenant: import('../types/api.js').Tenant
      hostname: string
      primaryLanguage?: string
      availableLanguages?: string[]
      contentRouteKey?: import('../lib/resolve-content-route.js').ContentRouteKey
      publishedContentVersion?: number
    }
  }
}
