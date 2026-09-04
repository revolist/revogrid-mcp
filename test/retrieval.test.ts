import { beforeAll, describe, expect, it } from 'vitest';

import type { SeedDataset } from '@revogrid-mcp/content-model';
import type { DocumentChunk } from '@revogrid-mcp/content-model';
import { buildCatalogDataset, buildSeedDataset, validateCatalogDataset } from '@revogrid-mcp/ingestion';

import { hybridSearch } from '../src/retrieval/hybridSearch.js';
import { InMemoryContentRepository } from '../src/repositories/inMemoryContentRepository.js';
import { DefaultDeveloperCopilotService } from '../src/services/developerCopilotService.js';
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
    ['beforeedit event', 'revogrid-pro-apps-portal-src-content-docs-api-event-manager'],
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

  it('covers every published Core and Pro-family package with public capabilities', () => {
    const packages = dataset.packages ?? [];
    const capabilities = dataset.capabilities ?? [];
    const packageNames = packages.map((item) => item.name);

    expect(packageNames).toEqual(expect.arrayContaining([
      '@revolist/revogrid',
      '@revolist/revogrid-pro',
      '@revolist/pivot',
      '@revolist/gantt',
      '@revolist/scheduler',
      '@revolist/kanban',
      '@revolist/revogrid-collaborative-editing',
      '@revolist/revogrid-enterprise'
    ]));
    for (const packageName of packageNames) {
      expect(capabilities.some((item) => item.packageName === packageName && item.visibility === 'public')).toBe(true);
    }
    expect(packages.every((item) => item.exportEntrypoints.length > 0)).toBe(true);
    expect(packages.find((item) => item.name === '@revolist/revogrid')?.exportEntrypoints).toEqual(
      expect.arrayContaining(['.', './loader', './standalone']),
    );
    expect(capabilities.find((item) => item.name === 'scheduler')?.requiresPro).toBe(true);
    expect(() => validateCatalogDataset(dataset)).not.toThrow();
  });

  it('resolves an exact public export to its direct package owner', async () => {
    const service = new DefaultDeveloperCopilotService(new InMemoryContentRepository(dataset));
    const result = await service.inspectApi('PivotPlugin', {});

    expect(result.match).toMatchObject({
      name: 'PivotPlugin',
      packageName: '@revolist/pivot',
      visibility: 'public'
    });
  });

  it('keeps portal guides public and returns registered demos as examples', () => {
    const portalGuides = dataset.chunks.filter((chunk) =>
      chunk.sourcePath?.startsWith('revogrid-pro/apps/portal/src/content/docs/guides/'),
    );
    const examples = hybridSearch('pivot', dataset.chunks, {
      docTypes: ['example', 'live-demo'],
      limit: 20
    });

    expect(portalGuides.length).toBeGreaterThan(0);
    expect(portalGuides.every((chunk) => chunk.visibility === 'public')).toBe(true);
    expect(examples.some((result) => result.chunk.sourcePath?.includes('/content/demo/'))).toBe(true);
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

  it.each([
    ['editing beforeedit event', 'core'],
    ['server side data source', 'core'],
    ['row grouping', 'core'],
    ['pivot dimensions', 'pivot'],
    ['gantt dependencies', 'gantt'],
    ['event scheduler resources', 'scheduler'],
    ['kanban cards', 'kanban'],
    ['collaborative editing', 'collaboration'],
    ['excel export', 'core'],
    ['accessibility keyboard', 'core']
  ])('returns %s evidence for the %s product within the top three', (query, product) => {
    const results = hybridSearch(query, dataset.chunks, { limit: 3 });
    expect(results.some((result) => result.chunk.product === product)).toBe(true);
    expect(results.every((result) => result.chunk.visibility !== 'internal')).toBe(true);
  });
});
