import { deriveSrcsetFromSrc } from './media-image-props.js'

export interface OptimizeImagesOptions {
  /** Si true, la primera imagen LCP ya fue marcada externamente */
  lcpAssigned?: boolean
}

const IMG_TAG_RE = /<img\b[^>]*>/gi
const LCP_CLASS_RE = /\bds-hero__img\b/i
const RASTER_SRC_RE = /\.(webp|avif|jpe?g|png|gif)(\?|$)/i
const NON_LAZY_SRC_RE = /^(data:|\.svg(\?|$))/i

function getAttr(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*(["'])([^"']*)\\1`, 'i')
  const m = tag.match(re)
  return m?.[2] ?? null
}

function hasAttr(tag: string, name: string): boolean {
  return new RegExp(`\\b${name}\\s*=`, 'i').test(tag)
}

function setAttr(tag: string, name: string, value: string): string {
  if (hasAttr(tag, name)) {
    return tag.replace(
      new RegExp(`\\b${name}\\s*=\\s*(["'])[^"']*\\1`, 'i'),
      `${name}="${value}"`,
    )
  }
  return tag.replace(/\/?>$/, (end) => ` ${name}="${value}"${end}`)
}

function removeAttr(tag: string, name: string): string {
  return tag.replace(new RegExp(`\\s*\\b${name}\\s*=\\s*(["'])[^"']*\\1`, 'i'), '')
}

function isLcpCandidate(tag: string, isFirstImg: boolean): boolean {
  if (getAttr(tag, 'data-lcp') === 'true') return true
  if (LCP_CLASS_RE.test(tag)) return true
  return isFirstImg
}

function isRasterImage(tag: string): boolean {
  const src = getAttr(tag, 'src')
  if (!src) return false
  if (NON_LAZY_SRC_RE.test(src)) return false
  return RASTER_SRC_RE.test(src)
}

function optimizeImgTag(tag: string, isFirstImg: boolean, lcpTaken: boolean): { tag: string; lcpTaken: boolean } {
  if (!isRasterImage(tag)) return { tag, lcpTaken }

  let out = tag
  const lcp = !lcpTaken && isLcpCandidate(out, isFirstImg)

  if (lcp) {
    out = setAttr(out, 'fetchpriority', 'high')
    out = removeAttr(out, 'loading')
    lcpTaken = true
  } else if (!hasAttr(out, 'loading')) {
    out = setAttr(out, 'loading', 'lazy')
  }

  if (!hasAttr(out, 'decoding')) {
    out = setAttr(out, 'decoding', 'async')
  }

  if (!hasAttr(out, 'srcset')) {
    const src = getAttr(out, 'src')
    if (src) {
      const derived = deriveSrcsetFromSrc(src)
      if (derived) {
        out = setAttr(out, 'srcset', derived)
        if (!hasAttr(out, 'sizes')) {
          out = setAttr(
            out,
            'sizes',
            '(max-width: 600px) 400px, (max-width: 1200px) 800px, 1600px',
          )
        }
      }
    }
  }

  return { tag: out, lcpTaken }
}

/**
 * Post-procesa HTML: LCP (fetchpriority), lazy below-fold, srcset derivado, decoding async.
 */
export function optimizeImagesInHtml(
  html: string,
  _options: OptimizeImagesOptions = {},
): string {
  let imgIndex = 0
  let lcpTaken = _options.lcpAssigned ?? false

  return html.replace(IMG_TAG_RE, (match) => {
    const isFirstImg = imgIndex === 0
    imgIndex += 1
    const result = optimizeImgTag(match, isFirstImg, lcpTaken)
    lcpTaken = result.lcpTaken
    return result.tag
  })
}
