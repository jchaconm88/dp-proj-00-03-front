/**
 * Hostname público de la petición.
 * Firebase Hosting → Cloud Run envía el dominio en x-forwarded-host, no en Host.
 */
export function getRequestHostname(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-host')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim().toLowerCase() ?? ''
    if (first) return first.split(':')[0]
  }

  const host = request.headers.get('host')?.toLowerCase().trim() ?? ''
  return host ? host.split(':')[0] : ''
}
