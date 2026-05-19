// Re-exportar tipos del backend (se mantiene en sync via OpenAPI)
export type {
  Tenant,
  TenantSettings,
  Domain,
  Page,
  PageTranslation,
  Post,
  PostTranslation,
  ContentStatus,
  SEOConfig,
  Menu,
  MenuItem,
  MediaFile,
  ImageVariants,
  ContactSubmission,
  TenantLanguage,
  AllowedMimeType,
  ContentChangeWebhook,
} from './api.js'

// Tipos internos del frontend

export interface ResolvedTenant {
  tenant: import('./api.js').Tenant
  hostname: string
  primaryLanguage: string
  availableLanguages: string[]
}

export interface PageContext {
  tenant: import('./api.js').Tenant
  hostname: string
  language: string
  availableLanguages: string[]
  primaryLanguage: string
}

export interface MetaTags {
  title: string
  description: string
  canonicalUrl: string
  ogTitle: string
  ogDescription: string
  ogImage: string | null
  ogUrl: string
}

export interface HreflangEntry {
  lang: string
  url: string
}

export interface SitemapEntry {
  url: string
  lastmod: string
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority: number
}
