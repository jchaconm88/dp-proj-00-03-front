import { defineMiddleware, sequence } from 'astro:middleware'
import { resolveTenantByHostname } from '../lib/cms-client.js'
import { getTenantLanguages } from '../lib/cms-client.js'

/**
 * Middleware de resolución de tenant por hostname.
 * Requisito 2.2, 1.3, 15.3, 15.6 — Property 7
 *
 * - Extrae el hostname de la petición
 * - Consulta la API del CMS para resolver el tenant activo
 * - Retorna 404 para dominios no registrados (sin exponer info de otros tenants)
 * - Retorna 503 para tenants desactivados
 */
const tenantResolver = defineMiddleware(async (context, next) => {
  const hostname =
    context.request.headers.get('host')?.toLowerCase().trim().split(':')[0] ?? ''

  // Rutas internas no requieren resolución de tenant
  const isInternalRoute =
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

  // Resolver tenant
  const tenant = hostname ? await resolveTenantByHostname(hostname) : null

  if (!tenant) {
    // Dominio no registrado — Req 15.6: HTTP 404 sin exponer info de otros tenants
    return new Response('Not Found', { status: 404 })
  }

  if (!tenant.isActive) {
    // Tenant desactivado — Req 1.3: dejar de servir contenido en <= 5 minutos
    return new Response('Site Temporarily Unavailable', {
      status: 503,
      headers: { 'Retry-After': '300' },
    })
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

export const onRequest = sequence(tenantResolver)

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
