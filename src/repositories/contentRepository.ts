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

export type ChunkCandidateFilters = {
  framework?: DocumentChunk['framework'] | undefined;
  version?: string | undefined;
  surface?: DocumentChunk['surface'] | undefined;
  requiresPro?: boolean | undefined;
  docTypes?: DocumentChunk['docType'][] | undefined;
  product?: DocumentChunk['product'] | undefined;
  packageName?: string | undefined;
  visibility?: DocumentChunk['visibility'] | undefined;
  symbolKind?: DocumentChunk['symbolKind'] | undefined;
};

export type ContentRepository = {
  getChunks(): Promise<DocumentChunk[]>;
  getChunkById?(id: string): Promise<DocumentChunk | null>;
  findLexicalCandidates?(
    query: string,
    filters: ChunkCandidateFilters,
    limit: number,
  ): Promise<DocumentChunk[]>;
  getVersions(): Promise<VersionRecord[]>;
  getFeatures(): Promise<FeatureRecord[]>;
  getMigrations(): Promise<MigrationNoteRecord[]>;
  getPackages(): Promise<PackageRecord[]>;
  getCapabilities(): Promise<CapabilityRecord[]>;
  getSnapshot(): Promise<CatalogSnapshot | null>;
  updateDataset(dataset: SeedDataset): void;
};
