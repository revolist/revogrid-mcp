import type {
  CapabilityRecord,
  CatalogSnapshot,
  DocumentChunk,
  FeatureRecord,
  MigrationNoteRecord,
  SeedDataset,
  VersionRecord,
  PackageRecord
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

  public getChunkById(id: string): Promise<DocumentChunk | null> {
    return Promise.resolve(this.dataset.chunks.find((chunk) => chunk.id === id) ?? null);
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

  public getPackages(): Promise<PackageRecord[]> {
    return Promise.resolve(this.dataset.packages ?? []);
  }

  public getCapabilities(): Promise<CapabilityRecord[]> {
    return Promise.resolve(this.dataset.capabilities ?? []);
  }

  public getSnapshot(): Promise<CatalogSnapshot | null> {
    return Promise.resolve(this.dataset.snapshot ?? null);
  }
}
