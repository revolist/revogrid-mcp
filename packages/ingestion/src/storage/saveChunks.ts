import type { SeedDataset } from '@revogrid-mcp/content-model';
import type { Pool, PoolClient } from 'pg';
import pgvector from 'pgvector/pg';

import { embedChunks } from '../embeddings/embedChunks.js';
import { createContentFingerprint } from '../pipelines/buildCatalog.js';

export async function saveCatalogDataset(
  pool: Pool,
  tableName: string,
  dataset: SeedDataset,
): Promise<void> {
  const safeTableName = assertSafeIdentifier(tableName);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await ensureSchema(client, safeTableName);
    await pgvector.registerTypes(client);

    const embeddings = embedChunks(dataset.chunks);
    const embeddingMap = new Map(embeddings.map((embedding) => [embedding.chunkId, embedding.vector]));

    for (const chunk of dataset.chunks) {
      await client.query(
        `
          INSERT INTO ${safeTableName} (
            id, title, body, summary, framework, surface, doc_type, version, requires_pro,
            symbols, stability, url, source_path, example_url, package_names, release_date,
            content_hash, embedding
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14, $15, $16,
            $17, $18
          )
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            body = EXCLUDED.body,
            summary = EXCLUDED.summary,
            framework = EXCLUDED.framework,
            surface = EXCLUDED.surface,
            doc_type = EXCLUDED.doc_type,
            version = EXCLUDED.version,
            requires_pro = EXCLUDED.requires_pro,
            symbols = EXCLUDED.symbols,
            stability = EXCLUDED.stability,
            url = EXCLUDED.url,
            source_path = EXCLUDED.source_path,
            example_url = EXCLUDED.example_url,
            package_names = EXCLUDED.package_names,
            release_date = EXCLUDED.release_date,
            content_hash = EXCLUDED.content_hash,
            embedding = EXCLUDED.embedding
        `,
        [
          chunk.id,
          chunk.title,
          chunk.body,
          chunk.summary ?? null,
          chunk.framework ?? null,
          chunk.surface,
          chunk.docType,
          chunk.version ?? null,
          chunk.requiresPro,
          chunk.symbols,
          chunk.stability ?? null,
          chunk.url,
          chunk.sourcePath ?? null,
          chunk.exampleUrl ?? null,
          chunk.packageNames ?? null,
          chunk.releaseDate ?? null,
          createContentFingerprint(chunk),
          pgvector.toSql(embeddingMap.get(chunk.id) ?? [])
        ],
      );
    }

    for (const version of dataset.versions) {
      await client.query(
        `
          INSERT INTO catalog_versions (version, label, latest, release_date, surfaces)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (version) DO UPDATE SET
            label = EXCLUDED.label,
            latest = EXCLUDED.latest,
            release_date = EXCLUDED.release_date,
            surfaces = EXCLUDED.surfaces
        `,
        [version.version, version.label, version.latest, version.releaseDate ?? null, version.surfaces],
      );
    }

    for (const feature of dataset.features) {
      await client.query(
        `
          INSERT INTO catalog_features (
            feature_name, supported, requires_pro, stability, supported_frameworks,
            notes, related_chunk_ids, related_example_ids, fallback_approach, aliases
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (feature_name) DO UPDATE SET
            supported = EXCLUDED.supported,
            requires_pro = EXCLUDED.requires_pro,
            stability = EXCLUDED.stability,
            supported_frameworks = EXCLUDED.supported_frameworks,
            notes = EXCLUDED.notes,
            related_chunk_ids = EXCLUDED.related_chunk_ids,
            related_example_ids = EXCLUDED.related_example_ids,
            fallback_approach = EXCLUDED.fallback_approach,
            aliases = EXCLUDED.aliases
        `,
        [
          feature.featureName,
          feature.supported,
          feature.requiresPro,
          feature.stability ?? null,
          feature.supportedFrameworks,
          feature.notes ?? [],
          feature.relatedChunkIds,
          feature.relatedExampleIds,
          feature.fallbackApproach ?? null,
          feature.aliases
        ],
      );
    }

    for (const migration of dataset.migrations) {
      await client.query(
        `
          INSERT INTO catalog_migrations (
            id, from_version, to_version, framework, breaking_changes,
            renamed_symbols, changed_defaults, package_changes,
            recommended_doc_ids, recommended_example_ids
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)
          ON CONFLICT (id) DO UPDATE SET
            from_version = EXCLUDED.from_version,
            to_version = EXCLUDED.to_version,
            framework = EXCLUDED.framework,
            breaking_changes = EXCLUDED.breaking_changes,
            renamed_symbols = EXCLUDED.renamed_symbols,
            changed_defaults = EXCLUDED.changed_defaults,
            package_changes = EXCLUDED.package_changes,
            recommended_doc_ids = EXCLUDED.recommended_doc_ids,
            recommended_example_ids = EXCLUDED.recommended_example_ids
        `,
        [
          migration.id,
          migration.fromVersion,
          migration.toVersion,
          migration.framework ?? null,
          migration.breakingChanges,
          JSON.stringify(migration.renamedSymbols),
          migration.changedDefaults,
          migration.packageChanges,
          migration.recommendedDocIds,
          migration.recommendedExampleIds
        ],
      );
    }

    await deleteStaleRows(client, safeTableName, 'id', dataset.chunks.map((chunk) => chunk.id));
    await deleteStaleRows(client, 'catalog_versions', 'version', dataset.versions.map((version) => version.version));
    await deleteStaleRows(
      client,
      'catalog_features',
      'feature_name',
      dataset.features.map((feature) => feature.featureName),
    );
    await deleteStaleRows(client, 'catalog_migrations', 'id', dataset.migrations.map((migration) => migration.id));

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function ensureSchema(client: PoolClient, tableName: string): Promise<void> {
  await client.query('CREATE EXTENSION IF NOT EXISTS vector');
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id text PRIMARY KEY,
      title text NOT NULL,
      body text NOT NULL,
      summary text,
      framework text,
      surface text NOT NULL,
      doc_type text NOT NULL,
      version text,
      requires_pro boolean NOT NULL,
      symbols text[] NOT NULL DEFAULT '{}',
      stability text,
      url text NOT NULL,
      source_path text,
      example_url text,
      package_names text[],
      release_date text,
      content_hash text NOT NULL,
      embedding vector(16)
    )
  `);
  await client.query(
    `CREATE INDEX IF NOT EXISTS ${assertSafeIdentifier(`${tableName}_surface_idx`)} ON ${tableName} (surface)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS ${assertSafeIdentifier(`${tableName}_doctype_idx`)} ON ${tableName} (doc_type)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS ${assertSafeIdentifier(`${tableName}_requires_pro_idx`)} ON ${tableName} (requires_pro)`,
  );
  await client.query(`
    CREATE TABLE IF NOT EXISTS catalog_versions (
      version text PRIMARY KEY,
      label text NOT NULL,
      latest boolean NOT NULL,
      release_date text,
      surfaces text[] NOT NULL DEFAULT '{}'
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS catalog_features (
      feature_name text PRIMARY KEY,
      supported boolean NOT NULL,
      requires_pro boolean NOT NULL,
      stability text,
      supported_frameworks text[] NOT NULL DEFAULT '{}',
      notes text[] NOT NULL DEFAULT '{}',
      related_chunk_ids text[] NOT NULL DEFAULT '{}',
      related_example_ids text[] NOT NULL DEFAULT '{}',
      fallback_approach text,
      aliases text[] NOT NULL DEFAULT '{}'
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS catalog_migrations (
      id text PRIMARY KEY,
      from_version text NOT NULL,
      to_version text NOT NULL,
      framework text,
      breaking_changes text[] NOT NULL DEFAULT '{}',
      renamed_symbols jsonb NOT NULL DEFAULT '[]'::jsonb,
      changed_defaults text[] NOT NULL DEFAULT '{}',
      package_changes text[] NOT NULL DEFAULT '{}',
      recommended_doc_ids text[] NOT NULL DEFAULT '{}',
      recommended_example_ids text[] NOT NULL DEFAULT '{}'
    )
  `);
}

async function deleteStaleRows(
  client: PoolClient,
  tableName: string,
  idColumn: string,
  activeIds: string[],
): Promise<void> {
  const safeTableName = assertSafeIdentifier(tableName);
  const safeIdColumn = assertSafeIdentifier(idColumn);
  await client.query(`DELETE FROM ${safeTableName} WHERE NOT (${safeIdColumn} = ANY($1::text[]))`, [activeIds]);
}

function assertSafeIdentifier(identifier: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }

  return identifier;
}
