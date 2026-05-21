// Genera robots.txt por dominio — Req 5.4, Property 15
export const prerender = false

import type { APIRoute } from 'astro'
import { generateRobotsTxt } from '../lib/seo.js'

export const GET: APIRoute = ({ locals }) => {
  const { hostname } = locals

  const content = generateRobotsTxt(hostname)

  return new Response(content, {
    headers: { 'Content-Type': 'text/plain' },
  })
}
