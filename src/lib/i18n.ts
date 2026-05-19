import { buildSiteUrl } from './site-url.js'

/**
 * Resolución de idioma y redirecciones para soporte multi-idioma.
 * Requisito 7.4, 7.5, 7.6, 7.7 — Properties 20, 21
 */

export interface LanguageResolution {
  language: string
  redirect: null | { url: string; status: 301 | 302 }
}

function normalizeLanguageCode(code: string): string {
  return code.trim().toLowerCase()
}

/**
 * Resuelve el idioma de una URL y determina si se necesita redirección.
 *
 * - URL con idioma y traducción disponible → sirve en ese idioma
 * - URL con idioma sin traducción → redirect 302 al idioma principal — Req 7.6
 * - URL sin indicador de idioma → redirect 301 al idioma principal — Req 7.7
 */
export function resolveLanguage(params: {
  pathname: string
  availableLanguages: string[]
  primaryLanguage: string
  availableTranslations: string[] // idiomas para los que existe traducción
  hostname: string
  origin?: string
  /** Idioma de la ruta Astro `[lang]` — evita duplicar /es/es/... */
  routeLanguage?: string
}): LanguageResolution {
  const {
    pathname,
    availableLanguages,
    primaryLanguage,
    availableTranslations,
    hostname,
    origin,
    routeLanguage,
  } = params

  const normalizedPrimary = normalizeLanguageCode(primaryLanguage)
  const effectiveLanguages =
    availableLanguages.length > 0
      ? availableLanguages.map(normalizeLanguageCode)
      : [normalizedPrimary]
  const normalizedTranslations = availableTranslations.map(normalizeLanguageCode)

  const segments = pathname.split('/').filter(Boolean)

  // Ruta `[lang]/[...slug]`: el idioma ya viene en params, no re-antepongas /es
  if (routeLanguage) {
    const lang = normalizeLanguageCode(routeLanguage)
    const contentPath = segments[0] === lang ? segments.slice(1).join('/') : segments.join('/')

    const targetLang = normalizedTranslations.includes(lang)
      ? lang
      : normalizedPrimary

    if (targetLang !== lang) {
      const newPath = contentPath ? `/${targetLang}/${contentPath}` : `/${targetLang}`
      return {
        language: targetLang,
        redirect: {
          url: buildSiteUrl(hostname, newPath, origin),
          status: 302,
        },
      }
    }

    return { language: lang, redirect: null }
  }

  const firstSegment = segments[0] ?? ''
  const isLanguageCode =
    effectiveLanguages.includes(firstSegment) || firstSegment === normalizedPrimary

  if (!isLanguageCode) {
    const newPath =
      pathname === '/'
        ? `/${normalizedPrimary}`
        : `/${normalizedPrimary}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
    return {
      language: normalizedPrimary,
      redirect: {
        url: buildSiteUrl(hostname, newPath, origin),
        status: 301,
      },
    }
  }

  const requestedLanguage = firstSegment

  if (!normalizedTranslations.includes(requestedLanguage)) {
    const restPath = segments.slice(1).join('/')
    const newPath = restPath ? `/${normalizedPrimary}/${restPath}` : `/${normalizedPrimary}`
    return {
      language: normalizedPrimary,
      redirect: {
        url: buildSiteUrl(hostname, newPath, origin),
        status: 302,
      },
    }
  }

  return {
    language: requestedLanguage,
    redirect: null,
  }
}

/**
 * Extrae el slug de la ruta eliminando el prefijo de idioma.
 */
export function extractSlugFromPath(pathname: string, language: string): string {
  const prefix = `/${language}/`
  if (pathname.startsWith(prefix)) {
    return pathname.slice(prefix.length)
  }
  return pathname.slice(1)
}

/**
 * Construye la URL para un idioma específico.
 */
export function buildLanguageUrl(params: {
  hostname: string
  language: string
  slug: string
  origin?: string
}): string {
  return buildSiteUrl(
    params.hostname,
    `/${normalizeLanguageCode(params.language)}/${params.slug}`,
    params.origin,
  )
}
