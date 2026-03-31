# RevoGrid MCP Agent Rules

- Prefer structured outputs over prose.
- Do not invent RevoGrid APIs, events, symbols, or feature availability.
- Never return Pro content to anonymous users.
- Keep MCP tool names stable.
- Prefer metadata-aware retrieval over free-form ranking heuristics.
- Keep business logic outside transport code.
- Keep the server read-only in v1.
- Favor small composable functions over framework-heavy abstractions.
- When adding new retrieval sources, prefer `external/revogrid` and `external/revogrid-pro`, then explicit env vars, before introducing synthetic content.
- Add private or internal sources through dedicated adapters and opt-in roots; do not widen public adapters in place.
- If a change affects entitlement handling, add or update tests that prove anonymous requests cannot see Pro chunks.
