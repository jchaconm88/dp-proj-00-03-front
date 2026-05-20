// Tipos del contrato de API v1 del backend (dp-proj-00-03-back)
// Versión mínima compatible: v1
// Protocolo: HTTP REST/JSON

export interface Tenant {
  id: string
  name: string
  defaultLanguage: string
  timezone: string
  isActive: boolean
  settings: TenantSettings
  createdAt: string
  updatedAt: string
}

export interface TenantSettings {
  contactEmail: string
  maxStorageBytes: number
  currentStorageBytes: number
  captchaEnabled: boolean
  /** Slug en Pages que se sirve en `/{idioma}/` (default: home) */
  homePageSlug?: string
  frontendWebhookUrl?: string
}

export interface Domain {
  id: string
  tenantId: string
  hostname: string
  status: 'pending' | 'verified' | 'active' | 'failed' | 'cancelled'
  verificationToken: string
  verificationDeadline: string
  sslProvisioned: boolean
  createdAt: string
}

export type ContentStatus = 'draft' | 'scheduled' | 'published'

export interface SEOConfig {
  metaTitle: string | null
  metaDescription: string | null
  canonicalUrl: string | null
  ogImage: string | null
}

export interface PageTranslation {
  id: string
  pageId: string
  languageCode: string
  title: string
  content: string | Record<string, unknown>
  metaTitle: string | null
  metaDescription: string | null
  canonicalUrl: string | null
  templateData?: Record<string, Record<string, unknown>> | null
}

export interface Page {
  id: string
  tenantId: string
  slug: string
  status: ContentStatus
  pageType: 'static' | 'landing'
  publishDate: string | null
  scheduledDate: string | null
  hasSchemaOrg: boolean
  seoConfig: SEOConfig
  templateId?: string | null
  translations: PageTranslation[]
  createdAt: string
  updatedAt: string
}

export interface PostTranslation {
  id: string
  postId: string
  languageCode: string
  title: string
  content: string | Record<string, unknown>
  excerpt: string
  metaTitle: string | null
  metaDescription: string | null
}

export interface Post {
  id: string
  tenantId: string
  slug: string
  status: ContentStatus
  publishDate: string | null
  scheduledDate: string | null
  seoConfig: SEOConfig
  translations: PostTranslation[]
  createdAt: string
  updatedAt: string
}

export interface MenuItem {
  id: string
  menuId: string
  parentId: string | null
  label: string
  url: string
  sortOrder: number
  depth: number
  icon?: string
  active?: boolean
  children: MenuItem[]
}

export interface Menu {
  id: string
  tenantId: string
  name: string
  location: string
  items: MenuItem[]
  createdAt: string
}

export interface ImageVariants {
  small: string
  medium: string
  large: string
}

export interface MediaFile {
  id: string
  tenantId: string
  filename: string
  mimeType: string
  fileSize: number
  storagePath: string
  altText: string | null
  variants: ImageVariants | null
  createdAt: string
}

export interface TenantLanguage {
  id: string
  tenantId: string
  languageCode: string
  isPrimary: boolean
}

export interface ContactSubmission {
  id: string
  tenantId: string
  name: string
  email: string
  message: string
  notificationStatus: 'pending' | 'sent' | 'failed'
  retryCount: number
  submittedAt: string
}

export type AllowedMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/svg+xml'
  | 'image/gif'
  | 'application/pdf'
  | 'video/mp4'

export interface ContentChangeWebhook {
  event: 'content.created' | 'content.updated' | 'content.published' | 'content.unpublished'
  tenantId: string
  collection: string
  documentId: string
  timestamp: string
}
