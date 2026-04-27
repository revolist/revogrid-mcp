import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildCatalogDataset,
  getApiSources,
  getCatalogEmbeddings,
  getChangelogSources,
  getDocsSources,
  getExampleSources,
  saveCatalogDataset
} from '@revogrid-mcp/ingestion';
import type { DocumentChunk, SeedDataset } from '@revogrid-mcp/content-model';
import { Pool } from 'pg';

import { loadConfig } from '../config/env.js';

type SourceInventory = Record<'docs' | 'examples' | 'changelog' | 'api', Awaited<ReturnType<typeof getDocsSources>>>;
type IndexSummary = ReturnType<typeof buildIndexSummary>;

export async function runReindex(): Promise<{ dataset: SeedDataset; summary: IndexSummary }> {
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
  const summary = buildIndexSummary(sourceInventory, dataset.chunks, absolutePath, config.CONTENT_BACKEND === 'postgres');

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
        summary,
        dataset
      },
      null,
      2,
    ),
  );

  if (config.CONTENT_BACKEND === 'postgres') {
    const pool = new Pool({
      host: config.POSTGRES_HOST,
      port: config.POSTGRES_PORT,
      database: config.POSTGRES_DB,
      user: config.POSTGRES_USER,
      password: config.POSTGRES_PASSWORD
    });

    try {
      await saveCatalogDataset(pool, config.PGVECTOR_TABLE, dataset);
    } finally {
      await pool.end();
    }
  }

  return { dataset, summary };
}

function buildIndexSummary(
  sourceInventory: SourceInventory,
  chunks: DocumentChunk[],
  absolutePath: string,
  persistedToPostgres: boolean,
) {
  const allSources = Object.values(sourceInventory).flat();

  return {
    writtenTo: absolutePath,
    persistedToPostgres,
    totalSourceFiles: allSources.length,
    sourceFilesByCategory: {
      docs: sourceInventory.docs.length,
      examples: sourceInventory.examples.length,
      changelog: sourceInventory.changelog.length,
      api: sourceInventory.api.length
    },
    sourceFilesByRepository: countBy(allSources, (source) => source.repository),
    sourceRoots: uniqueSourceRoots(allSources),
    chunkCount: chunks.length,
    chunksByDocType: countBy(chunks, (chunk) => chunk.docType),
    chunksBySurface: countBy(chunks, (chunk) => chunk.surface),
    chunksByFramework: countBy(chunks, (chunk) => chunk.framework ?? 'unspecified'),
    requiresProChunkCount: chunks.filter((chunk) => chunk.requiresPro).length,
    typedApiChunkCount: chunks.filter((chunk) =>
      chunk.sourcePath?.includes('/src/types/') || chunk.sourcePath?.includes('/release/plugins/'),
    ).length
  };
}

function countBy<TItem>(
  values: TItem[],
  selector: (value: TItem) => string,
): Record<string, number> {
  return values.reduce<Record<string, number>>((accumulator, value) => {
    const key = selector(value);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
}

function uniqueSourceRoots(
  sources: Awaited<ReturnType<typeof getDocsSources>>,
): Array<{ repository: string; source: string; rootPath: string }> {
  const uniqueRoots = new Map<string, { repository: string; source: string; rootPath: string }>();

  for (const source of sources) {
    const key = `${source.repository}:${source.source}:${source.rootPath}`;
    if (!uniqueRoots.has(key)) {
      uniqueRoots.set(key, {
        repository: source.repository,
        source: source.source,
        rootPath: source.rootPath
      });
    }
  }

  return [...uniqueRoots.values()];
}
