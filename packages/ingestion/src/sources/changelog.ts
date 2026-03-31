import { existsSync } from 'node:fs';

import { resolveFromRepo } from '@revogrid-mcp/shared';

import type { SourceDescriptor } from './docs.js';

export function getChangelogSources(): SourceDescriptor[] {
  // TODO(revogrid-real-ingestion): parse release notes and migration entries from these sources into changelog and migration chunks.
  const candidates = [
    {
      name: 'revogrid-release-script',
      path: resolveFromRepo(import.meta.url, 'revogrid/docs/release.mjs')
    },
    {
      name: 'revogrid-blog',
      path: resolveFromRepo(import.meta.url, 'revogrid/docs/blog')
    }
  ];

  return candidates.map((candidate) => ({
    ...candidate,
    exists: existsSync(candidate.path)
  }));
}
