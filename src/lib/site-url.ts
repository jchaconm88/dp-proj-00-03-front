/**
 * Construye URLs absolutas respetando protocolo y puerto del request (dev local).
 * En producción, origin suele venir de https://www.cliente.com.
 */
export function buildSiteUrl(hostname: string, path: string, origin?: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (origin) {
    return `${origin.replace(/\/$/, '')}${normalizedPath}`
  }

  return `https://${hostname}${normalizedPath}`
}
