// Webhook de rebuild incremental — Req 15.2
// Recibe notificaciones del CMS sobre cambios de contenido y limpia el cache
export const prerender = false

import type { APIRoute } from 'astro'
import crypto from 'crypto'
import type { ContentChangeWebhook } from '../../../types/api.js'
import { invalidateTenantCache } from '../../../lib/cms-client.js'
import { cache } from '../../../lib/cache.js'

const WEBHOOK_SECRET = import.meta.env.WEBHOOK_SECRET ?? ''

export const POST: APIRoute = async ({ request }) => {
  // Verificar firma del webhook
  const signature = request.headers.get('x-signature-256')
  const body = await request.text()

  if (WEBHOOK_SECRET && signature) {
    const expected = `sha256=${crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')}`
    if (!timingSafeEqual(signature, expected)) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  let event: ContentChangeWebhook
  try {
    event = JSON.parse(body) as ContentChangeWebhook
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  // Invalidar cache del tenant afectado — Req 15.2: regenerar en <= 2 min
  if (event.tenantId && event.tenantId !== 'system') {
    invalidateTenantCache(event.tenantId)
  }

  // Si cambió un dominio, invalidar cache de resolución de tenants
  if (event.collection === 'domains') {
    cache.invalidateByPrefix('tenant:hostname:')
  }

  if (event.collection === 'html-templates' && event.tenantId) {
    cache.invalidateByPrefix(`template:${event.tenantId}`)
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return crypto.timingSafeEqual(bufA, bufB)
}
