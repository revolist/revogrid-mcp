import type { DocumentChunk } from '@revogrid-mcp/content-model';

import { stableHash, tokenize } from '@revogrid-mcp/shared';

export type EmbeddedChunk = {
  chunkId: string;
  vector: number[];
};

const VECTOR_SIZE = 16;

export function embedChunks(chunks: DocumentChunk[]): EmbeddedChunk[] {
  return chunks.map((chunk) => {
    const vector = new Array<number>(VECTOR_SIZE).fill(0);

    for (const token of tokenize(`${chunk.title} ${chunk.summary ?? ''} ${chunk.body}`)) {
      const slot = stableHash(token) % VECTOR_SIZE;
      vector[slot] = (vector[slot] ?? 0) + 1;
    }

    return {
      chunkId: chunk.id,
      vector
    };
  });
}
