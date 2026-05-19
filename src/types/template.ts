export interface TemplateManifest {
  version: 1
  globals: Array<'title' | 'content' | 'tenantName' | 'lang' | 'homeUrl'>
  blocks: Record<
    string,
    {
      label: string
      partial: string
      fields: Record<string, unknown>
    }
  >
  integrations?: Record<
    string,
    {
      type: 'menu'
      location: 'header' | 'footer' | 'sidebar' | 'custom'
      blockId?: string
    }
  >
}

export type TemplateBlockData = Record<string, Record<string, unknown>>
