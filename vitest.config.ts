import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@revogrid-mcp/content-model': fileURLToPath(new URL('./packages/content-model/src/index.ts', import.meta.url)),
      '@revogrid-mcp/ingestion': fileURLToPath(new URL('./packages/ingestion/src/index.ts', import.meta.url)),
      '@revogrid-mcp/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url))
    }
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.test.ts', 'packages/**/*.test.ts']
  }
});
