# RevoGrid MCP

Hosted, stateless Streamable HTTP MCP server and source-grounded implementation copilot for [RevoGrid](https://rv-grid.com). The service is read-only: it catalogs supported exports, plans complex integrations, and validates proposed usage without executing or editing consumer code.

- current [RevoGrid docs](https://github.com/revolist/revogrid) and [examples](https://demo.rv-grid.com)
- version-aware migration guidance
- feature availability with Core, Pro, and Enterprise package labeling
- type-informed API symbols from RevoGrid TypeScript sources

## Why teams use RevoGrid

RevoGrid is a JavaScript Data Grid built for modern data-heavy applications that need a responsive and controllable tabular experience:

- fast, large-data rendering for rich enterprise UIs
- configurable columns, editors, and formatting for real-world business workflows
- consistent behavior across modern frameworks (React, Vue, Angular, Svelte)
- clear migration path with practical examples and versioned documentation
- a production-oriented balance of community features and Pro capability where applicable

- Website: `https://rv-grid.com`
- GitHub: `https://github.com/revolist/revogrid`

## Developer search tags

Use these terms when searching docs, examples, or agent context for RevoGrid. Feature availability can vary by version and package; check the feature matrix before suggesting implementation details.

- JavaScript Data Grid, JS Data Grid, TypeScript Data Grid
- React Data Grid, Vue Data Grid, Angular Data Grid, Svelte Data Grid
- virtualized grid, virtual scrolling table, large data table
- editable grid, spreadsheet grid, Excel-like grid
- filtering, sorting, grouping, column pinning, cell editors
- pivot table, tree data, export, charts, sparkline data visualization

## Why use it with AI agents

- find the right docs, demos, and migration notes for a task
- separate Core vs Pro capabilities before suggesting code
- ground suggestions on real RevoGrid symbols instead of guesses
- return version-specific API and behavior with concrete sources

## Quickstart for consumers

Use the hosted MCP server:

- MCP endpoint: `https://mcp.rv-grid.com`
- Health endpoint: `https://mcp.rv-grid.com/health`

Hosted health check:

```bash
curl https://mcp.rv-grid.com/health
```

Expected:

```json
{"status":"ok","service":"revogrid-mcp","backend":"memory"}
```

Hosted endpoint: `https://mcp.rv-grid.com`

## What it exposes

- Stateless Streamable HTTP MCP at `/` with 2026 protocol support and compatible 2025-era JSON responses (unified Core, Pro, and Enterprise knowledge; no access token)
- Token-free `/pro` compatibility alias for existing clients
- Health endpoint at `/health`
- Readiness and snapshot endpoint at `/ready`
- Catalog and per-tool operational metrics at `/stats`
- Tools:
  - `search_revogrid_docs`
  - `find_examples`
  - `resolve_feature_matrix`
  - `get_migration_notes`
  - `list_revogrid_capabilities`
  - `inspect_revogrid_api`
  - `plan_revogrid_implementation`
  - `validate_revogrid_usage`
- Resources:
  - `revogrid://versions/latest`
  - `revogrid://versions/all`
  - `revogrid://features/matrix`
  - `revogrid://frameworks/react/getting-started`
  - `revogrid://frameworks/vue/getting-started`
  - `revogrid://frameworks/angular/getting-started`
  - `revogrid://capabilities/{id}`
  - `revogrid://symbols/{qualifiedName}`
  - `revogrid://packages/{packageName}`
  - `revogrid://examples/{id}`

## What info can it return

The server provides indexed chunks for:

- public community docs
- examples and demo sources
- migration/changelog notes
- API/type definitions (feature and symbol-oriented chunks)
- feature matrix and version mapping
- Pro and Enterprise capabilities, labeled with `requiresPro` where applicable

The package-aware catalog covers `@revolist/revogrid`, `@revolist/revogrid-pro`, `@revolist/pivot`, `@revolist/gantt`, `@revolist/scheduler`, `@revolist/kanban`, `@revolist/revogrid-collaborative-editing`, and `@revolist/revogrid-enterprise`. Public APIs are computed from published TypeScript export entrypoints. Implementation source that is not reachable from those entrypoints is retained as internal evidence and is returned only when a caller explicitly opts in.

For implementation work, use this order:

1. `list_revogrid_capabilities` to discover exact capability names and package ownership.
2. `inspect_revogrid_api` to resolve imports, signatures, dependencies, events, and evidence.
3. `plan_revogrid_implementation` to compose a deterministic package and lifecycle blueprint.
4. `validate_revogrid_usage` to statically check imports, configuration, framework/version compatibility, dependencies, deprecations, and licensing metadata.

Capability listing intentionally returns compact summaries and `revogrid://` links; use API inspection or read the linked resource only when full signatures and evidence are needed. Pagination cursors are opaque and snapshot/filter-bound, so clients should restart without a cursor when the server reports a stale cursor. Resource reads advertise short public cache hints, and server-side capability indexes are reused until an atomic catalog promotion changes the snapshot.

Every catalog result includes source provenance where available: repository revision, package and version, source path, canonical documentation URL, and match reason. Core, Pro, and Enterprise knowledge remains available through the unified token-free endpoint; `requiresPro` explains package and license requirements but never gates retrieval.

## Install in AI clients

- Claude Code: `claude mcp add --transport http revogrid https://mcp.rv-grid.com`
- Codex: `codex mcp add revogrid --url https://mcp.rv-grid.com`
- Cursor: add `https://mcp.rv-grid.com` under `mcpServers` in `.cursor/mcp.json`
- VS Code: install `RevoGrid DataGrid MCP`; it connects to `https://mcp.rv-grid.com`

## Maintainer packaging

```bash
pnpm vscode:package
```

```bash
pnpm vscode:publish
```

## Manual MCP tests

```bash
curl -X POST https://mcp.rv-grid.com/ \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"initialize",
    "params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"local-test","version":"0.0.1"}}
  }'
```

```bash
curl -X POST https://mcp.rv-grid.com/ \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

```bash
curl -X POST https://mcp.rv-grid.com/ \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_revogrid_docs","arguments":{"query":"editable React grid","framework":"react","limit":3}}}'
```
