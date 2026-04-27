import { beforeAll, describe, expect, it } from 'vitest';

import type { SeedDataset } from '@revogrid-mcp/content-model';
import { buildCatalogDataset, buildSeedDataset } from '@revogrid-mcp/ingestion';

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

describe('retrieval quality', () => {
  let dataset: SeedDataset;

  beforeAll(async () => {
    dataset = await buildCatalogDataset();
  });

  it.each([
    ['custom editor react', 'revogrid-docs-guide-react-editor'],
    ['beforeedit event', 'revogrid-src-types-events'],
    ['column grouping', 'revogrid-docs-guide-column-grouping'],
    ['row grouping', 'revogrid-docs-guide-row-grouping'],
    ['pivot dimensions', 'revogrid-pro-src-content-docs-guides-data-manage-pivot'],
    ['tree data', 'revogrid-pro-src-content-docs-guides-data-manage-tree'],
    ['infinite scroll', 'revogrid-pro-src-content-docs-guides-infinity-scroll'],
    ['export excel', 'revogrid-pro-src-content-docs-guides-data-manage-excel-export'],
    ['filter plugin', 'revogrid-pro-src-content-docs-guides-filter-header'],
    ['angular setup', 'revogrid-docs-guide-installation']
  ])('puts the intended local catalog result first for "%s"', (query, expectedTopId) => {
    const results = hybridSearch(query, dataset.chunks, {
      limit: 5,
      entitlement: 'paid_pro'
    });

    expect(results[0]?.chunk.id).toBe(expectedTopId);
  });

  it('deduplicates repeated chunk ids before returning results', () => {
    const results = hybridSearch('export excel', dataset.chunks, {
      limit: 10,
      entitlement: 'paid_pro'
    });
    const resultIds = results.map((result) => result.chunk.id);

    expect(new Set(resultIds).size).toBe(resultIds.length);
    expect(results[0]?.chunk.docType).toBe('guide');
  });

  it.each(['pivot dimensions', 'tree data', 'infinite scroll', 'export excel'])(
    'keeps anonymous pro-heavy query "%s" free of pro chunks',
    (query) => {
      const results = hybridSearch(query, dataset.chunks, {
        limit: 10,
        entitlement: 'anonymous'
      });

      expect(results.some((result) => result.chunk.requiresPro)).toBe(false);
      expect(results.some((result) => result.chunk.url.includes('pro.rv-grid.com'))).toBe(false);
    },
  );
});
