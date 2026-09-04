import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { PostgresContentRepository } from '../src/repositories/postgresContentRepository.js';

describe('PostgresContentRepository', () => {
  it('uses the materialized search vector for lexical matching and ranking', async () => {
    const query = vi.fn(() => Promise.resolve({ rows: [] }));
    const repository = new PostgresContentRepository({ query } as unknown as Pool, 'document_chunks');

    await repository.findLexicalCandidates('PluginProviders', {}, 5);

    const [statement, values] = query.mock.calls[0] ?? [];
    expect(statement).toContain("search_vector @@ websearch_to_tsquery('english', $1)");
    expect(statement).toMatch(/ts_rank_cd\(\s*search_vector,/);
    expect(statement).not.toContain('array_to_string(symbols');
    expect(values).toEqual(['PluginProviders', 'public', 5]);
  });
});
