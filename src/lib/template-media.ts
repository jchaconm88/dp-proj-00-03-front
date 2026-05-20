import type { TemplateBlockData } from '../types/template.ts'
import { getCmsUrl } from './cms-url.js'

const CMS_URL = getCmsUrl()

const mediaUrlCache = new Map<string, string>()

async function fetchMediaUrl(mediaId: string): Promise<string | null> {
  const cached = mediaUrlCache.get(mediaId)
  if (cached) return cached

  try {
    const response = await fetch(`${CMS_URL}/api/media/${encodeURIComponent(mediaId)}?depth=0`, {
      headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) return null
    const doc = (await response.json()) as { url?: string }
    if (!doc.url) return null
    const absolute = doc.url.startsWith('http') ? doc.url : `${CMS_URL}${doc.url}`
    mediaUrlCache.set(mediaId, absolute)
    return absolute
  } catch {
    return null
  }
}

async function resolveValue(value: unknown): Promise<unknown> {
  if (value === null || value === undefined) return value

  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => resolveValue(item)))
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if ('mediaId' in obj && (typeof obj.mediaId === 'string' || typeof obj.mediaId === 'number')) {
      const url = await fetchMediaUrl(String(obj.mediaId))
      return { ...obj, url: url ?? '' }
    }
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      out[k] = await resolveValue(v)
    }
    return out
  }

  return value
}

export async function resolveMediaInTemplateData(
  templateData: TemplateBlockData,
): Promise<TemplateBlockData> {
  const resolved: TemplateBlockData = {}
  for (const [blockId, blockValue] of Object.entries(templateData)) {
    resolved[blockId] = (await resolveValue(blockValue)) as Record<string, unknown>
  }
  return resolved
}
