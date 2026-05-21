function normalizeHostnameHeader(value: string | null): string {
  if (!value) return ''
  const first = value.split(',')[0]?.trim().toLowerCase() ?? ''
  return first ? first.split(':')[0] : ''
}

/**
 * Hostname público de la petición.
 * Firebase Hosting → Cloud Run: usar x-forwarded-host o x-fh-requested-host (no el Host interno .run.app).
 */
export function getRequestHostname(request: Request): string {
  for (const name of ['x-forwarded-host', 'x-fh-requested-host']) {
    const host = normalizeHostnameHeader(request.headers.get(name))
    if (host) return host
  }

  const host = normalizeHostnameHeader(request.headers.get('host'))
  // Evitar resolver tenant con el hostname interno de Cloud Run
  if (host && !host.endsWith('.run.app')) return host

  return ''
}
