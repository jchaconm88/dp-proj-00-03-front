import type { TemplateManifest } from '../types/template.ts'

export function getProductCatalogCategory(
  blockDef: TemplateManifest['blocks'][string],
): string | null {
  for (const field of Object.values(blockDef.fields)) {
    const f = field as { type?: string; category?: string }
    if (f.type === 'productCatalog' && f.category) return f.category
  }
  return null
}

export function listCatalogBlocks(manifest: TemplateManifest): Array<{
  blockId: string
  category: string
}> {
  const out: Array<{ blockId: string; category: string }> = []
  for (const [blockId, blockDef] of Object.entries(manifest.blocks)) {
    const category = getProductCatalogCategory(blockDef)
    if (category) out.push({ blockId, category })
  }
  return out
}
