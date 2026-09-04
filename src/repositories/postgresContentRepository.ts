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
import type { Pool } from 'pg';

import type {
  ChunkCandidateFilters,
  ContentRepository
} from './contentRepository.js';

type ChunkRow = {
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
  product: DocumentChunk['product'] | null;
  package_name: string | null;
  package_version: string | null;
  visibility: DocumentChunk['visibility'] | null;
  symbol_kind: DocumentChunk['symbolKind'] | null;
  source_revision: string | null;
  signature: string | null;
  export_path: string | null;
  authority: number | null;
};

export class PostgresContentRepository implements ContentRepository {
  private readonly safeTableName: string;

  public updateDataset(dataset: SeedDataset): void {
    void dataset;
    // Postgres updates are handled during re-indexing, so no action needed here.
  }

  public constructor(
    private readonly pool: Pool,
    tableName: string,
  ) {
    this.safeTableName = assertSafeIdentifier(tableName);
  }

  public async getChunks(): Promise<DocumentChunk[]> {
    const result = await this.pool.query<ChunkRow>(
      `SELECT * FROM ${this.safeTableName} ORDER BY id`,
    );

    return result.rows.map(mapChunkRow);
  }

  public async getChunkById(id: string): Promise<DocumentChunk | null> {
    const result = await this.pool.query<ChunkRow>(
      `SELECT * FROM ${this.safeTableName} WHERE id = $1 LIMIT 1`,
      [id],
    );
    return result.rows[0] ? mapChunkRow(result.rows[0]) : null;
  }

  public async findLexicalCandidates(
    query: string,
    filters: ChunkCandidateFilters,
    limit: number,
  ): Promise<DocumentChunk[]> {
    const values: unknown[] = [query];
    const conditions = [
      `search_vector @@ websearch_to_tsquery('english', $1)`,
    ];
    const addCondition = (sql: string, value: unknown) => {
      values.push(value);
      conditions.push(sql.replace('?', `$${values.length}`));
    };

    addCondition('visibility = ?', filters.visibility ?? (filters.surface === 'internal' ? 'internal' : 'public'));
    if (filters.framework) {
      addCondition('(framework IS NULL OR framework = ?)', filters.framework);
    }
    if (filters.version) {
      addCondition(
        "regexp_replace(coalesce(version, package_version, ''), '^[vV]', '') = regexp_replace(?, '^[vV]', '')",
        filters.version,
      );
    }
    if (filters.surface) addCondition('surface = ?', filters.surface);
    if (filters.requiresPro !== undefined) {
      addCondition('requires_pro = ?', filters.requiresPro);
    }
    if (filters.docTypes?.length) {
      addCondition('doc_type = ANY(?::text[])', filters.docTypes);
    }
    if (filters.product) addCondition('product = ?', filters.product);
    if (filters.packageName) {
      addCondition('(package_name = ? OR ? = ANY(package_names))', filters.packageName);
      values.push(filters.packageName);
      conditions[conditions.length - 1] = conditions.at(-1)!.replace('?', `$${values.length}`);
    }
    if (filters.symbolKind) addCondition('symbol_kind = ?', filters.symbolKind);

    values.push(Math.max(1, limit));
    const result = await this.pool.query<ChunkRow>(
      `SELECT *
       FROM ${this.safeTableName}
       WHERE ${conditions.join(' AND ')}
       ORDER BY ts_rank_cd(
         search_vector,
         websearch_to_tsquery('english', $1)
       ) DESC, authority DESC, id
       LIMIT $${values.length}`,
      values,
    );

    return result.rows.map(mapChunkRow);
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

  public async getPackages(): Promise<PackageRecord[]> {
    const result = await this.pool.query<{ payload: PackageRecord }>('SELECT payload FROM catalog_packages ORDER BY id');
    return result.rows.map((row) => row.payload);
  }

  public async getCapabilities(): Promise<CapabilityRecord[]> {
    const result = await this.pool.query<{ payload: CapabilityRecord }>('SELECT payload FROM catalog_capabilities ORDER BY id');
    return result.rows.map((row) => row.payload);
  }

  public async getSnapshot(): Promise<CatalogSnapshot | null> {
    const result = await this.pool.query<{ payload: CatalogSnapshot }>('SELECT payload FROM catalog_snapshot WHERE id = 1');
    return result.rows[0]?.payload ?? null;
  }
}

function mapChunkRow(row: ChunkRow): DocumentChunk {
  return {
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
    releaseDate: row.release_date ?? undefined,
    product: row.product ?? undefined,
    packageName: row.package_name ?? undefined,
    packageVersion: row.package_version ?? undefined,
    visibility: row.visibility ?? 'public',
    symbolKind: row.symbol_kind ?? undefined,
    sourceRevision: row.source_revision ?? undefined,
    signature: row.signature ?? undefined,
    exportPath: row.export_path ?? undefined,
    authority: row.authority ?? 50
  };
}

function assertSafeIdentifier(identifier: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }

  return identifier;
}
