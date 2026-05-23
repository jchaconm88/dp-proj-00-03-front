import { describe, it, expect } from 'vitest'
import {
  fallbackLanguagesFromPath,
  resolveContentRoute,
} from '../../src/lib/resolve-content-route.js'

const langs = ['es', 'en']

describe('resolveContentRoute', () => {
  it('resuelve home como pages + homePageSlug', () => {
    expect(
      resolveContentRoute('/es/', { availableLanguages: langs, homePageSlug: 'home' }),
    ).toEqual({ collection: 'pages', slug: 'home' })
  })

  it('resuelve página por slug', () => {
    expect(
      resolveContentRoute('/es/sobre-nosotros', {
        availableLanguages: langs,
        homePageSlug: 'home',
      }),
    ).toEqual({ collection: 'pages', slug: 'sobre-nosotros' })
  })

  it('resuelve post bajo blog/', () => {
    expect(
      resolveContentRoute('/es/blog/mi-post', {
        availableLanguages: langs,
        homePageSlug: 'home',
      }),
    ).toEqual({ collection: 'posts', slug: 'mi-post' })
  })

  it('devuelve null si el idioma no está disponible', () => {
    expect(
      resolveContentRoute('/fr/about', { availableLanguages: langs, homePageSlug: 'home' }),
    ).toBeNull()
  })

  it('devuelve null para rutas sin prefijo de idioma', () => {
    expect(
      resolveContentRoute('/sitemap.xml', { availableLanguages: langs, homePageSlug: 'home' }),
    ).toBeNull()
  })
})

describe('fallbackLanguagesFromPath', () => {
  it('usa solo el idioma por defecto si el path no lleva prefijo', () => {
    expect(fallbackLanguagesFromPath('es', '/api/x')).toEqual(['es'])
  })

  it('incluye idioma del path si difiere del defecto', () => {
    expect(fallbackLanguagesFromPath('es', '/en/about')).toEqual(['en', 'es'])
  })

  it('no duplica si el path coincide con el defecto', () => {
    expect(fallbackLanguagesFromPath('es', '/es/about')).toEqual(['es'])
  })
})
