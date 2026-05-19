# dp-proj-00-03-front

Frontend Astro SSG/SSR multi-tenant para la plataforma dp-proj-00-03.

## Tecnología

- **Astro 4.x** — Framework web con modo híbrido SSG/SSR
- **Firebase Hosting** — CDN global para contenido pre-renderizado
- **Cloudflare Turnstile** — CAPTCHA para formularios de contacto

## Arquitectura multi-tenant

Un único sitio Astro SSR recibe todos los dominios personalizados de los tenants.
El middleware resuelve el tenant activo a partir del `host` de la petición.

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

## Tests

```bash
pnpm test              # Todos los tests
pnpm test:properties   # Solo property tests
```
