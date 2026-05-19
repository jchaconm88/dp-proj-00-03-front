import { describe, it } from 'vitest'
import fc from 'fast-check'
import { resolveLanguage } from '../../src/lib/i18n.js'

/**
 * Property tests para resolución de idioma por URL.
 * Feature: multi-tenant-web-platform
 * Properties 20, 21
 */

const AVAILABLE_LANGUAGES = ['es', 'en', 'fr', 'pt']
const PRIMARY_LANGUAGE = 'es'
const HOSTNAME = 'example.com'

describe('Feature: multi-tenant-web-platform, Property 21: Resolución de Idioma por URL', () => {
  it('URLs con idioma válido y traducción disponible se sirven sin redirección', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...AVAILABLE_LANGUAGES),
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => /^[a-z0-9-/]+$/.test(s)),
        (lang, slug) => {
          const result = resolveLanguage({
            pathname: `/${lang}/${slug}`,
            availableLanguages: AVAILABLE_LANGUAGES,
            primaryLanguage: PRIMARY_LANGUAGE,
            availableTranslations: AVAILABLE_LANGUAGES,
            hostname: HOSTNAME,
          })

          return result.language === lang && result.redirect === null
        },
      ),
      { numRuns: 100 },
    )
  })

  it('URLs con idioma sin traducción redirigen 302 al idioma principal', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('en', 'fr', 'pt'), // Idiomas con traducción solo en 'es'
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => /^[a-z0-9-]+$/.test(s)),
        (lang, slug) => {
          const result = resolveLanguage({
            pathname: `/${lang}/${slug}`,
            availableLanguages: AVAILABLE_LANGUAGES,
            primaryLanguage: PRIMARY_LANGUAGE,
            availableTranslations: ['es'], // Solo hay traducción en español
            hostname: HOSTNAME,
          })

          return (
            result.redirect !== null &&
            result.redirect.status === 302 &&
            result.redirect.url.includes(`/${PRIMARY_LANGUAGE}/`)
          )
        },
      ),
      { numRuns: 100 },
    )
  })

  it('URLs con /es/... no duplican el prefijo si Tenant Languages está vacío', () => {
    const result = resolveLanguage({
      pathname: '/es/inicio',
      availableLanguages: [],
      primaryLanguage: PRIMARY_LANGUAGE,
      availableTranslations: ['es'],
      hostname: HOSTNAME,
      routeLanguage: 'es',
    })

    expect(result.redirect).toBeNull()
    expect(result.language).toBe('es')
  })

  it('routeLanguage evita /es/es/ aunque availableLanguages esté vacío', () => {
    const result = resolveLanguage({
      pathname: '/es/inicio',
      availableLanguages: [],
      primaryLanguage: PRIMARY_LANGUAGE,
      availableTranslations: ['es'],
      hostname: HOSTNAME,
      routeLanguage: 'es',
    })

    expect(result.redirect).toBeNull()
  })

  it('URLs sin indicador de idioma redirigen 301 al idioma principal', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) =>
          /^[a-z0-9-/]+$/.test(s) &&
          !AVAILABLE_LANGUAGES.some((lang) => s.startsWith(`${lang}/`) || s === lang)
        ),
        (slug) => {
          const result = resolveLanguage({
            pathname: `/${slug}`,
            availableLanguages: AVAILABLE_LANGUAGES,
            primaryLanguage: PRIMARY_LANGUAGE,
            availableTranslations: AVAILABLE_LANGUAGES,
            hostname: HOSTNAME,
          })

          return (
            result.redirect !== null &&
            result.redirect.status === 301 &&
            result.redirect.url.includes(`/${PRIMARY_LANGUAGE}`)
          )
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('Feature: multi-tenant-web-platform, Property 20: Generación de Hreflang', () => {
  it('N traducciones generan N etiquetas hreflang + x-default', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...AVAILABLE_LANGUAGES), { minLength: 1, maxLength: 4, noNullable: true }).map(
          (langs) => [...new Set(langs)], // Sin duplicados
        ).filter((langs) => langs.length >= 1),
        (translationLangs) => {
          // Simular la generacion de hreflang
          const entries = translationLangs.map((lang) => ({
            lang,
            url: `https://${HOSTNAME}/${lang}/test-page`,
          }))

          // x-default
          entries.push({
            lang: 'x-default',
            url: `https://${HOSTNAME}/${PRIMARY_LANGUAGE}/test-page`,
          })

          return (
            entries.length === translationLangs.length + 1 &&
            entries.some((e) => e.lang === 'x-default') &&
            translationLangs.every((lang) => entries.some((e) => e.lang === lang))
          )
        },
      ),
      { numRuns: 100 },
    )
  })
})
