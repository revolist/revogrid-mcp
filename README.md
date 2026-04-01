# RevoGrid MCP

Hosted Streamable HTTP MCP server for version-aware RevoGrid retrieval. The server is read-only in v1 and focuses on structured docs, examples, feature availability, migration notes, and API symbols.

The goal is to make AI coding tools reliably useful with RevoGrid. Instead of guessing from stale training data, the agent can query:

- current RevoGrid docs and examples
- migration guidance between versions
- feature availability and Pro gating
- instruction-rich API chunks derived from RevoGrid TypeScript types

## Why use it with AI agents

This MCP is designed for tools like Codex, Cursor, Claude Code, and VS Code MCP clients.

It helps agents:

- find the right RevoGrid doc or demo for a task
- distinguish Core vs Pro capabilities before suggesting code
- ground answers in real RevoGrid types instead of hand-wavy guesses
- use version-aware migration notes when upgrading code
- pull working examples instead of inventing component setup

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
- Instruction-rich API chunks generated from RevoGrid TypeScript definitions
- Deterministic fallback embeddings for local development
- Postgres + pgvector persistence for catalog chunks and metadata

## Install in AI clients

Once the server is running locally, use `http://localhost:8787/mcp`.

### Claude Code

```bash
claude mcp add --transport http revogrid http://localhost:8787/mcp
```

### Codex

```bash
codex mcp add revogrid --url http://localhost:8787/mcp
```

### Cursor

Open MCP settings and add this to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "RevoGrid": {
      "url": "http://localhost:8787/mcp",
      "type": "http"
    }
  }
}
```

### VS Code

Open `MCP: Add Server...` and choose a remote HTTP MCP server, or add this to `.vscode/mcp.json`:

```json
{
  "servers": {
    "RevoGrid MCP": {
      "url": "http://localhost:8787/mcp",
      "type": "http"
    }
  },
  "inputs": []
}
```

## Good prompts for agents

These work well in Codex, Cursor, Claude Code, or other MCP-capable clients.

### Setup and examples

- `Create a React RevoGrid with editable cells. Use the best matching RevoGrid examples and docs.`
- `Find the best RevoGrid example for a custom column type and implement it in Vue.`
- `Show me the getting started resources for Angular RevoGrid.`

### Feature checks

- `Does RevoGrid support beforeedit? Show the relevant docs and type information.`
- `Does pivot exist in this version, and is it Core or Pro?`
- `What is the best public fallback for pivot if Pro is unavailable?`

### Migration work

- `I am upgrading RevoGrid from 4.x to 5.x. What breaking changes matter for editing and event names?`
- `Find renamed symbols between RevoGrid 4.x and 5.x.`

### Type-guided coding

- `Show me the relevant RevoGrid types for ColumnRegular and BeforeEdit before writing code.`
- `Use RevoGrid types as the source of truth for grid configuration and event names.`

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

### Docker Compose commands

Start Postgres only:

```bash
docker compose up -d postgres
```

Build and start the MCP server container:

```bash
docker compose up -d app
```

Run reindex as a one-off container job:

```bash
docker compose --profile jobs run --rm reindex
```

Run seed as a one-off container job:

```bash
docker compose --profile jobs run --rm seed
```

Notes:

- `seed` is an alias for the same real ingestion flow as `reindex`
- `data/catalog.json` is written to the local `./data` folder through a bind mount
- inside Docker Compose, `DATABASE_URL` is automatically pointed at the `postgres` service
- Docker Compose mounts your local source repos read-only into the container
- by default it expects sibling paths `../revogrid` and `../revogrid-pro`
- override those with `LOCAL_REVOGRID_SOURCE_PATH` and `LOCAL_REVOGRID_PRO_SOURCE_PATH` in `.env` if needed
- inside the container, indexing uses `/app/external/revogrid` and `/app/external/revogrid-pro`

### Traefik support

The `app` service includes optional Traefik labels controlled by `.env`.

To enable Traefik routing:

```bash
TRAEFIK_ENABLE=true
TRAEFIK_HOST=revogrid-mcp.localhost
TRAEFIK_ENTRYPOINTS=web
TRAEFIK_TLS=false
```

Then start the app:

```bash
docker compose up -d app
```

With those settings, Traefik can route requests like:

- `http://revogrid-mcp.localhost/health`
- `http://revogrid-mcp.localhost/mcp`

Notes:

- direct port publishing still works through `APP_PUBLISHED_PORT`
- if your Traefik setup uses a shared external Docker network, attach this service to that network in your local compose override
- if you need TLS cert resolvers or middleware chains, add those labels in your deployment-specific compose override

## MCP connection URL

- MCP endpoint: `http://localhost:8787/mcp`
- Health endpoint: `http://localhost:8787/health`

## Manual MCP testing

### Initialize

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

### List tools

```bash
curl -X POST http://localhost:8787/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc":"2.0",
    "id":2,
    "method":"tools/list",
    "params":{}
  }'
```

### Call `search_revogrid_docs`

```bash
curl -X POST http://localhost:8787/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc":"2.0",
    "id":3,
    "method":"tools/call",
    "params":{
      "name":"search_revogrid_docs",
      "arguments":{
        "query":"editable React grid",
        "framework":"react",
        "limit":3
      }
    }
  }'
```

### Read a resource

```bash
curl -X POST http://localhost:8787/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc":"2.0",
    "id":4,
    "method":"resources/read",
    "params":{
      "uri":"revogrid://versions/all"
    }
  }'
```

### Test Pro responses

Send the entitlement header:

```bash
-H 'x-revogrid-entitlement: paid_pro'
```

Example:

```bash
curl -X POST http://localhost:8787/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'x-revogrid-entitlement: paid_pro' \
  -d '{
    "jsonrpc":"2.0",
    "id":5,
    "method":"tools/call",
    "params":{
      "name":"search_revogrid_docs",
      "arguments":{
        "query":"pivot",
        "limit":5
      }
    }
  }'
```

## Postman testing

Use a collection variable:

- `baseUrl = http://localhost:8787`

Set collection headers:

- `Content-Type: application/json`
- `Accept: application/json, text/event-stream`

Recommended Postman requests:

1. `GET {{baseUrl}}/health`
2. `POST {{baseUrl}}/mcp` with `initialize`
3. `POST {{baseUrl}}/mcp` with `tools/list`
4. `POST {{baseUrl}}/mcp` with `tools/call` for `search_revogrid_docs`
5. `POST {{baseUrl}}/mcp` with `tools/call` for `find_examples`
6. `POST {{baseUrl}}/mcp` with `tools/call` for `resolve_feature_matrix`
7. `POST {{baseUrl}}/mcp` with `tools/call` for `get_migration_notes`
8. `POST {{baseUrl}}/mcp` with `resources/read`

Good manual test queries:

- `editable React grid`
- `beforeedit`
- `custom column type`
- `pivot`
- `upgrade from v4 to v5`

## Commands

- `pnpm dev` starts the server
- `pnpm start` starts the built server
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
- type-informed API retrieval from RevoGrid source: yes

## Troubleshooting

- If `pnpm reindex` finds zero source files, run `git submodule update --init --recursive` and confirm `external/revogrid` plus `external/revogrid-pro` exist.
- If you are using sibling repos instead of nested submodules, set `REVOGRID_SOURCE_ROOT` and `REVOGRID_PRO_SOURCE_ROOT` explicitly.
- If `/mcp` returns `406`, make sure the client sends `Accept: application/json, text/event-stream`.
- If you want a clean verification pass, run `pnpm lint`, `pnpm test`, and `pnpm build`.
