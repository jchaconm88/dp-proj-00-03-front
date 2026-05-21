import { describe, expect, it } from 'vitest'
import { getRequestHostname } from '../../src/lib/request-hostname.ts'

describe('getRequestHostname', () => {
  it('prefiere x-forwarded-host (Firebase Hosting → Cloud Run)', () => {
    const req = new Request('https://ignored/es/inicio', {
      headers: {
        host: 'dp-proj-00-03-front-abc.run.app',
        'x-forwarded-host': 'd360.dheployapps.com',
      },
    })
    expect(getRequestHostname(req)).toBe('d360.dheployapps.com')
  })

  it('usa x-fh-requested-host si falta x-forwarded-host', () => {
    const req = new Request('https://ignored/', {
      headers: {
        host: 'dp-proj-00-03-front-abc.run.app',
        'x-fh-requested-host': 'd360.dheployapps.com',
      },
    })
    expect(getRequestHostname(req)).toBe('d360.dheployapps.com')
  })

  it('usa Host cuando no hay headers de Firebase (local)', () => {
    const req = new Request('http://mi-cliente.local:4321/es/inicio', {
      headers: { host: 'mi-cliente.local:4321' },
    })
    expect(getRequestHostname(req)).toBe('mi-cliente.local')
  })

  it('ignora Host .run.app sin x-forwarded-host', () => {
    const req = new Request('https://dp-proj-00-03-front-abc.run.app/', {
      headers: { host: 'dp-proj-00-03-front-abc.run.app' },
    })
    expect(getRequestHostname(req)).toBe('')
  })
})
