import type { TemplateBlockData } from '../types/template.ts'
import { cache, CACHE_TTL } from './cache.js'
import { getCmsUrl } from './cms-url.js'
import {
  buildMediaImageProps,
  type PayloadMediaDoc,
} from './media-image-props.js'

const CMS_URL = getCmsUrl()

async function fetchMediaDoc(mediaId: string): Promise<PayloadMediaDoc | null> {
  const cacheKey = `media:doc:${mediaId}`
  const cached = cache.get<PayloadMediaDoc>(cacheKey)
  if (cached) return cached.data

  try {
    const response = await fetch(`${CMS_URL}/api/media/${encodeURIComponent(mediaId)}?depth=0`, {
      headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) return null
    const doc = (await response.json()) as PayloadMediaDoc
    cache.set(cacheKey, doc, CACHE_TTL.CONTENT)
    return doc
  } catch {
    const stale = cache.getStale<PayloadMediaDoc>(cacheKey, CACHE_TTL.STALE_MAX)
    return stale?.data ?? null
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
      const doc = await fetchMediaDoc(String(obj.mediaId))
      if (!doc) return { ...obj, url: '' }

      const props = buildMediaImageProps(doc, CMS_URL)
      if (!props) return { ...obj, url: '' }

      return {
        ...obj,
        url: props.url,
        imageUrl: props.imageUrl,
        ...(props.imageSrcset ? { imageSrcset: props.imageSrcset } : {}),
        imageSizes: props.imageSizes,
        ...(props.imageWidth != null ? { imageWidth: props.imageWidth } : {}),
        ...(props.imageHeight != null ? { imageHeight: props.imageHeight } : {}),
        ...(props.imageAlt && !obj['imageAlt'] ? { imageAlt: props.imageAlt } : {}),
      }
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
