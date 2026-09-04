import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { saveCatalogDataset } from './saveChunks.js';

describe('saveCatalogDataset PostgreSQL schema', () => {
  it('creates the full-text index without non-immutable expression functions', async () => {
    const statements: string[] = [];
    const client = {
      query: vi.fn((statement: string) => {
        const normalized = statement.replace(/\s+/g, ' ').trim();
        statements.push(normalized);

        if (normalized.startsWith('CREATE INDEX') && normalized.includes('array_to_string(')) {
          return Promise.reject(new Error('functions in index expression must be marked IMMUTABLE'));
        }

        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn()
    };
    const pool = {
      connect: vi.fn(() => Promise.resolve(client))
    } as unknown as Pool;

    await expect(
      saveCatalogDataset(pool, 'document_chunks', {
        chunks: [
          {
            id: 'plugin-providers',
            title: 'Plugin providers',
            body: 'Access grid services through providers.',
            summary: 'Provider API',
            surface: 'core',
            docType: 'api',
            requiresPro: false,
            symbols: ['PluginProviders'],
            url: 'https://rv-grid.com/guide/plugin/',
            visibility: 'public',
            authority: 100
          }
        ],
        versions: [],
        features: [],
        migrations: []
      }),
    ).resolves.toBeUndefined();

    expect(statements).toContain(
      'ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS search_vector tsvector',
    );
    expect(statements).toContain(
      'CREATE INDEX IF NOT EXISTS document_chunks_fulltext_v3_idx ON document_chunks USING GIN (search_vector)',
    );
    const chunkUpsert = statements.find((statement) => statement.startsWith('INSERT INTO document_chunks'));
    expect(chunkUpsert).toContain('search_vector');
    expect(chunkUpsert).toContain("coalesce(array_to_string($10, ' '), '')");
    expect(chunkUpsert).toContain('search_vector = EXCLUDED.search_vector');
  });
});
