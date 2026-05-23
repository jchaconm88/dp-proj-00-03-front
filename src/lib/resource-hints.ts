import { getCmsUrl } from './cms-url.js'

/** Preconnect hints para imágenes del CMS y GCS. */
export function buildResourceHintsHtml(): string {
  const lines = ['<link rel="preconnect" href="https://storage.googleapis.com" crossorigin />']

  try {
    const cmsOrigin = new URL(getCmsUrl()).origin
    lines.push(`<link rel="preconnect" href="${cmsOrigin}" crossorigin />`)
  } catch {
    // CMS_URL inválida en build — omitir hint
  }

  return lines.join('\n')
}
