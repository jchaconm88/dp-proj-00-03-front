# Secretos de GitHub (repositorio front)

Pipeline: tests → imagen Docker → **Cloud Run** (SSR) → **Firebase Hosting** (estáticos + rewrite a Cloud Run).

## Infraestructura (CI)

| Secret | Uso |
|--------|-----|
| `GCP_SA_KEY` | JSON de `dp-proj-00-03-ci-deploy@...` (misma SA que back/infra) |
| `GCP_PROJECT_ID` | `terraform output -raw gcp_project_id` |
| `GCP_REGION` | ej. `us-central1` (debe coincidir con `firebase.json` rewrite `run.region`) |

## Build Docker + runtime SSR

Inyectados como **build-args** (quedan en `import.meta.env` del bundle Astro):

| Secret | Uso |
|--------|-----|
| `CMS_URL` | URL pública del CMS (`terraform output -raw cms_url`) |
| `TURNSTILE_SITE_KEY` | Clave pública Turnstile |
| `WEBHOOK_SECRET` | Firma webhook rebuild |
| `TURNSTILE_SECRET_KEY` | Validación CAPTCHA en `/api/contact` |
| `DATABASE_URL` | Runtime Cloud Run — mismo `app_user` que el CMS (`terraform output -raw neon_database_connection_string`). Solo `SELECT` en `published_content_versions` para ETag/304 temprano. |

## Firebase Hosting

| Secret | Uso |
|--------|-----|
| `FIREBASE_HOSTING_SITE` | `terraform output -raw firebase_hosting_site` |
| `FIREBASE_PROJECT_ID` | Mismo que `GCP_PROJECT_ID` del bloque |

## Coordinación con el back

Tras el primer deploy del front:

| Secret (repo **back**) | Valor |
|------------------------|-------|
| `FRONTEND_WEBHOOK_URL` | `https://<FIREBASE_HOSTING_SITE>.web.app/api/webhooks/rebuild` |
| `FRONTEND_WEBHOOK_SECRET` | Igual que `WEBHOOK_SECRET` del front |

## Orden de despliegue inicial

1. `terraform apply` en infra (módulos `firebase_hosting` + `cloud_run_front`).
2. Push a **back** (`main`) → migración `published_content_versions` + CMS en Cloud Run.
3. Configurar secretos del **front** (tabla anterior), incluido `DATABASE_URL`.
4. Push a **front** (`main`) → imagen → Cloud Run → Hosting.

Tras publicar contenido en el CMS, el front puede responder **304** sin llamar al CMS si `If-None-Match` coincide con la versión en BD.

## Verificación

```bash
SITE="<firebase_hosting_site>"
curl -s "https://${SITE}.web.app/api/health"
# {"status":"ok","component":"frontend",...}
```
