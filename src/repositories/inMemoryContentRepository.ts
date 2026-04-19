import type {
  DocumentChunk,
  FeatureRecord,
  MigrationNoteRecord,
  SeedDataset,
  VersionRecord
} from '@revogrid-mcp/content-model';

import type { ContentRepository } from './contentRepository.js';

export class InMemoryContentRepository implements ContentRepository {
  public constructor(private dataset: SeedDataset) {}

  public updateDataset(dataset: SeedDataset): void {
    this.dataset = dataset;
  }

  public getChunks(): Promise<DocumentChunk[]> {
    return Promise.resolve(this.dataset.chunks);
  }

  public getVersions(): Promise<VersionRecord[]> {
    return Promise.resolve(this.dataset.versions);
  }

  public getFeatures(): Promise<FeatureRecord[]> {
    return Promise.resolve(this.dataset.features);
  }

  public getMigrations(): Promise<MigrationNoteRecord[]> {
    return Promise.resolve(this.dataset.migrations);
  }
}
