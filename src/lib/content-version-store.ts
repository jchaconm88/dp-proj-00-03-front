import { neon } from '@neondatabase/serverless'
import type { ContentRouteKey } from './resolve-content-route.js'

type NeonSql = ReturnType<typeof neon>

let sqlClient: NeonSql | null | undefined

function getSql(): NeonSql | null {
  if (sqlClient !== undefined) return sqlClient
  const url = process.env['DATABASE_URL']?.trim()
  if (!url) {
    sqlClient = null
    return null
  }
  sqlClient = neon(url)
  return sqlClient
}

function parseTenantId(tenantId: string): number | null {
  const n = Number.parseInt(tenantId, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function getPublishedContentVersion(
  tenantId: string,
  route: ContentRouteKey,
): Promise<number | null> {
  const sql = getSql()
  const tenantIdNum = parseTenantId(tenantId)
  if (!sql || tenantIdNum == null) return null

  try {
    const rows = await sql`
      SELECT content_version
      FROM published_content_versions
      WHERE tenant_id = ${tenantIdNum}
        AND collection = ${route.collection}
        AND slug = ${route.slug}
      LIMIT 1
    `
    const row = rows[0] as { content_version: string | number } | undefined
    if (!row) return null
    const version = Number(row.content_version)
    return Number.isFinite(version) ? version : null
  } catch (err) {
    console.error('[content-version-store] query failed:', err)
    return null
  }
}

/** Solo tests: reinicia cliente singleton. */
export function resetContentVersionStoreForTests(): void {
  sqlClient = undefined
}
