# RevoGrid MCP Agent Rules

- Prefer structured outputs over prose.
- Do not invent RevoGrid APIs, events, symbols, or feature availability.
- Return Core, Pro, and Enterprise knowledge through the unified read-only MCP catalog without access-token gating.
- Preserve `requiresPro` metadata so clients can explain package and license requirements accurately.
- Keep MCP tool names stable.
- Prefer metadata-aware retrieval over free-form ranking heuristics.
- Keep business logic outside transport code.
- Keep the server read-only in v1.
- Favor small composable functions over framework-heavy abstractions.
- When adding new retrieval sources, prefer `external/revogrid` and `external/revogrid-pro`, then explicit env vars, before introducing synthetic content.
- Add private or internal sources through dedicated adapters and opt-in roots; do not widen public adapters in place.
- If a change affects catalog visibility, add or update tests that prove the canonical endpoint can retrieve both Core and Pro chunks.
