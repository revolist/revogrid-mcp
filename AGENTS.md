# RevoGrid MCP Agent Rules

- Prefer structured outputs over prose.
- Do not invent RevoGrid APIs, events, symbols, or feature availability.
- Never return Pro content to anonymous users.
- Keep MCP tool names stable.
- Prefer metadata-aware retrieval over free-form ranking heuristics.
- Keep business logic outside transport code.
- Keep the server read-only in v1.
- Favor small composable functions over framework-heavy abstractions.
- When adding new retrieval sources, anchor them to `../revogrid` and `../revogrid-pro` before introducing synthetic content.
- If a change affects entitlement handling, add or update tests that prove anonymous requests cannot see Pro chunks.
