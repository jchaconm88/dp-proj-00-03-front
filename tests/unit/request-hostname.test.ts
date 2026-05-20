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

  it('usa Host cuando no hay x-forwarded-host (local)', () => {
    const req = new Request('http://mi-cliente.local:4321/es/inicio', {
      headers: { host: 'mi-cliente.local:4321' },
    })
    expect(getRequestHostname(req)).toBe('mi-cliente.local')
  })
})
