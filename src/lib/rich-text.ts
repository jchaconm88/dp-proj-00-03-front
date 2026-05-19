/**
 * Payload CMS richText (Lexical) → texto plano / HTML simple para el front SSR.
 */

type LexicalNode = {
  type?: string
  text?: string
  children?: LexicalNode[]
  tag?: string
  url?: string
  listType?: string
  [key: string]: unknown
}

function getRootNode(content: unknown): LexicalNode | null {
  if (content == null) return null
  if (typeof content === 'object' && content !== null && 'root' in content) {
    return (content as { root: LexicalNode }).root
  }
  if (typeof content === 'object') {
    return content as LexicalNode
  }
  return null
}

function collectPlainText(node: LexicalNode | undefined): string {
  if (!node) return ''
  if (node.type === 'text' && typeof node.text === 'string') {
    return node.text
  }
  if (Array.isArray(node.children)) {
    return node.children.map((child) => collectPlainText(child)).join(' ')
  }
  return ''
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function serializeToHtml(node: LexicalNode | undefined): string {
  if (!node) return ''

  const type = node.type ?? ''
  const children = node.children?.map((child) => serializeToHtml(child)).join('') ?? ''

  switch (type) {
    case 'root':
      return children
    case 'paragraph':
      return `<p>${children}</p>`
    case 'heading': {
      const tag = typeof node.tag === 'string' ? node.tag : 'h2'
      return `<${tag}>${children}</${tag}>`
    }
    case 'text':
      return escapeHtml(node.text ?? '')
    case 'linebreak':
      return '<br />'
    case 'link':
      return `<a href="${escapeHtml(String(node.url ?? '#'))}">${children}</a>`
    case 'list':
      return node.listType === 'number' ? `<ol>${children}</ol>` : `<ul>${children}</ul>`
    case 'listitem':
      return `<li>${children}</li>`
    case 'quote':
      return `<blockquote>${children}</blockquote>`
    default:
      return children
  }
}

/** Texto plano para meta description, Schema.org, etc. */
export function richTextToPlainText(content: unknown): string {
  if (content == null) return ''
  if (typeof content === 'string') return stripHtmlTags(content)
  const root = getRootNode(content)
  if (!root) return ''
  return collectPlainText(root).replace(/\s+/g, ' ').trim()
}

/** HTML básico para renderizar en la página. */
export function richTextToHtml(content: unknown): string {
  if (content == null) return ''
  if (typeof content === 'string') return content
  const root = getRootNode(content)
  if (!root) return ''
  return serializeToHtml(root)
}
