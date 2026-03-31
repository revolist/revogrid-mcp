import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['apps/server/test/**/*.test.ts', 'packages/**/*.test.ts']
  }
});
