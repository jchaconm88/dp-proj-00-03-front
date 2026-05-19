# Contratos de integración — dp-proj-00-03-front

Versión de contrato: **v1** (header opcional `X-API-Version: 1`)

## Dependencias

| Servicio | Versión mínima | Protocolo |
|----------|----------------|-----------|
| CMS (dp-proj-00-03-back) | v1 | HTTPS REST / JSON |

## Endpoints consumidos

| Método | Ruta CMS | Uso |
|--------|----------|-----|
| GET | `/api/public/resolve-tenant?hostname=` | Resolución multi-tenant por dominio |
| GET | `/api/pages` | Páginas publicadas (`where[tenant]`, `where[slug]`, `where[status]=published`) |
| GET | `/api/posts` | Posts publicados |
| GET | `/api/menus` | Menús por ubicación |
| GET | `/api/tenant-languages` | Idiomas del tenant |
| GET | `/api/public/templates/{tenantId}/{templateId}` | Bundle: `html`, `baseUrl`, `manifest`, `partials` |
| POST | `/api/contact-submissions` | Formulario de contacto |

## Webhook entrante

| Método | Ruta local | Secreto |
|--------|------------|---------|
| POST | `/api/webhooks/rebuild` | `WEBHOOK_SECRET` (HMAC SHA-256 en `X-Signature-256`) |

Eventos: `content.created`, `content.updated`, `content.published`, `content.unpublished`. Colecciones: `pages`, `posts`, `domains`, `html-templates`.

## Variables de entorno

Ver `.env.example`: `CMS_URL`, `WEBHOOK_SECRET`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`.
