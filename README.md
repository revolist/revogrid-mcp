# RevoGrid MCP

Hosted Streamable HTTP MCP server for version-aware RevoGrid retrieval. The first version is intentionally read-only and retrieval-focused: tools and resources expose structured docs, examples, feature availability, and migration guidance without trying to become a general agent runtime.

## 10-minute quickstart

The fastest path does not require Docker or Postgres. The server starts against the seeded in-memory catalog by default.

1. Install dependencies.

```bash
cd revogrid-mcp
pnpm install
```

2. Create your local env file.

```bash
cp .env.example .env
```

3. Generate the sample catalog.

```bash
pnpm seed
```

4. Start the server.

```bash
pnpm dev
```

5. In a second terminal, verify the server is up.

```bash
curl http://localhost:8787/health
```

Expected response:

```json
{"status":"ok","service":"revogrid-mcp","backend":"memory"}
```

Default local URL: `http://localhost:8787`

## What is included

- Remote Streamable HTTP MCP endpoint at `/mcp`
- Health endpoint at `/health`
- Structured MCP tools:
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
- Seeded sample catalog with public and Pro-aware records
- Deterministic retrieval with keyword + vector + rerank layers
- Docker Compose for local Postgres + pgvector

## MCP connection URL

- MCP endpoint: `http://localhost:8787/mcp`
- Health endpoint: `http://localhost:8787/health`

## Example MCP usage

Initialize the MCP session:

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

For a full MCP client, point Codex/Cursor/Claude Code/VS Code MCP at:

- `http://localhost:8787/mcp`

Sample tool payloads:

Anonymous docs query:

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

Anonymous feature query:

```json
{
  "name": "resolve_feature_matrix",
  "arguments": {
    "featureName": "pivot"
  }
}
```

Paid Pro feature query:

Use request header `x-revogrid-entitlement: paid_pro` when calling `/mcp`.

## Optional Postgres setup

If you want the local pgvector container available while wiring the real repository layer:

```bash
docker compose -f docker/docker-compose.yml up -d
```

Current default mode still uses `CONTENT_BACKEND=memory` until the Postgres repository TODOs are implemented.

## Real RevoGrid source locations

- Core docs: `../revogrid/docs`
- Core types: `../revogrid/src/types`
- Pro docs and demos: `../revogrid/docs/pro` and `../revogrid-pro/src`

The first version ships with seeded content only. Real ingestion handoff points are marked with `TODO(revogrid-real-ingestion)` in the ingestion pipelines and the Postgres repository.

## Scripts

- `pnpm dev` starts the server
- `pnpm build` builds all packages with `tsc -b`
- `pnpm test` runs Vitest
- `pnpm lint` runs ESLint
- `pnpm seed` writes `data/seed-content.json`
- `pnpm reindex` writes a source inventory + dataset file
- `pnpm backfill:symbols` enriches the generated JSON artifact with derived symbols

## Spec alignment

- Read-only v1 server: yes
- Single Streamable HTTP MCP endpoint at `/mcp`: yes
- `/health` endpoint: yes
- Tools from the original spec: yes
- Resources from the original spec: yes
- Zod-validated tool inputs and outputs: yes
- Anonymous filtering for Pro-only chunks: yes
- Seeded deterministic retrieval path for local development: yes
- Docker Compose for Postgres + pgvector: yes

## TODO markers

- `packages/ingestion/src/pipelines/ingestPublic.ts`
- `packages/ingestion/src/pipelines/ingestPro.ts`
- `packages/ingestion/src/fixtures/seedData.ts`
- `packages/ingestion/src/sources/docs.ts`
- `packages/ingestion/src/sources/examples.ts`
- `packages/ingestion/src/sources/api.ts`
- `packages/ingestion/src/sources/changelog.ts`
- `apps/server/src/repositories/postgresContentRepository.ts`
- `apps/server/src/http/middleware/security.ts`

## Notes for MCP clients

- Anonymous callers never receive Pro-only chunks in tool results.
- The feature matrix can still report that a feature exists and requires Pro.
- Tool outputs are validated structured JSON first and compact text second for agent compatibility.

## Troubleshooting

- If `pnpm dev` fails, rerun `pnpm install` and confirm Node 20+ is active.
- If `/mcp` returns `406`, make sure your client sends `Accept: application/json, text/event-stream`.
- If you want a clean local verification pass, run `pnpm lint && pnpm test && pnpm build`.
