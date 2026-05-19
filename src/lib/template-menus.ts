import type { Menu, MenuItem } from '../types/api.ts'
import type { TemplateBlockData, TemplateManifest } from '../types/template.ts'

export interface MenuMustacheItem {
  label: string
  url: string
  sortOrder: number
  icon?: string
  active?: boolean
}

function flattenMenuItems(items: MenuItem[]): MenuMustacheItem[] {
  return items
    .map((item) => {
      const row = item as MenuItem & { icon?: string; active?: boolean }
      return {
        label: row.label,
        url: row.url,
        sortOrder: row.sortOrder ?? 0,
        icon: row.icon,
        active: row.active ?? false,
      }
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

/** Ubicaciones de menú referenciadas en manifest + templateData (menuLocation). */
export function collectMenuLocations(
  manifest: TemplateManifest | undefined,
  templateData: TemplateBlockData | null | undefined,
): string[] {
  const locations = new Set<string>()
  if (!manifest?.integrations) return []

  for (const integration of Object.values(manifest.integrations)) {
    if (integration.type !== 'menu') continue
    const blockId = integration.blockId ?? integration.location
    const block = templateData?.[blockId]
    const fromBlock =
      block &&
      typeof block['menuLocation'] === 'string' &&
      block['menuLocation'].trim().length > 0
        ? block['menuLocation'].trim()
        : null
    locations.add(fromBlock ?? integration.location)
  }

  return [...locations]
}

/** Inyecta navItems desde menús CMS según integrations y menuLocation del bloque. */
export function mergeMenuIntegrations(
  templateData: Record<string, Record<string, unknown>>,
  manifest: TemplateManifest,
  menusByLocation: Record<string, Menu | null>,
): Record<string, Record<string, unknown>> {
  if (!manifest.integrations) return templateData

  const merged = { ...templateData }
  for (const integration of Object.values(manifest.integrations)) {
    if (integration.type !== 'menu') continue

    const blockId = integration.blockId ?? integration.location
    const block = merged[blockId] ?? {}
    const location =
      typeof block['menuLocation'] === 'string' && block['menuLocation'].trim()
        ? String(block['menuLocation']).trim()
        : integration.location

    const menu = menusByLocation[location]
    if (!menu?.items?.length) continue

    merged[blockId] = {
      ...block,
      navItems: flattenMenuItems(menu.items),
    }
  }
  return merged
}
