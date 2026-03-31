import { existsSync } from 'node:fs';

import { resolveFromRepo } from '@revogrid-mcp/shared';

export type SourceDescriptor = {
  name: string;
  path: string;
  exists: boolean;
};

export function getDocsSources(): SourceDescriptor[] {
  // TODO(revogrid-real-ingestion): feed these source paths into markdown/MDX parsing and chunk extraction instead of returning descriptors only.
  const candidates = [
    {
      name: 'revogrid-core-docs',
      path: resolveFromRepo(import.meta.url, 'revogrid/docs')
    },
    {
      name: 'revogrid-pro-docs',
      path: resolveFromRepo(import.meta.url, 'revogrid/docs/pro')
    }
  ];

  return candidates.map((candidate) => ({
    ...candidate,
    exists: existsSync(candidate.path)
  }));
}
