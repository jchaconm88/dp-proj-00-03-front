// Endpoint proxy para formularios de contacto con validación CAPTCHA
export const prerender = false

import type { APIRoute } from 'astro'

const CMS_URL = import.meta.env.CMS_URL ?? 'http://localhost:3000'
const TURNSTILE_SECRET = import.meta.env.TURNSTILE_SECRET_KEY ?? ''

interface TurnstileVerifyResponse {
  success: boolean
  'error-codes'?: string[]
}

export const POST: APIRoute = async ({ request, locals }) => {
  const { tenant } = locals

  let body: Record<string, string>
  try {
    body = (await request.json()) as Record<string, string>
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Verificar CAPTCHA — Req 8.5
  if (tenant.settings.captchaEnabled && TURNSTILE_SECRET) {
    const token = body['cf-turnstile-response'] ?? ''
    const verified = await verifyTurnstile(token, request.headers.get('CF-Connecting-IP') ?? '')
    if (!verified) {
      return new Response(
        JSON.stringify({ error: 'Verificación CAPTCHA fallida', code: 'CAPTCHA_FAILED' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  // Reenviar al CMS para validación y almacenamiento — Req 8.1-8.4
  const response = await fetch(`${CMS_URL}/api/contact-submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: body['name'],
      email: body['email'],
      message: body['message'],
      tenant: tenant.id,
    }),
  })

  const result = (await response.json()) as Record<string, unknown>

  if (!response.ok) {
    return new Response(JSON.stringify(result), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Confirmación visible al visitante — Req 8.6
  return new Response(
    JSON.stringify({ success: true, message: 'Tu mensaje ha sido recibido. Te contactaremos pronto.' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: TURNSTILE_SECRET,
      response: token,
      remoteip: ip,
    }),
  })

  const data = (await response.json()) as TurnstileVerifyResponse
  return data.success === true
}
