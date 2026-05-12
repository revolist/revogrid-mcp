import { beforeAll, describe, expect, it } from 'vitest';

import type { SeedDataset } from '@revogrid-mcp/content-model';
import type { DocumentChunk } from '@revogrid-mcp/content-model';
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

  it('respects explicit surface filters for internal references', async () => {
    const chunks: DocumentChunk[] = [
      {
        id: 'revogrid-internal-flag',
        title: 'Internal source helper',
        body: 'Source helper APIs available for internal troubleshooting.',
        summary: 'Internal API surface',
        framework: 'vanilla',
        surface: 'internal',
        docType: 'api',
        version: '5.2.0',
        requiresPro: false,
        symbols: ['internal'],
        stability: 'stable',
        url: 'https://rv-grid.com/internal/flag',
        sourcePath: 'revogrid/src/internal/flag.ts',
      },
      {
        id: 'revogrid-core-flag',
        title: 'Public source helper',
        body: 'Source helper APIs available for public usage.',
        summary: 'Core API surface',
        framework: 'vanilla',
        surface: 'core',
        docType: 'api',
        version: '5.2.0',
        requiresPro: false,
        symbols: ['public'],
        stability: 'stable',
        url: 'https://rv-grid.com/core/flag',
        sourcePath: 'revogrid/src/public/flag.ts'
      }
    ];
    const internalOnly = hybridSearch('source helper', chunks, {
      surface: 'internal',
      limit: 10,
      entitlement: 'anonymous'
    });

    expect(internalOnly).toHaveLength(1);
    expect(internalOnly[0]?.chunk.id).toBe('revogrid-internal-flag');
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
    ['pivot dimensions', 'revogrid-pro-packages-portal-src-content-docs-guides-pivot-concepts-dimensions'],
    ['tree data', 'revogrid-pro-packages-portal-src-content-docs-guides-data-manage-tree'],
    ['infinite scroll', 'revogrid-pro-packages-portal-src-content-docs-guides-infinity-scroll'],
    ['export excel', 'revogrid-pro-packages-portal-src-content-docs-guides-data-manage-excel-export'],
    ['filter plugin', 'revogrid-pro-packages-portal-src-content-docs-guides-data-filter-filter-header'],
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
