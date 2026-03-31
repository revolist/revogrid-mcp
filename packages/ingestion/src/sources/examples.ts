import { existsSync } from 'node:fs';

import { resolveFromRepo } from '@revogrid-mcp/shared';

import type { SourceDescriptor } from './docs.js';

export function getExampleSources(): SourceDescriptor[] {
  // TODO(revogrid-real-ingestion): parse runnable example metadata from these framework demo folders and map them to example/live-demo chunks.
  const candidates = [
    {
      name: 'react-demo',
      path: resolveFromRepo(import.meta.url, 'revogrid/packages/react/demo')
    },
    {
      name: 'vue-demo',
      path: resolveFromRepo(import.meta.url, 'revogrid/packages/vue3/demo')
    },
    {
      name: 'pro-components',
      path: resolveFromRepo(import.meta.url, 'revogrid-pro/src/components')
    }
  ];

  return candidates.map((candidate) => ({
    ...candidate,
    exists: existsSync(candidate.path)
  }));
}
