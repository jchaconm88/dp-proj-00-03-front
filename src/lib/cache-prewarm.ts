/**
 * Precalienta la caché en memoria tras un webhook (req. 15.2).
 * Reduce latencia del primer visitante tras publicar sin mantener instancias mínimas.
 */
import {
  getAllPublishedPages,
  getPage,
  getPost,
  getPosts,
  getTenantLanguages,
} from './cms-client.js'

export async function prewarmTenantCache(tenantId: string): Promise<void> {
  const [pages, posts] = await Promise.all([
    getAllPublishedPages(tenantId),
    getPosts(tenantId),
  ])

  await getTenantLanguages(tenantId)

  const pageFetches: Promise<unknown>[] = []
  for (const page of pages) {
    for (const translation of page.translations) {
      pageFetches.push(getPage(tenantId, page.slug, translation.languageCode))
    }
  }

  const postFetches = posts.map((post) => getPost(tenantId, post.slug))

  await Promise.all([...pageFetches, ...postFetches])
}
