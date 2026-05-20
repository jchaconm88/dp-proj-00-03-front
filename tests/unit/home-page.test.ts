import { describe, expect, it } from 'vitest'
import {
  DEFAULT_HOME_PAGE_SLUG,
  getHomePageSlug,
  publicPathForPage,
} from '../../src/lib/home-page.ts'
import type { Tenant } from '../../src/types/api.js'

const baseTenant: Tenant = {
  id: '1',
  name: 'Demo',
  defaultLanguage: 'es',
  timezone: 'UTC',
  isActive: true,
  settings: {
    contactEmail: 'a@b.com',
    maxStorageBytes: 0,
    currentStorageBytes: 0,
    captchaEnabled: true,
  },
  createdAt: '',
  updatedAt: '',
}

describe('home-page', () => {
  it('usa home por defecto', () => {
    expect(getHomePageSlug(baseTenant)).toBe(DEFAULT_HOME_PAGE_SLUG)
  })

  it('respeta settings.homePageSlug', () => {
    expect(
      getHomePageSlug({
        ...baseTenant,
        settings: { ...baseTenant.settings, homePageSlug: 'bienvenida' },
      }),
    ).toBe('bienvenida')
  })

  it('publicPathForPage deja la home en /es/', () => {
    expect(publicPathForPage('es', 'home', 'home')).toBe('/es/')
    expect(publicPathForPage('es', 'contacto', 'home')).toBe('/es/contacto')
  })
})
