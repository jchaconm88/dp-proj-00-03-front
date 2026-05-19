import Mustache from 'mustache'
import type { MetaTags } from '../types/index.ts'
import type { Menu } from '../types/api.ts'
import type { TemplateBlockData, TemplateManifest } from '../types/template.ts'
import { richTextToHtml } from './rich-text.js'
import { cache, CACHE_TTL } from './cache.js'
import { resolveMediaInTemplateData } from './template-media.ts'
import { mergeMenuIntegrations } from './template-menus.ts'
import { enrichTemplateDataWithProductCatalogs } from './template-products.ts'

const CMS_URL = import.meta.env.CMS_URL ?? 'http://localhost:3000'
const CMS_TIMEOUT_MS = 5000

const GLOBAL_PLACEHOLDER_RE = /\{\{(\w+)\}\}/g
const BLOCK_SLOT_RE = /\{\{block:([a-zA-Z0-9_-]+)\}\}/g

export interface TemplateBundle {
  html: string
  baseUrl: string
  templateId?: string
  tenantId?: string
  manifest?: TemplateManifest
  partials?: Record<string, string>
}

export interface TemplateVariables {
  title: string
  content: string
  tenantName: string
  lang: string
  homeUrl: string
}

export interface ProcessTemplateOptions {
  vars: TemplateVariables
  baseUrl: string
  tenantId?: string
  manifest?: TemplateManifest
  partials?: Record<string, string>
  templateData?: TemplateBlockData | null
  menusByLocation?: Record<string, Menu | null>
}

function prepareValueForMustache(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'object' && value !== null && 'root' in value) {
    return richTextToHtml(value)
  }
  if (Array.isArray(value)) {
    return value.map((item) => prepareValueForMustache(item))
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      out[k] = prepareValueForMustache(v)
    }
    return out
  }
  return value
}

export function renderBlockPartial(
  partialHtml: string,
  blockData: Record<string, unknown>,
  globals: TemplateVariables,
): string {
  const view = {
    ...prepareValueForMustache(blockData),
    ...globals,
  }
  return Mustache.render(partialHtml, view)
}

export function substituteBlockSlots(
  html: string,
  manifest: TemplateManifest,
  partials: Record<string, string>,
  templateData: TemplateBlockData,
  globals: TemplateVariables,
): string {
  return html.replace(BLOCK_SLOT_RE, (_match, blockId: string) => {
    const blockDef = manifest.blocks[blockId]
    if (!blockDef) return ''
    const partialHtml = partials[blockDef.partial]
    if (!partialHtml) return ''
    const data = templateData[blockId] ?? {}
    return renderBlockPartial(partialHtml, data, globals)
  })
}

export function substitutePlaceholders(html: string, vars: TemplateVariables): string {
  return html.replace(GLOBAL_PLACEHOLDER_RE, (_match, key: string) => {
    const value = vars[key as keyof TemplateVariables]
    return value !== undefined ? String(value) : ''
  })
}

function isAbsoluteUrl(value: string): boolean {
  return /^(https?:|\/\/|#|mailto:|data:|tel:)/i.test(value)
}

function rewriteUrl(value: string, baseUrl: string): string {
  const trimmed = value.trim()
  if (!trimmed || isAbsoluteUrl(trimmed)) return value
  const base = baseUrl.replace(/\/$/, '')
  if (trimmed.startsWith('/')) {
    return `${base}${trimmed}`
  }
  return `${base}/${trimmed}`
}

export function rewriteRelativeAssetUrls(html: string, baseUrl: string): string {
  let result = html.replace(
    /\b(href|src)=(["'])([^"']+)\2/gi,
    (_m, attr: string, quote: string, url: string) => {
      return `${attr}=${quote}${rewriteUrl(url, baseUrl)}${quote}`
    },
  )

  result = result.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (_m, quote: string, url: string) => {
    const rewritten = rewriteUrl(url.trim(), baseUrl)
    return `url(${quote || ''}${rewritten}${quote || ''})`
  })

  return result
}

export async function processTemplate(
  html: string,
  options: ProcessTemplateOptions,
): Promise<string> {
  const { vars, baseUrl, tenantId, manifest, partials, templateData, menusByLocation } = options

  let result = html

  if (manifest && partials && templateData) {
    let data = await resolveMediaInTemplateData(templateData)
    if (tenantId) {
      data = await enrichTemplateDataWithProductCatalogs(tenantId, manifest, data)
    }
    if (menusByLocation && manifest.integrations) {
      data = mergeMenuIntegrations(data, manifest, menusByLocation) as TemplateBlockData
    }
    result = substituteBlockSlots(result, manifest, partials, data, vars)
  }

  result = substitutePlaceholders(result, vars)
  return rewriteRelativeAssetUrls(result, baseUrl)
}

/** @deprecated Usar processTemplate con ProcessTemplateOptions */
export function processTemplateSync(
  html: string,
  vars: TemplateVariables,
  baseUrl: string,
): string {
  const withVars = substitutePlaceholders(html, vars)
  return rewriteRelativeAssetUrls(withVars, baseUrl)
}

export function injectSeo(html: string, meta: MetaTags, language: string): string {
  const seoBlock = `
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(meta.title)}</title>
<meta name="description" content="${escapeHtml(meta.description)}" />
<link rel="canonical" href="${escapeHtml(meta.canonicalUrl)}" />
<meta property="og:title" content="${escapeHtml(meta.ogTitle)}" />
<meta property="og:description" content="${escapeHtml(meta.ogDescription)}" />
<meta property="og:url" content="${escapeHtml(meta.ogUrl)}" />
<meta property="og:type" content="website" />
${meta.ogImage ? `<meta property="og:image" content="${escapeHtml(meta.ogImage)}" />` : ''}
`.trim()

  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>\n${seoBlock}\n`)
  }

  if (/<html[\s>]/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1 lang="${escapeHtml(language)}">`).replace(
      /<html[^>]*>/i,
      (match) => `${match}\n<head>\n${seoBlock}\n</head>`,
    )
  }

  return `<!DOCTYPE html><html lang="${escapeHtml(language)}"><head>${seoBlock}</head><body>${html}</body></html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function fetchTemplate(
  tenantId: string,
  templateId: string,
): Promise<TemplateBundle | null> {
  const cacheKey = `template:${tenantId}:${templateId}`
  const cached = cache.get<TemplateBundle>(cacheKey)
  if (cached) return cached.data

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CMS_TIMEOUT_MS)

  try {
    const response = await fetch(
      `${CMS_URL}/api/public/templates/${encodeURIComponent(tenantId)}/${encodeURIComponent(templateId)}`,
      {
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
      },
    )

    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Template API error: ${response.status}`)
    }

    const bundle = (await response.json()) as TemplateBundle
    cache.set(cacheKey, bundle, CACHE_TTL.CONTENT)
    return bundle
  } catch {
    const stale = cache.getStale<TemplateBundle>(cacheKey, CACHE_TTL.STALE_MAX)
    return stale?.data ?? null
  } finally {
    clearTimeout(timeoutId)
  }
}

export function injectSchemaOrg(html: string, schemaOrg: object): string {
  const script = `<script type="application/ld+json">${JSON.stringify(schemaOrg)}</script>`
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${script}\n</head>`)
  }
  return `${html}\n${script}`
}
