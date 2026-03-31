import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildCatalogDataset,
  getApiSources,
  getCatalogEmbeddings,
  getChangelogSources,
  getDocsSources,
  getExampleSources
} from '@revogrid-mcp/ingestion';
import { saveCatalogDataset } from '@revogrid-mcp/ingestion/storage/saveChunks';
import { Pool } from 'pg';

import { loadConfig } from '../src/config/env.js';

export async function runReindex(): Promise<void> {
  const config = loadConfig(process.env);
  const absolutePath = path.resolve(process.cwd(), config.REINDEX_OUTPUT);
  const [docs, examples, changelog, api, dataset] = await Promise.all([
    getDocsSources(),
    getExampleSources(),
    getChangelogSources(),
    getApiSources(),
    buildCatalogDataset()
  ]);
  const embeddings = getCatalogEmbeddings(dataset);

  const sourceInventory = { docs, examples, changelog, api };

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(
    absolutePath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceInventory,
        stats: {
          chunkCount: dataset.chunks.length,
          versionCount: dataset.versions.length,
          featureCount: dataset.features.length,
          migrationCount: dataset.migrations.length,
          embeddingCount: embeddings.length
        },
        dataset
      },
      null,
      2,
    ),
  );

  if (config.CONTENT_BACKEND === 'postgres') {
    const pool = new Pool({ connectionString: config.DATABASE_URL });

    try {
      await saveCatalogDataset(pool, config.PGVECTOR_TABLE, dataset);
    } finally {
      await pool.end();
    }
  }

  console.log(
    JSON.stringify(
      {
        writtenTo: absolutePath,
        availableSources: Object.values(sourceInventory).flat().length,
        chunkCount: dataset.chunks.length,
        persistedToPostgres: config.CONTENT_BACKEND === 'postgres'
      },
      null,
      2,
    ),
  );
}

async function main(): Promise<void> {
  await runReindex();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main();
}
