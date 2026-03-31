# RevoGrid MCP

Hosted Streamable HTTP MCP server for version-aware RevoGrid retrieval. The server is read-only in v1 and focuses on structured docs, examples, feature availability, migration notes, and API symbols.

## 10-minute quickstart

These steps work whether `revogrid-mcp` is the main checkout or a submodule inside a larger workspace.

1. Install nested source submodules.

```bash
cd revogrid-mcp
git submodule update --init --recursive
```

2. Install dependencies.

```bash
pnpm install
```

3. Create a local env file.

```bash
cp .env.example .env
```

4. Build the real catalog from `external/revogrid` and `external/revogrid-pro`.

```bash
pnpm reindex
```

5. Start the server.

```bash
pnpm dev
```

6. Verify the health endpoint.

```bash
curl http://localhost:8787/health
```

Expected response:

```json
{"status":"ok","service":"revogrid-mcp","backend":"memory"}
```

Default local base URL: `http://localhost:8787`

## What is included

- Streamable HTTP MCP endpoint at `/mcp`
- Health endpoint at `/health`
- MCP tools:
  - `search_revogrid_docs`
  - `find_examples`
  - `resolve_feature_matrix`
  - `get_migration_notes`
- MCP resources:
  - `revogrid://versions/latest`
  - `revogrid://versions/all`
  - `revogrid://features/matrix`
  - `revogrid://frameworks/react/getting-started`
  - `revogrid://frameworks/vue/getting-started`
  - `revogrid://frameworks/angular/getting-started`
- Real ingestion pipeline for:
  - public docs
  - examples and demo sources
  - migration/changelog pages
  - public and Pro API/type sources
- Deterministic fallback embeddings for local development
- Postgres + pgvector persistence for catalog chunks and metadata

## Source layout

By default the ingestion pipeline reads from:

- `external/revogrid`
- `external/revogrid-pro`

If you are running from a larger mono-workspace that already has sibling checkouts, the resolver can also fall back to:

- `../revogrid`
- `../revogrid-pro`

You can override either root explicitly:

- `REVOGRID_SOURCE_ROOT=/absolute/path/to/revogrid`
- `REVOGRID_PRO_SOURCE_ROOT=/absolute/path/to/revogrid-pro`

Resolution order is:

1. `REVOGRID_SOURCE_ROOT` / `REVOGRID_PRO_SOURCE_ROOT`
2. nested submodules in `external/`
3. sibling repos one level above `revogrid-mcp`

## Reindexing and persistence

Generate a fresh catalog artifact:

```bash
pnpm reindex
```

This writes `data/catalog.json` by default and records:

- discovered source inventory
- normalized `DocumentChunk` records
- derived versions
- derived features
- derived migration notes

Persist the catalog to Postgres instead of memory:

1. Start Postgres.

```bash
docker compose -f docker-compose.yml up -d
```

2. Set `CONTENT_BACKEND=postgres` in `.env`.

3. Reindex again so the catalog is written to Postgres.

```bash
pnpm reindex
```

4. Start the server.

```bash
pnpm dev
```

## MCP connection URL

- MCP endpoint: `http://localhost:8787/mcp`
- Health endpoint: `http://localhost:8787/health`

Example initialize request:

```bash
curl -X POST http://localhost:8787/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"initialize",
    "params":{
      "protocolVersion":"2024-11-05",
      "capabilities":{},
      "clientInfo":{"name":"local-test","version":"0.0.1"}
    }
  }'
```

Example anonymous tool payload:

```json
{
  "name": "search_revogrid_docs",
  "arguments": {
    "query": "editable React grid",
    "framework": "react",
    "limit": 3
  }
}
```

Example paid Pro request:

- send `x-revogrid-entitlement: paid_pro` to `/mcp`

## Commands

- `pnpm dev` starts the server
- `pnpm build` builds the workspace
- `pnpm test` runs Vitest
- `pnpm lint` runs ESLint
- `pnpm reindex` rebuilds the real catalog artifact and optionally persists it
- `pnpm seed` aliases the same real ingestion flow for compatibility
- `pnpm backfill:symbols` enriches a generated artifact with additional derived symbols

## Future Pro/private sources

Add future Pro or private sources carefully:

1. Create a dedicated source adapter in `packages/ingestion/src/sources/` instead of widening an existing public adapter.
2. Mark every private chunk with `requiresPro: true` during normalization.
3. Keep source-root wiring opt-in through explicit env vars or a dedicated submodule path.
4. Add tests that prove anonymous callers cannot see the new chunks through search, examples, feature resolution, or resources.
5. Keep private-source business rules in ingestion and retrieval layers, not in transport handlers.

Good candidates for future private wiring:

- a new adapter like `privateDocs.ts`
- a separate env var such as `REVOGRID_PRIVATE_SOURCE_ROOT`
- a separate ingestion command that runs only in trusted environments

## Extension points

- `packages/ingestion/src/sources/_shared.ts`
- `packages/ingestion/src/sources/docs.ts`
- `packages/ingestion/src/sources/changelog.ts`
- `packages/ingestion/src/sources/api.ts`
- `src/auth/authenticator.ts`
- `src/repositories/postgresContentRepository.ts`
- `src/http/middleware/security.ts`

## Spec alignment

- read-only MCP server: yes
- single Streamable HTTP endpoint at `/mcp`: yes
- health endpoint at `/health`: yes
- MCP tool contracts unchanged: yes
- MCP resources from the original spec: yes
- real ingestion instead of fake runtime content: yes
- Postgres + pgvector persistence: yes
- deterministic local retrieval path: yes
- anonymous callers filtered from Pro chunks: yes

## Troubleshooting

- If `pnpm reindex` finds zero source files, run `git submodule update --init --recursive` and confirm `external/revogrid` plus `external/revogrid-pro` exist.
- If you are using sibling repos instead of nested submodules, set `REVOGRID_SOURCE_ROOT` and `REVOGRID_PRO_SOURCE_ROOT` explicitly.
- If `/mcp` returns `406`, make sure the client sends `Accept: application/json, text/event-stream`.
- If you want a clean verification pass, run `pnpm lint`, `pnpm test`, and `pnpm build`.
