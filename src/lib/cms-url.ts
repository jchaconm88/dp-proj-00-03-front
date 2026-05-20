/**
 * URL del CMS en runtime (Cloud Run) o en build (import.meta.env).
 * process.env tiene prioridad para poder corregir CMS_URL sin rebuild.
 */
export function getCmsUrl(): string {
  const fromEnv = process.env.CMS_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  const fromBuild = import.meta.env.CMS_URL?.trim()
  if (fromBuild) return fromBuild.replace(/\/$/, '')

  return 'http://localhost:3000'
}
