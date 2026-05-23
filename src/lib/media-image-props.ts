/** Props de imagen responsiva derivadas de un documento Media de Payload. */

export const DEFAULT_IMAGE_SIZES =
  '(max-width: 600px) 400px, (max-width: 1200px) 800px, 1600px'

const VARIANT_WIDTHS = { small: 400, medium: 800, large: 1600 } as const

export interface MediaSizeEntry {
  url?: string | null
  width?: number | null
  height?: number | null
}

export interface PayloadMediaDoc {
  url?: string | null
  alt?: string | null
  width?: number | null
  height?: number | null
  variants?: {
    small?: string | null
    medium?: string | null
    large?: string | null
  } | null
  sizes?: {
    small?: MediaSizeEntry | null
    medium?: MediaSizeEntry | null
    large?: MediaSizeEntry | null
  } | null
}

export interface MediaImageProps {
  url: string
  imageUrl: string
  imageSrcset: string
  imageSizes: string
  imageWidth?: number
  imageHeight?: number
  imageAlt?: string
}

export function toAbsoluteMediaUrl(raw: string, cmsBaseUrl: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const base = cmsBaseUrl.replace(/\/$/, '')
  return trimmed.startsWith('/') ? `${base}${trimmed}` : `${base}/${trimmed}`
}

function pickVariantUrl(
  doc: PayloadMediaDoc,
  variant: keyof typeof VARIANT_WIDTHS,
  cmsBaseUrl: string,
): string | null {
  const fromSize = doc.sizes?.[variant]?.url
  if (fromSize) return toAbsoluteMediaUrl(fromSize, cmsBaseUrl)

  const fromVariants = doc.variants?.[variant]
  if (fromVariants) return toAbsoluteMediaUrl(fromVariants, cmsBaseUrl)

  return null
}

export function buildSrcsetFromUrls(
  entries: Array<{ url: string; width: number }>,
): string {
  return entries.map(({ url, width }) => `${url} ${width}w`).join(', ')
}

/** Deriva srcset hermano si la URL contiene -small|-medium|-large (Payload imageSizes). */
export function deriveSrcsetFromSrc(src: string): string | null {
  const match = src.match(/-(small|medium|large)(\.(webp|avif|jpe?g|png|gif))(\?.*)?$/i)
  if (!match || match.index === undefined) return null

  const ext = match[3]
  const query = match[4] ?? ''
  const base = src.slice(0, match.index)

  const parts: Array<{ url: string; width: number }> = []
  for (const name of ['small', 'medium', 'large'] as const) {
    parts.push({ url: `${base}-${name}.${ext}${query}`, width: VARIANT_WIDTHS[name] })
  }
  return buildSrcsetFromUrls(parts)
}

export function buildMediaImageProps(
  doc: PayloadMediaDoc,
  cmsBaseUrl: string,
): MediaImageProps | null {
  const mediumUrl =
    pickVariantUrl(doc, 'medium', cmsBaseUrl) ??
    (doc.url ? toAbsoluteMediaUrl(doc.url, cmsBaseUrl) : null)

  if (!mediumUrl) return null

  const srcsetEntries: Array<{ url: string; width: number }> = []
  for (const name of ['small', 'medium', 'large'] as const) {
    const url = pickVariantUrl(doc, name, cmsBaseUrl)
    if (url) srcsetEntries.push({ url, width: VARIANT_WIDTHS[name] })
  }

  const imageSrcset =
    srcsetEntries.length >= 2
      ? buildSrcsetFromUrls(srcsetEntries)
      : (deriveSrcsetFromSrc(mediumUrl) ?? '')

  const mediumSize = doc.sizes?.medium
  const imageWidth = mediumSize?.width ?? doc.width ?? undefined
  const imageHeight = mediumSize?.height ?? doc.height ?? undefined

  return {
    url: mediumUrl,
    imageUrl: mediumUrl,
    imageSrcset,
    imageSizes: DEFAULT_IMAGE_SIZES,
    ...(imageWidth != null ? { imageWidth: Number(imageWidth) } : {}),
    ...(imageHeight != null ? { imageHeight: Number(imageHeight) } : {}),
    ...(doc.alt ? { imageAlt: doc.alt } : {}),
  }
}
