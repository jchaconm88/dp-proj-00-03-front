import type { TemplateBlockData, TemplateManifest } from '../types/template.ts'
import { listCatalogBlocks } from './template-catalog-blocks.ts'
import { cache, CACHE_TTL } from './cache.js'
import { getCmsUrl } from './cms-url.js'

const CMS_URL = getCmsUrl()

export interface CatalogProductItem {
  title: string
  price: string
  oldPrice?: string | null
  badge?: string | null
  emoji?: string
  ctaLabel?: string
  href?: string
  imageUrl?: string | null
}

async function fetchProductsByCategory(
  tenantId: string,
  category: string,
  slugs?: string[],
): Promise<CatalogProductItem[]> {
  const slugKey = slugs?.length ? slugs.join(',') : '*'
  const cacheKey = `products:${tenantId}:${category}:${slugKey}`
  const cached = cache.get<CatalogProductItem[]>(cacheKey)
  if (cached) return cached.data

  try {
    const params = new URLSearchParams({
      category,
      limit: '50',
    })
    if (slugs?.length) {
      params.set('slugs', slugs.join(','))
    }
    const response = await fetch(
      `${CMS_URL}/api/public/products/${encodeURIComponent(tenantId)}?${params}`,
      { headers: { 'Content-Type': 'application/json' } },
    )
    if (!response.ok) return []
    const json = (await response.json()) as { products: CatalogProductItem[] }
    const products = json.products ?? []
    cache.set(cacheKey, products, CACHE_TTL.CONTENT)
    return products
  } catch {
    const stale = cache.getStale<CatalogProductItem[]>(cacheKey, CACHE_TTL.STALE_MAX)
    return stale?.data ?? []
  }
}

/** Inyecta `items` en bloques con campo productCatalog del manifest. */
export async function enrichTemplateDataWithProductCatalogs(
  tenantId: string,
  manifest: TemplateManifest,
  templateData: TemplateBlockData,
): Promise<TemplateBlockData> {
  const enriched = { ...templateData }
  const catalogs = listCatalogBlocks(manifest)

  await Promise.all(
    catalogs.map(async ({ blockId, category }) => {
      const block = enriched[blockId] ?? {}
      const rawSlugs = block['productSlugs']
      const slugs = Array.isArray(rawSlugs)
        ? rawSlugs
            .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
            .map((s) => s.trim())
        : []
      const products = await fetchProductsByCategory(
        tenantId,
        category,
        slugs.length > 0 ? slugs : undefined,
      )
      const badgeDefault =
        typeof block['badgeDefault'] === 'string' ? block['badgeDefault'] : null
      const variant =
        typeof block['variant'] === 'string' ? block['variant'] : 'footwear'

      enriched[blockId] = {
        ...block,
        variant,
        ...(variant === 'footwear' ? { sectionMuted: true } : {}),
        ...(variant === 'compact' ? { sectionLow: true } : {}),
        ...(variant === 'liquidation' ? { sectionLiquidation: true } : {}),
        items: products.map((p) => {
          const item = {
            title: p.title,
            price: p.price,
            oldPrice: p.oldPrice ?? undefined,
            badge: p.badge ?? badgeDefault ?? '',
            emoji: p.emoji ?? '👟',
            ctaLabel: p.ctaLabel ?? 'Seleccionar opciones',
            href: p.href ?? '#',
            imageUrl: p.imageUrl,
          }
          if (variant === 'footwear') {
            return {
              ...item,
              showBadges: true,
              badgeSale: p.oldPrice ? 'OFERTA' : undefined,
            }
          }
          if (variant === 'liquidation') {
            return {
              ...item,
              overlayLabel: 'Agotando Stock',
              badgeSale: p.badge ?? '-50% OFF',
            }
          }
          if (variant === 'home') {
            return { ...item, ctaLabel: p.ctaLabel ?? 'Añadir' }
          }
          return item
        }),
      }
    }),
  )

  return enriched
}
