import type { DocumentChunk } from '@revogrid-mcp/content-model';

export type ChunkPersistence = {
  save: (chunks: DocumentChunk[]) => Promise<void>;
};

export async function saveChunks(
  persistence: ChunkPersistence,
  chunks: DocumentChunk[],
): Promise<void> {
  await persistence.save(chunks);
}
