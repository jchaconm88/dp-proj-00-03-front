import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  processTemplate,
  rewriteRelativeAssetUrls,
  substituteBlockSlots,
} from '../../src/lib/html-template.js'
import type { TemplateManifest } from '../../src/types/template.js'

const BASE_URL = 'https://cms.example/api/public/templates/tenant-1/demo/assets'

const emptyVars = {
  title: '',
  content: '',
  tenantName: '',
  lang: 'es',
  homeUrl: '/es/inicio',
}

function countMatches(source: string, pattern: RegExp): number {
  return (source.match(pattern) ?? []).length
}

/**
 * Property 10: Preservación de Plantillas HTML (Round-Trip)
 * Validates: Requirements 3.4
 */
describe('Property 10: Preservación de Plantillas HTML', () => {
  it('preserva estructura y convierte assets relativos a URLs absolutas', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z][a-z0-9-]{0,20}\.(css|png|js)$/),
        async (assetName) => {
          const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <link rel="stylesheet" href="styles/${assetName}">
  <style>.x { background: url(assets/bg.png); }</style>
</head>
<body>
  <img src="assets/${assetName}" alt="x">
  <h1>{{title}}</h1>
  <motion.div>{{content}}</motion.div>
</body>
</html>`

          const result = await processTemplate(html, {
            vars: { ...emptyVars, title: 'Título', content: '<p>Hola</p>' },
            baseUrl: BASE_URL,
          })

          expect(countMatches(result, /<link\b/gi)).toBe(countMatches(html, /<link\b/gi))
          expect(countMatches(result, /<img\b/gi)).toBe(countMatches(html, /<img\b/gi))
          expect(countMatches(result, /<style\b/gi)).toBe(countMatches(html, /<style\b/gi))
          expect(result).toContain(`${BASE_URL}/styles/${assetName}`)
          expect(result).toContain(`${BASE_URL}/assets/${assetName}`)
          expect(result).toContain(`${BASE_URL}/assets/bg.png`)
          expect(result).not.toContain('{{title}}')
          expect(result).not.toContain('{{content}}')
        },
      ),
      { numRuns: 100 },
    )
  })

  it('renderiza N ítems de un bloque array en el HTML', () => {
    const manifest: TemplateManifest = {
      version: 1,
      globals: ['title', 'content', 'tenantName', 'lang', 'homeUrl'],
      blocks: {
        list: {
          label: 'Lista',
          partial: 'partials/list.html',
          fields: {
            items: { type: 'array', itemFields: { name: { type: 'text' } } },
          },
        },
      },
    }
    const partials = {
      'partials/list.html': '{{#items}}<li>{{name}}</li>{{/items}}',
    }
    const html = '<ul>{{block:list}}</ul>'
    const n = 5
    const items = Array.from({ length: n }, (_, i) => ({ name: `item-${i}` }))
    const out = substituteBlockSlots(
      html,
      manifest,
      partials,
      { list: { items } },
      { ...emptyVars, title: 'T', content: '' },
    )
    expect((out.match(/<li>/g) ?? []).length).toBe(n)
  })

  it('no modifica URLs ya absolutas', () => {
    const html =
      '<html><head><link href="https://cdn.example/lib.css" rel="stylesheet"></head><body></body></html>'
    const result = rewriteRelativeAssetUrls(html, BASE_URL)
    expect(result).toBe(html)
  })
})
