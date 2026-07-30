import type { DocumentChunk } from '@revogrid-mcp/content-model';

export type CatalogCoverageReport = {
  chunkCount: number;
  byRepository: Record<string, number>;
  bySurface: Record<string, number>;
  byDocType: Record<string, number>;
  byPathPrefix: Record<string, number>;
  requiresProChunkCount: number;
};

export function summarizeCatalogCoverage(chunks: DocumentChunk[]): CatalogCoverageReport {
  return {
    chunkCount: chunks.length,
    byRepository: countChunksBy(chunks, (chunk) => {
      const sourcePath = chunk.sourcePath ?? '';
      return sourcePath.split('/')[0] ?? 'unknown';
    }),
    bySurface: countChunksBy(chunks, (chunk) => chunk.surface),
    byDocType: countChunksBy(chunks, (chunk) => chunk.docType),
    byPathPrefix: countChunksBy(chunks, (chunk) => {
      const sourcePath = chunk.sourcePath ?? '';
      const segments = sourcePath.split('/');
      if (segments.length <= 2) {
        return sourcePath || 'root';
      }

      return `${segments[0]}/${segments[1]}`;
    }),
    requiresProChunkCount: chunks.filter((chunk) => chunk.requiresPro).length
  };
}

function countChunksBy(chunks: DocumentChunk[], selector: (chunk: DocumentChunk) => string): Record<string, number> {
  return chunks.reduce<Record<string, number>>((acc, chunk) => {
    const key = selector(chunk);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}
