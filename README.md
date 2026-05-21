# dp-proj-00-03-front

Frontend Astro SSG/SSR multi-tenant para la plataforma dp-proj-00-03.

## Tecnología

- **Astro 4.x** — Framework web con modo híbrido SSG/SSR
- **Firebase Hosting** — CDN global para contenido pre-renderizado
- **Cloudflare Turnstile** — CAPTCHA para formularios de contacto

## Arquitectura multi-tenant

Un único sitio Astro SSR recibe todos los dominios personalizados de los tenants.
El middleware resuelve el tenant activo a partir del `host` de la petición.

### CDN (req. 14.4)

El HTML se cachea en **Firebase Hosting CDN** con `s-maxage=120` y `Vary: Host, X-Forwarded-Host` (cada dominio tiene su propia copia). Al publicar en el CMS, el webhook invalida caché en memoria, incrementa la versión CDN (`ETag`) y precalienta contenido. Cloud Run puede mantener `min_instances=0`.

```
dominio-a.com ─┐
dominio-b.com ─┼──→ Firebase Hosting (1 sitio) ──→ Astro SSR ──→ resolveTenant(host)
dominio-c.com ─┘
```

## Dependencias externas

| Repositorio | Interface consumida | Versión mínima | Protocolo |
|-------------|--------------------|--------------  |-----------|
| dp-proj-00-03-back | REST API del CMS (`GET /api/...`) | v1 | HTTP REST/JSON |
| dp-proj-00-03-back | Webhook rebuild (`POST /api/webhooks/rebuild`) | v1 | HTTP POST |

## Contratos consumidos

- `GET /api/domains?hostname=X` → resolver tenant por dominio
- `GET /api/pages?tenant=X&slug=Y` → obtener página
- `GET /api/posts?tenant=X` → listar posts
- `GET /api/menus?tenant=X` → obtener menú
- `POST /api/contact-forms` → enviar formulario de contacto

## Estructura

```
src/
├── middleware/        # Resolución de tenant por hostname
├── lib/               # Clientes, SEO, i18n, cache
├── pages/             # Rutas Astro (SSG + SSR)
├── layouts/           # Layouts base con SEO
├── components/        # Componentes reutilizables
└── types/             # Tipos TypeScript
tests/
└── properties/        # Property-based tests con fast-check
```

## Desarrollo local

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

### Dev vs preview (build de producción)

| Comando | Cuándo | Multi-dominio local |
|---------|--------|---------------------|
| `pnpm dev` | Desarrollo diario | `http://mi-cliente.local:4321/...` (entrada en `hosts`) |
| `pnpm build && pnpm preview` | Probar el build SSR | Misma URL; deja la terminal de preview **abierta** |
| `pnpm build && pnpm start` | Servidor Node (`dist/server`) | `HOST=0.0.0.0 PORT=4321` si hace falta en Windows |

Si `curl` a `127.0.0.1:4321` falla pero `localhost` respondía antes, suele ser que **no hay proceso escuchando** (cerraste `preview`) o el servidor solo estaba en `localhost` — `astro.config.mjs` usa `server.host: '0.0.0.0'` para dev y preview.

