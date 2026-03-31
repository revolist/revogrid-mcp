import { existsSync } from 'node:fs';

import { resolveFromRepo } from '@revogrid-mcp/shared';

import type { SourceDescriptor } from './docs.js';

export function getApiSources(): SourceDescriptor[] {
  // TODO(revogrid-real-ingestion): extract API symbols and event signatures from these type files to back symbol-aware retrieval.
  const candidates = [
    {
      name: 'interfaces',
      path: resolveFromRepo(import.meta.url, 'revogrid/src/types/interfaces.ts')
    },
    {
      name: 'selection-types',
      path: resolveFromRepo(import.meta.url, 'revogrid/src/types/selection.ts')
    },
    {
      name: 'plugin-types',
      path: resolveFromRepo(import.meta.url, 'revogrid/src/types/plugin.types.ts')
    }
  ];

  return candidates.map((candidate) => ({
    ...candidate,
    exists: existsSync(candidate.path)
  }));
}
