import type {
  DocumentChunk,
  FeatureRecord,
  MigrationNoteRecord,
  SeedDataset,
  VersionRecord
} from '@revogrid-mcp/content-model';

import type { ContentRepository } from './contentRepository.js';

type ChunkFilter = (chunk: DocumentChunk) => boolean;

export class FilteredContentRepository implements ContentRepository {
  public constructor(
    private readonly repository: ContentRepository,
    private readonly chunkFilter: ChunkFilter,
  ) {}

  public updateDataset(dataset: SeedDataset): void {
    this.repository.updateDataset(dataset);
  }

  public async getChunks(): Promise<DocumentChunk[]> {
    return this.getVisibleChunks();
  }

  public async getVersions(): Promise<VersionRecord[]> {
    const [versions, chunks] = await Promise.all([
      this.repository.getVersions(),
      this.getVisibleChunks()
    ]);
    const surfacesByVersion = new Map<string, Set<DocumentChunk['surface']>>();

    for (const chunk of chunks) {
      if (!chunk.version) {
        continue;
      }

      const surfaces = surfacesByVersion.get(chunk.version) ?? new Set<DocumentChunk['surface']>();
      surfaces.add(chunk.surface);
      surfacesByVersion.set(chunk.version, surfaces);
    }

    return versions
      .filter((version) => surfacesByVersion.has(version.version))
      .map((version) => ({
        ...version,
        surfaces: [...(surfacesByVersion.get(version.version) ?? new Set())]
      }));
  }

  public async getFeatures(): Promise<FeatureRecord[]> {
    const [features, chunks] = await Promise.all([
      this.repository.getFeatures(),
      this.getVisibleChunks()
    ]);
    const visibleChunkIds = new Set(chunks.map((chunk) => chunk.id));

    return features
      .filter((feature) => !feature.requiresPro)
      .map((feature) => ({
        ...feature,
        relatedChunkIds: feature.relatedChunkIds.filter((id) => visibleChunkIds.has(id)),
        relatedExampleIds: feature.relatedExampleIds.filter((id) => visibleChunkIds.has(id))
      }));
  }

  public async getMigrations(): Promise<MigrationNoteRecord[]> {
    const [migrations, chunks] = await Promise.all([
      this.repository.getMigrations(),
      this.getVisibleChunks()
    ]);
    const visibleChunkIds = new Set(chunks.map((chunk) => chunk.id));

    return migrations.map((migration) => ({
      ...migration,
      recommendedDocIds: migration.recommendedDocIds.filter((id) => visibleChunkIds.has(id)),
      recommendedExampleIds: migration.recommendedExampleIds.filter((id) => visibleChunkIds.has(id))
    }));
  }

  private async getVisibleChunks(): Promise<DocumentChunk[]> {
    return (await this.repository.getChunks()).filter(this.chunkFilter);
  }
}
