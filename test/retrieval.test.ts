import { describe, expect, it } from 'vitest';

import { buildSeedDataset } from '@revogrid-mcp/ingestion';

import { hybridSearch } from '../src/retrieval/hybridSearch.js';
import { InMemoryContentRepository } from '../src/repositories/inMemoryContentRepository.js';
import { DefaultRevogridSearchService } from '../src/services/searchService.js';

describe('retrieval filters', () => {
  const repository = new InMemoryContentRepository(buildSeedDataset());
  const service = new DefaultRevogridSearchService(repository);

  it('keeps pro chunks out of anonymous search results', async () => {
    const results = await service.searchDocs('pivot feature', {
      limit: 5,
      entitlement: 'anonymous'
    });

    expect(results.some((result) => result.chunk.requiresPro)).toBe(false);
  });

  it('returns pro chunks for paid accounts', async () => {
    const results = await service.searchDocs('pivot feature', {
      limit: 5,
      entitlement: 'paid_pro'
    });

    expect(results.some((result) => result.chunk.id === 'guide-pivot-overview')).toBe(true);
  });

  it('keeps pro chunks out of trial search results', async () => {
    const results = await service.searchDocs('pivot feature', {
      limit: 5,
      entitlement: 'trial'
    });

    expect(results.some((result) => result.chunk.requiresPro)).toBe(false);
  });

  it('applies framework filters', async () => {
    const results = await service.searchDocs('editable grid', {
      framework: 'react',
      limit: 5,
      entitlement: 'anonymous'
    });

    expect(results[0]?.chunk.framework).toBe('react');
  });

  it('returns deterministic ordering for the same seeded query', () => {
    const chunks = buildSeedDataset().chunks;
    const filters = {
      limit: 5,
      entitlement: 'anonymous' as const
    };

    const first = hybridSearch('beforeedit', chunks, filters).map((match) => match.chunk.id);
    const second = hybridSearch('beforeedit', chunks, filters).map((match) => match.chunk.id);

    expect(first).toEqual(second);
  });
});
