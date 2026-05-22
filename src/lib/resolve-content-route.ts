export type ContentRouteKey = {
  collection: 'pages' | 'posts'
  slug: string
}

const LANG_PATH_RE = /^\/([a-z]{2})(?:\/(.*))?$/

/**
 * Mapea pathname público a clave (collection, slug) para versiones en BD.
 * Alineado con [lang]/[...slug].astro (home, blog, slug vacío).
 */
export function resolveContentRoute(
  pathname: string,
  options: {
    availableLanguages: string[]
    homePageSlug: string
  },
): ContentRouteKey | null {
  const normalized = pathname.replace(/\/$/, '') || '/'
  const match = normalized.match(LANG_PATH_RE)
  if (!match) return null

  const lang = match[1]
  if (!options.availableLanguages.includes(lang)) return null

  const rest = (match[2] ?? '').replace(/\/$/, '')
  const isBlog = rest.startsWith('blog/')
  const contentSlug = isBlog ? rest.replace(/^blog\//, '') : rest
  const lookupSlug = !isBlog && contentSlug === '' ? options.homePageSlug : contentSlug

  if (!lookupSlug) return null

  return {
    collection: isBlog ? 'posts' : 'pages',
    slug: lookupSlug,
  }
}
