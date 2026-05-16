# RevoGrid MCP

Hosted Streamable HTTP MCP server for version-aware [RevoGrid](https://rv-grid.com) retrieval. RevoGrid is a JS Data Grid for high-performance, spreadsheet-like tables in modern web apps. In v1 this MCP server is read-only and focuses on:

- current [RevoGrid docs](https://github.com/revolist/revogrid) and [examples](https://demo.rv-grid.com)
- version-aware migration guidance
- feature availability and Pro gating
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

- Streamable HTTP MCP at `/` (community content)
- Streamable HTTP MCP at `/pro` (community + Pro content, auth behavior documented internally)
- Health endpoint at `/health`
- Tools:
  - `search_revogrid_docs`
  - `find_examples`
  - `resolve_feature_matrix`
  - `get_migration_notes`
- Resources:
  - `revogrid://versions/latest`
  - `revogrid://versions/all`
  - `revogrid://features/matrix`
  - `revogrid://frameworks/react/getting-started`
  - `revogrid://frameworks/vue/getting-started`
  - `revogrid://frameworks/angular/getting-started`

## What info can it return

The server provides indexed chunks for:

- public community docs
- examples and demo sources
- migration/changelog notes
- API/type definitions (feature and symbol-oriented chunks)
- feature matrix and version mapping
- Pro-capable capabilities (subject to route/auth controls)

## Install in AI clients

- Claude Code: `claude mcp add --transport http revogrid https://mcp.rv-grid.com`
- Codex: `codex mcp add revogrid --url https://mcp.rv-grid.com`
- Cursor: add `https://mcp.rv-grid.com` under `mcpServers` in `.cursor/mcp.json`
- VS Code:
  - Public package: `RevoGrid DataGrid MCP`, endpoint `https://mcp.rv-grid.com`
  - Pro package: `RevoGrid DataGrid MCP Pro`, endpoint `https://mcp.rv-grid.com/pro`

The public VS Code package does not prompt for a bearer token. Install the Pro package only for Pro-gated retrieval; that package asks for a bearer token before connecting to `/pro`.

## Maintainer packaging

```bash
pnpm vscode:package
pnpm vscode:package:pro
```

```bash
pnpm vscode:publish
pnpm vscode:publish:pro
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
