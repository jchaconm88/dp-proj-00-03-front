import type { Tenant } from '../types/api.js'

/** Slug CMS por defecto si el tenant no define otro. */
export const DEFAULT_HOME_PAGE_SLUG = 'home'

const HOME_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/

/** Slug de la página de inicio en el CMS (settings.homePageSlug o `home`). */
export function getHomePageSlug(tenant: Tenant): string {
  const raw = tenant.settings.homePageSlug?.trim().toLowerCase()
  if (raw && HOME_SLUG_RE.test(raw)) return raw
  return DEFAULT_HOME_PAGE_SLUG
}

/** Ruta pública sin dominio: `/es/` para la home, `/es/{slug}` para el resto. */
export function publicPathForPage(language: string, cmsSlug: string, homePageSlug: string): string {
  const lang = language.trim().toLowerCase()
  if (cmsSlug === homePageSlug) return `/${lang}/`
  return `/${lang}/${cmsSlug}`
}
