import type {
  DocumentChunk,
  FeatureRecord,
  MigrationNoteRecord,
  SeedDataset,
  VersionRecord
} from '@revogrid-mcp/content-model';
import type { Pool } from 'pg';

import type { ContentRepository } from './contentRepository.js';

export class PostgresContentRepository implements ContentRepository {
  private readonly safeTableName: string;

  public updateDataset(_dataset: SeedDataset): void {
    // Postgres updates are handled during re-indexing, so no action needed here.
  }

  public constructor(
    private readonly pool: Pool,
    tableName: string,
  ) {
    this.safeTableName = assertSafeIdentifier(tableName);
  }

  public async getChunks(): Promise<DocumentChunk[]> {
    const result = await this.pool.query<{
      id: string;
      title: string;
      body: string;
      summary: string | null;
      framework: DocumentChunk['framework'] | null;
      surface: DocumentChunk['surface'];
      doc_type: DocumentChunk['docType'];
      version: string | null;
      requires_pro: boolean;
      symbols: string[];
      stability: DocumentChunk['stability'] | null;
      url: string;
      source_path: string | null;
      example_url: string | null;
      package_names: string[] | null;
      release_date: string | null;
    }>(`SELECT * FROM ${this.safeTableName} ORDER BY id`);

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      summary: row.summary ?? undefined,
      framework: row.framework ?? undefined,
      surface: row.surface,
      docType: row.doc_type,
      version: row.version ?? undefined,
      requiresPro: row.requires_pro,
      symbols: row.symbols ?? [],
      stability: row.stability ?? undefined,
      url: row.url,
      sourcePath: row.source_path ?? undefined,
      exampleUrl: row.example_url ?? undefined,
      packageNames: row.package_names ?? undefined,
      releaseDate: row.release_date ?? undefined
    }));
  }

  public async getVersions(): Promise<VersionRecord[]> {
    const result = await this.pool.query<{
      version: string;
      label: string;
      latest: boolean;
      release_date: string | null;
      surfaces: DocumentChunk['surface'][];
    }>('SELECT * FROM catalog_versions ORDER BY version DESC');

    return result.rows.map((row) => ({
      version: row.version,
      label: row.label,
      latest: row.latest,
      releaseDate: row.release_date ?? undefined,
      surfaces: row.surfaces ?? []
    }));
  }

  public async getFeatures(): Promise<FeatureRecord[]> {
    const result = await this.pool.query<{
      feature_name: string;
      supported: boolean;
      requires_pro: boolean;
      stability: FeatureRecord['stability'] | null;
      supported_frameworks: FeatureRecord['supportedFrameworks'];
      notes: string[];
      related_chunk_ids: string[];
      related_example_ids: string[];
      fallback_approach: string | null;
      aliases: string[];
    }>('SELECT * FROM catalog_features ORDER BY feature_name');

    return result.rows.map((row) => ({
      featureName: row.feature_name,
      supported: row.supported,
      requiresPro: row.requires_pro,
      stability: row.stability ?? undefined,
      supportedFrameworks: row.supported_frameworks ?? [],
      notes: row.notes ?? [],
      relatedChunkIds: row.related_chunk_ids ?? [],
      relatedExampleIds: row.related_example_ids ?? [],
      fallbackApproach: row.fallback_approach ?? undefined,
      aliases: row.aliases ?? []
    }));
  }

  public async getMigrations(): Promise<MigrationNoteRecord[]> {
    const result = await this.pool.query<{
      id: string;
      from_version: string;
      to_version: string;
      framework: MigrationNoteRecord['framework'] | null;
      breaking_changes: string[];
      renamed_symbols: MigrationNoteRecord['renamedSymbols'];
      changed_defaults: string[];
      package_changes: string[];
      recommended_doc_ids: string[];
      recommended_example_ids: string[];
    }>('SELECT * FROM catalog_migrations ORDER BY id');

    return result.rows.map((row) => ({
      id: row.id,
      fromVersion: row.from_version,
      toVersion: row.to_version,
      framework: row.framework ?? undefined,
      breakingChanges: row.breaking_changes ?? [],
      renamedSymbols: row.renamed_symbols ?? [],
      changedDefaults: row.changed_defaults ?? [],
      packageChanges: row.package_changes ?? [],
      recommendedDocIds: row.recommended_doc_ids ?? [],
      recommendedExampleIds: row.recommended_example_ids ?? []
    }));
  }
}

function assertSafeIdentifier(identifier: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }

  return identifier;
}
