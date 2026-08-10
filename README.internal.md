# RevoGrid MCP (Internal)

⚠️ Internal use only: operational secrets, auth details, and environment structure for maintainers.  
Do not publish this document to anonymous users.

This file contains operational security and environment layout details and is intended for internal use.

## Unified MCP routes

The server exposes:
- `/` with combined Core, Pro, and Enterprise knowledge
- `/pro` as a token-free compatibility alias with the same catalog

Clients should use `http://localhost:8787/`. `requiresPro` remains descriptive
metadata for package and license guidance; it is not an MCP access-control flag.

## Re-index webhook and webhook tokens

Protected endpoint:
- **Endpoint:** `POST /hooks/reindex`
- **Auth:** `X-Webhook-Token: <your-token>`

The endpoint returns `202 Accepted` as soon as background reindexing starts. Check
the app logs for `reindex_hook_completed` or `reindex_hook_failed`. A request made
while a reindex is already active returns `409 Conflict`; callers should not retry
until the current job finishes.

Examples:

```bash
curl -X POST http://localhost:8787/hooks/reindex \
     -H "X-Webhook-Token: <your-webhook-token>"

curl -X POST http://localhost:8787/hooks/reindex \
     -H "Content-Type: application/json" \
     -H "X-Webhook-Token: <your-webhook-token>" \
     -d '{"updateSources":true}'
```

For private GitHub sources:
- `SOURCE_UPDATE_GITHUB_TOKEN` (preferred)
- fallback `GITHUB_TOKEN`

`WEBHOOK_TOKEN` is required. Generate and store a strong random value independently
from client-facing MCP configuration.

## Source resolution and layout

Default inputs:
- `external/revogrid`
- `external/revogrid-pro`

Optional explicit overrides:
- `REVOGRID_SOURCE_ROOT`
- `REVOGRID_PRO_SOURCE_ROOT`

Fallback:
- sibling checkouts at `../revogrid` and `../revogrid-pro`

Override precedence:
1. explicit env roots
2. `external/` submodules
3. sibling repos

Update sources:

```bash
pnpm sources:update
pnpm sources:update -- --remote
```

## Environment variables

### App runtime

- `NODE_ENV` (`development`, `test`, `production`)
- `PORT` (default `8787`)
- `HOST` (default `0.0.0.0`)
- `LOG_LEVEL` (`debug`, `info`, `warn`, `error`)

### Retrieval backend

- `CONTENT_BACKEND` (`memory`, `postgres`)
- `POSTGRES_HOST` (default `localhost`)
- `POSTGRES_PORT` (default `5432`)
- `POSTGRES_DB` (example: `revogrid_mcp`)
- `POSTGRES_USER` (example: `postgres`)
- `POSTGRES_PASSWORD` (example: `postgres`)
- `PGVECTOR_TABLE` (default `document_chunks`)
- `REINDEX_OUTPUT` (default `data/catalog.json`)

### Auth and security

- `ENABLE_ORIGIN_VALIDATION` (`true|false`)
- `ALLOWED_ORIGINS` (comma-separated list)
- `ENABLE_RATE_LIMITING` (`true|false`)
- `RATE_LIMIT_MAX` (default `60`)
- `RATE_LIMIT_WINDOW_MS` (default `60000`)
- `WEBHOOK_TOKEN`
- `SOURCE_UPDATE_GITHUB_TOKEN` (optional)

### Docker Compose / container wiring

- `POSTGRES_HOST` (inside compose: `postgres`)
- `POSTGRES_PORT` (inside compose: `5432`)
- `LOCAL_REVOGRID_SOURCE_PATH` (default `./external/revogrid`)
- `LOCAL_REVOGRID_PRO_SOURCE_PATH` (default `./external/revogrid-pro`)
- `APP_PUBLISHED_PORT` (default `8787`)
- `TRAEFIK_ENABLE` (`true|false`)
- `TRAEFIK_HOST`
- `TRAEFIK_ENTRYPOINTS`
- `TRAEFIK_TLS`

## Reindexing and persistence

Rebuild catalog:

```bash
pnpm reindex
```

Persist to Postgres:

1. Start PostgreSQL
2. `CONTENT_BACKEND=postgres`
3. `pnpm reindex`

Docker commands:

```bash
docker compose up -d postgres
docker compose up -d app
docker compose --profile jobs run --rm reindex
```

## Pro and private source onboarding

Pro sources are part of the unified catalog and should retain `requiresPro: true`
metadata. Truly private or internal sources still require a dedicated, opt-in adapter
under `packages/ingestion/src/sources/`; do not treat `requiresPro` as a secrecy or
authorization boundary.
