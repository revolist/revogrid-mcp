import type {
  DocumentChunk,
  FeatureRecord,
  MigrationNoteRecord,
  VersionRecord
} from '@revogrid-mcp/content-model';
import type { Pool } from 'pg';

import { AppError } from '@revogrid-mcp/shared';

import type { ContentRepository } from './contentRepository.js';

export class PostgresContentRepository implements ContentRepository {
  public constructor(
    private readonly pool: Pool,
    private readonly tableName: string,
  ) {}

  public getChunks(): Promise<DocumentChunk[]> {
    void this.pool;
    return Promise.reject(
      // TODO(revogrid-real-ingestion): replace this placeholder with real Postgres + pgvector queries over normalized chunk, embedding, feature, and migration tables.
      new AppError(`Postgres chunk loading is not wired yet for table "${this.tableName}".`, 501),
    );
  }

  public getVersions(): Promise<VersionRecord[]> {
    return Promise.reject(new AppError('Postgres version loading is not wired yet.', 501));
  }

  public getFeatures(): Promise<FeatureRecord[]> {
    return Promise.reject(new AppError('Postgres feature loading is not wired yet.', 501));
  }

  public getMigrations(): Promise<MigrationNoteRecord[]> {
    return Promise.reject(new AppError('Postgres migration loading is not wired yet.', 501));
  }
}
