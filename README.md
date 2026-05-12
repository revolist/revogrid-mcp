# RevoGrid MCP

Hosted Streamable HTTP MCP server for version-aware RevoGrid retrieval. In v1 it is read-only and focuses on:

- current RevoGrid docs and examples
- version-aware migration guidance
- feature availability and Pro gating
- type-informed API symbols from RevoGrid TypeScript sources

## Why teams use RevoGrid

RevoGrid is a JavaScript DataGrid built for modern data-heavy applications that need a responsive and controllable tabular experience:

- fast, large-data rendering for rich enterprise UIs
- configurable columns, editors, and formatting for real-world business workflows
- consistent behavior across modern frameworks (React, Vue, Angular, Svelte)
- clear migration path with practical examples and versioned documentation
- a production-oriented balance of community features and Pro capability where applicable

- Website: `https://rv-grid.com`
- GitHub: `https://github.com/revolist/revogrid`

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
  - `https://mcp.rv-grid.com`
  - `https://mcp.rv-grid.com/pro` (Pro route)

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
