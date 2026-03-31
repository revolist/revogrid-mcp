import type {
  DocumentChunk,
  FeatureRecord,
  MigrationNoteRecord,
  VersionRecord
} from '@revogrid-mcp/content-model';

export type ContentRepository = {
  getChunks(): Promise<DocumentChunk[]>;
  getVersions(): Promise<VersionRecord[]>;
  getFeatures(): Promise<FeatureRecord[]>;
  getMigrations(): Promise<MigrationNoteRecord[]>;
};
