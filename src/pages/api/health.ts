// Health check del frontend — Req 13.5
export const prerender = false

import type { APIRoute } from 'astro'

export const GET: APIRoute = () => {
  return new Response(
    JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      component: 'frontend',
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}
