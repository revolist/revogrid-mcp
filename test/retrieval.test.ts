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

  it('returns pro chunks through the unified search service', async () => {
    const results = await service.searchDocs('pivot feature', {
      limit: 5
    });

    expect(results.some((result) => result.chunk.id === 'guide-pivot-overview')).toBe(true);
  });

  it('preserves requiresPro as an explicit product metadata filter', async () => {
    const results = await service.searchDocs('pivot feature', {
      limit: 5,
      requiresPro: false
    });

    expect(results.some((result) => result.chunk.requiresPro)).toBe(false);
  });

  it('applies framework filters', async () => {
    const results = await service.searchDocs('editable grid', {
      framework: 'react',
      limit: 5
    });

    expect(results[0]?.chunk.framework).toBe('react');
  });

  it('returns deterministic ordering for the same seeded query', () => {
    const chunks = buildSeedDataset().chunks;
    const filters = {
      limit: 5
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
      limit: 10
    });

    expect(internalOnly).toHaveLength(1);
    expect(internalOnly[0]?.chunk.id).toBe('revogrid-internal-flag');
  });
});

describe('retrieval quality', () => {
  let dataset: SeedDataset;

  beforeAll(async () => {
    dataset = await buildCatalogDataset();
  }, 30000);

  it.each([
    ['custom editor react', 'revogrid-docs-guide-react-editor'],
    ['beforeedit event', 'revogrid-pro-packages-pro-plugins-event-manager-edit-interception'],
    ['column grouping', 'revogrid-docs-guide-column-grouping'],
    ['row grouping', 'revogrid-docs-guide-row-grouping'],
    ['pivot dimensions', 'revogrid-pro-apps-portal-src-content-docs-guides-pivot-concepts-dimensions'],
    ['tree data', 'revogrid-docs-guide-tree-data'],
    ['infinite scroll', 'revogrid-pro-apps-portal-src-content-docs-guides-infinity-scroll'],
    ['export excel', 'revogrid-docs-guide-data-grid-export-excel'],
    ['filter plugin', 'revogrid-docs-guide-demos-js-js-filtering'],
    ['angular setup', 'revogrid-docs-guide-demos-angular-angular-sample-module']
  ])('puts the intended local catalog result first for "%s"', (query, expectedTopId) => {
    const results = hybridSearch(query, dataset.chunks, {
      limit: 5
    });

    expect(results[0]?.chunk.id).toBe(expectedTopId);
  });

  it('deduplicates repeated chunk ids before returning results', () => {
    const results = hybridSearch('export excel', dataset.chunks, {
      limit: 10
    });
    const resultIds = results.map((result) => result.chunk.id);

    expect(new Set(resultIds).size).toBe(resultIds.length);
    expect(results[0]?.chunk.docType).toBe('guide');
  });

  it('exposes every indexed Pro plugin as a canonical feature', () => {
    const indexedPluginSlugs = new Set(
      dataset.chunks
        .map((chunk) => chunk.sourcePath?.match(
          /^revogrid-pro\/packages\/(?:pro|enterprise)\/plugins\/([^/]+)\//,
        )?.[1])
        .filter((slug): slug is string => Boolean(slug))
    );
    const canonicalFeatureNames = new Set(
      dataset.features.map((feature) => feature.featureName.toLowerCase())
    );
    const missingFeatures = [...indexedPluginSlugs]
      .map((slug) => slug.replace(/[-_]+/g, ' '))
      .filter((featureName) => !canonicalFeatureNames.has(featureName));
    const scheduler = dataset.features.find(
      (feature) => feature.featureName.toLowerCase() === 'event scheduler'
    );

    expect(indexedPluginSlugs).toContain('kanban');
    expect(indexedPluginSlugs).toContain('event-scheduler');
    expect(missingFeatures).toEqual([]);
    expect(scheduler?.aliases).toContain('scheduler');
  });

  it('indexes token-free MCP setup guidance', () => {
    const guide = dataset.chunks.find(
      (chunk) => chunk.id === 'revogrid-pro-apps-portal-src-content-docs-guides-ai-mcp',
    );

    expect(guide?.body).toContain('No MCP access token');
    expect(guide?.body).not.toContain('Authorization: Bearer');
    expect(guide?.body).not.toContain('valid bearer token');
  });

  it.each(['pivot dimensions', 'tree data', 'infinite scroll', 'export excel'])(
    'returns labeled Pro knowledge for pro-heavy query "%s"',
    (query) => {
      const results = hybridSearch(query, dataset.chunks, {
        limit: 10
      });

      expect(results.some((result) => result.chunk.requiresPro)).toBe(true);
      expect(results.some((result) => result.chunk.url.includes('pro.rv-grid.com'))).toBe(true);
    },
  );
});