Edita `.env.local` según la tabla de [Variables de entorno](#variables-de-entorno).

## Variables de entorno

Plantilla: [`.env.example`](./.env.example). En local, copia a `.env.local`.

Astro resuelve `import.meta.env.*` en **tiempo de build** (`pnpm build`). En producción deben estar definidas antes del build (CI o despliegue manual).

### Aplicación (`.env.local` / build)

| Variable | Obligatorio | Descripción | Origen |
|----------|-------------|-------------|--------|
| `CMS_URL` | Sí | URL base del CMS (Payload en Cloud Run). Sin barra final. Usada por SSR, plantillas, media y proxy de contacto. | Local: `http://localhost:3000`. Prod: `terraform output -raw cms_url` en `dp-proj-00-03-infra` (misma URL que `PAYLOAD_PUBLIC_SERVER_URL` en el back). |
| `WEBHOOK_SECRET` | Recomendado | Secreto compartido para validar `POST /api/webhooks/rebuild` (cabecera `X-Signature-256`, HMAC SHA-256). | Generar una vez (ej. `openssl rand -hex 32`). Debe coincidir con `FRONTEND_WEBHOOK_SECRET` del repo back y, opcionalmente, con `tenant.settings.frontendWebhookSecret` en el CMS. |
| `TURNSTILE_SITE_KEY` | Si hay formularios | Clave **pública** de Cloudflare Turnstile (widget en el navegador). | [Cloudflare Dashboard](https://dash.cloudflare.com) → Turnstile → widget del dominio. |
| `TURNSTILE_SECRET_KEY` | Si hay formularios | Clave **secreta**; el front valida el token en `/api/contact` antes de reenviar al CMS. | Mismo widget Turnstile → Secret key. Mismo valor que `TURNSTILE_SECRET_KEY` en el back. |
| `NODE_ENV` | No | `development` en local; `production` en build de prod. | Por defecto según el comando (`pnpm dev` / `pnpm build`). |
| `CMS_API_KEY` | No | Reservada en `.env.example`; **no se usa** en el código actual. | — |

**Mínimo en local** (alineado con el back en dev):

```env
CMS_URL=http://localhost:3000
WEBHOOK_SECRET=dev-webhook-secret
NODE_ENV=development
```

En el back, `FRONTEND_WEBHOOK_URL=http://localhost:4321/api/webhooks/rebuild` y `FRONTEND_WEBHOOK_SECRET` con el mismo valor que `WEBHOOK_SECRET`.

### GitHub Secrets (CI/CD en `main`)

Configurar en **Settings → Secrets and variables → Actions** del repo `dp-proj-00-03-front`. El workflow [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) los consume así:

| Secret | Job | Uso |
|--------|-----|-----|
| `CMS_URL` | test (build) | URL pública del CMS en producción. |
| `TURNSTILE_SITE_KEY` | test (build) | Clave pública Turnstile. |
| `GCP_SA_KEY` | deploy | JSON de la cuenta de servicio de deploy (misma SA que infra/back). |
| `GCP_PROJECT_ID` | deploy | Proyecto GCP del bloque. |
| `GCP_REGION` | deploy | Región Cloud Run y rewrite Firebase (`us-central1`). |
| `FIREBASE_PROJECT_ID` | deploy | Igual que `GCP_PROJECT_ID`. |
| `FIREBASE_HOSTING_SITE` | deploy | `terraform output -raw firebase_hosting_site`. |

Detalle: [`.github/SECRETS.md`](./.github/SECRETS.md).

### Producción (arquitectura)

```
Visitante → Firebase Hosting (dist/client + CDN)
         → rewrite ** → Cloud Run dp-proj-00-03-front (Astro SSR, dist/server)
         → Payload CMS (Cloud Run)
```

**Recomendado añadir también** al paso `pnpm build` del workflow (hoy solo inyecta `CMS_URL` y `TURNSTILE_SITE_KEY`):

| Secret | Uso |
|--------|-----|
| `WEBHOOK_SECRET` | Firma del webhook de rebuild. |
| `TURNSTILE_SECRET_KEY` | Validación CAPTCHA en `/api/contact`. |

### Coordinación con el back (repo `dp-proj-00-03-back`)

Tras el primer deploy del front, configura en GitHub del **back** (ver [`dp-proj-00-03-back/.github/SECRETS.md`](../dp-proj-00-03-back/.github/SECRETS.md)):

| Secret back | Valor |
|-------------|-------|
| `FRONTEND_WEBHOOK_URL` | `https://<sitio-firebase>.web.app/api/webhooks/rebuild` (URL del sitio tras deploy; `terraform output firebase_hosting_site` en infra). |
| `FRONTEND_WEBHOOK_SECRET` | Mismo valor que `WEBHOOK_SECRET` del front. |

Opcional por tenant en Payload: **Tenant → settings** → `frontendWebhookUrl` y `frontendWebhookSecret`.

### Despliegue manual

```bash
export CMS_URL=https://tu-cms.run.app
export WEBHOOK_SECRET=...
export TURNSTILE_SITE_KEY=...
export TURNSTILE_SECRET_KEY=...
# Producción: usar CI (recomendado) o manualmente:
# docker build + gcloud run deploy dp-proj-00-03-front + firebase deploy --only hosting
# Ver .github/SECRETS.md y .github/workflows/deploy.yml
```

Guía general: [`GUIA-OPERACION.md`](../GUIA-OPERACION.md) (Parte 2: Desplegar).

## Tests

```bash
pnpm test              # Todos los tests
pnpm test:properties   # Solo property tests
```
