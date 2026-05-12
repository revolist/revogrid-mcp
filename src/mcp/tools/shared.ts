import { canAccessChunk } from '@revogrid-mcp/content-model';

import type { DocumentChunk } from '@revogrid-mcp/content-model';
import type { RequestContext, SearchMatch } from '../../types/catalog.js';

export function filterVisibleMatches(
  matches: SearchMatch[],
  context: RequestContext,
): SearchMatch[] {
  return matches.filter((match) => canAccessChunk(match.chunk, context.entitlement));
}

export function filterVisibleChunks(
  chunks: DocumentChunk[],
  context: RequestContext,
): DocumentChunk[] {
  return chunks.filter((chunk) => canAccessChunk(chunk, context.entitlement));
}

export type CatalogCoverageReport = {
  chunkCount: number;
  byRepository: Record<string, number>;
  bySurface: Record<string, number>;
  byDocType: Record<string, number>;
  byPathPrefix: Record<string, number>;
  requiresProChunkCount: number;
};

export function summarizeCatalogCoverage(chunks: DocumentChunk[]): CatalogCoverageReport {
  const visibleChunks = chunks;

  return {
    chunkCount: visibleChunks.length,
    byRepository: countChunksBy(visibleChunks, (chunk) => {
      const sourcePath = chunk.sourcePath ?? '';
      return sourcePath.split('/')[0] ?? 'unknown';
    }),
    bySurface: countChunksBy(visibleChunks, (chunk) => chunk.surface),
    byDocType: countChunksBy(visibleChunks, (chunk) => chunk.docType),
    byPathPrefix: countChunksBy(visibleChunks, (chunk) => {
      const sourcePath = chunk.sourcePath ?? '';
      const segments = sourcePath.split('/');
      if (segments.length <= 2) {
        return sourcePath || 'root';
      }

      return `${segments[0]}/${segments[1]}`;
    }),
    requiresProChunkCount: visibleChunks.filter((chunk) => chunk.requiresPro).length
  };
}

function countChunksBy(chunks: DocumentChunk[], selector: (chunk: DocumentChunk) => string): Record<string, number> {
  return chunks.reduce<Record<string, number>>((acc, chunk) => {
    const key = selector(chunk);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}
