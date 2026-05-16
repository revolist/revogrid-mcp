import { describe, expect, it } from 'vitest';

import type { SeedDataset } from '@revogrid-mcp/content-model';
import { buildSeedDataset } from '@revogrid-mcp/ingestion';

import { handleFindExamples } from '../src/mcp/tools/findExamples.js';
import { handleGetMigrationNotes } from '../src/mcp/tools/getMigrationNotes.js';
import { handleResolveFeatureMatrix } from '../src/mcp/tools/resolveFeatureMatrix.js';
import { handleSearchRevogridDocs } from '../src/mcp/tools/searchRevogridDocs.js';
import { readFeatureMatrixResource } from '../src/mcp/resources/featureMatrix.js';
import { readCatalogCoverageResource } from '../src/mcp/resources/versions.js';
import { InMemoryContentRepository } from '../src/repositories/inMemoryContentRepository.js';
import { DefaultFeatureMatrixService } from '../src/services/featureService.js';
import { DefaultMigrationService } from '../src/services/migrationService.js';
import { DefaultRevogridSearchService } from '../src/services/searchService.js';

function createTestServices(dataset: SeedDataset = buildSeedDataset()) {
  const repository = new InMemoryContentRepository(dataset);
  const searchService = new DefaultRevogridSearchService(repository);

  return {
    contentRepository: repository,
    searchService,
    featureService: new DefaultFeatureMatrixService(repository),
    migrationService: new DefaultMigrationService(repository)
  };
}

describe('MCP tool handlers', () => {
  const services = createTestServices();

  it('searches docs for editable React grid guides before examples', async () => {
    const result = await handleSearchRevogridDocs(
      {
        query: 'editable React grid',
        framework: 'react'
      },
      services,
      { entitlement: 'anonymous' },
    );

    expect(result.results[0]?.id).toBe('guide-react-getting-started');
  });

  it('keeps anonymous search results free of pro chunks even when requiresPro is requested', async () => {
    const result = await handleSearchRevogridDocs(
      {
        query: 'pivot feature',
        requiresPro: true
      },
      services,
      { entitlement: 'anonymous' },
    );

    expect(result.results).toEqual([]);
  });

  it('returns a migration suggestion for upgrade-like searches', async () => {
    const result = await handleSearchRevogridDocs(
      {
        query: 'upgrade from v4 to v5'
      },
      services,
      { entitlement: 'anonymous' },
    );

    expect(result.suggestedNextTool).toBe('get_migration_notes');
  });

  it('finds custom column type examples', async () => {
    const result = await handleFindExamples(
      {
        query: 'custom column type'
      },
      services,
      { entitlement: 'anonymous' },
    );

    expect(result.results[0]?.id).toBe('example-custom-column-type');
  });

  it('keeps anonymous example results free of pro demos', async () => {
    const result = await handleFindExamples(
      {
        query: 'pivot feature',
        surface: 'pivot'
      },
      services,
      { entitlement: 'anonymous' },
    );

    expect(result.results).toEqual([]);
  });

  it('returns pro examples for paid users', async () => {
    const result = await handleFindExamples(
      {
        query: 'pivot feature'
      },
      services,
      { entitlement: 'paid_pro' },
    );

    expect(result.results[0]?.id).toBe('example-pivot-demo');
  });

  it('does not return pro plugin source files from find_examples', async () => {
    const dataset = buildSeedDataset();
    const services = createTestServices({
      ...dataset,
      chunks: [
        ...dataset.chunks,
        {
          id: 'revogrid-pro-packages-enterprise-plugins-pivot-index',
          title: 'Pivot plugin source',
          body: 'PivotPlugin source implementation for pivot feature internals.',
          summary: 'Pivot plugin source implementation.',
          surface: 'pivot',
          docType: 'api',
          version: '1.5.20',
          requiresPro: true,
          symbols: ['PivotPlugin'],
          stability: 'stable',
          url: 'https://pro.rv-grid.com/api/pivot',
          sourcePath: 'revogrid-pro/packages/enterprise/plugins/pivot/index.ts'
        },
        {
          id: 'revogrid-pro-examples-components-pivot',
          title: 'Pivot example',
          body: 'Runnable pivot feature example from the examples package.',
          summary: 'Runnable pivot example.',
          surface: 'pivot',
          docType: 'example',
          version: '1.5.20',
          requiresPro: true,
          symbols: ['PivotPlugin'],
          stability: 'stable',
          url: 'https://pro.rv-grid.com/demo/pivot',
          sourcePath: 'revogrid-pro/examples/components/src/components/pivot/Pivot.tsx'
        }
      ]
    });

    const result = await handleFindExamples(
      {
        query: 'pivot feature',
        surface: 'pivot'
      },
      services,
      { entitlement: 'paid_pro' },
    );

    expect(result.results.map((item) => item.id)).toContain('revogrid-pro-examples-components-pivot');
    expect(result.results.map((item) => item.sourceUrl)).not.toContain(
      'repo://revogrid-pro/packages/enterprise/plugins/pivot/index.ts',
    );
  });

  it('resolves beforeedit as a supported feature', async () => {
    const result = await handleResolveFeatureMatrix(
      {
        featureName: 'beforeedit'
      },
      services,
      { entitlement: 'anonymous' },
    );

    expect(result.supported).toBe(true);
    expect(result.requiresPro).toBe(false);
  });

  it('does not leak pro docs to anonymous pivot lookups', async () => {
    const result = await handleResolveFeatureMatrix(
      {
        featureName: 'pivot feature'
      },
      services,
      { entitlement: 'anonymous' },
    );

    expect(result.requiresPro).toBe(true);
    expect(result.bestDocs).toEqual([]);
    expect(result.bestExamples).toEqual([]);
  });

  it('keeps explicit internal feature artifacts hidden from anonymous detail views', async () => {
    const services = createTestServices({
      chunks: [
        {
          id: 'revogrid-src-internal-audit',
          title: 'Internal audit API',
          body: 'Audit helper for internal diagnostics.',
          summary: 'Internal implementation API.',
          framework: 'vanilla',
          surface: 'internal',
          docType: 'api',
          version: '5.2.0',
          requiresPro: true,
          symbols: ['internal', 'audit'],
          stability: 'stable',
          url: 'https://pro.rv-grid.com/api/internal-audit'
        }
      ],
      versions: [],
      features: [
        {
          featureName: 'internal audit',
          supported: true,
          requiresPro: true,
          supportedFrameworks: ['vanilla'],
          notes: ['Internal feature from implementation artifact.'],
          relatedChunkIds: ['revogrid-src-internal-audit'],
          relatedExampleIds: [],
          aliases: ['internal audit', 'audit']
        }
      ],
      migrations: []
    });

    const result = await handleResolveFeatureMatrix(
      {
        featureName: 'internal audit'
      },
      services,
      { entitlement: 'anonymous' },
    );

    expect(result.supported).toBe(true);
    expect(result.requiresPro).toBe(true);
    expect(result.bestDocs).toEqual([]);
    expect(result.bestExamples).toEqual([]);
  });

  it('returns catalog coverage summary for anonymous users', async () => {
    const coverage = await readCatalogCoverageResource(services, { entitlement: 'anonymous' });

    expect(coverage.chunkCount).toBeGreaterThan(0);
    expect(coverage.bySurface).toHaveProperty('core');
    expect(coverage.byRepository).toHaveProperty('revogrid');
  });

  it('keeps anonymous feature matrix resources free of pro-only feature metadata', async () => {
    const services = createTestServices({
      chunks: [
        {
          id: 'guide-public-feature',
          title: 'Public feature',
          body: 'Public feature docs.',
          summary: 'Public feature docs.',
          framework: 'vanilla',
          surface: 'core',
          docType: 'guide',
          version: '5.2.0',
          requiresPro: false,
          symbols: ['public'],
          stability: 'stable',
          url: 'https://rv-grid.com/guide/public',
          sourcePath: 'revogrid/docs/guide/public.md'
        },
        {
          id: 'guide-pro-feature',
          title: 'Pro feature',
          body: 'Pro feature docs.',
          summary: 'Pro feature docs.',
          framework: 'vanilla',
          surface: 'pivot',
          docType: 'guide',
          version: '5.2.0',
          requiresPro: true,
          symbols: ['pro'],
          stability: 'stable',
          url: 'https://pro.rv-grid.com/pivot',
          sourcePath: 'revogrid-pro/packages/enterprise/plugins/pivot/index.ts'
        }
      ],
      versions: [],
      features: [
        {
          featureName: 'public feature',
          supported: true,
          requiresPro: false,
          supportedFrameworks: ['vanilla'],
          notes: ['Public feature docs.'],
          relatedChunkIds: ['guide-public-feature'],
          relatedExampleIds: [],
          aliases: ['public feature']
        },
        {
          featureName: 'pro feature',
          supported: true,
          requiresPro: true,
          supportedFrameworks: ['vanilla'],
          notes: ['Pro feature docs.'],
          relatedChunkIds: ['guide-pro-feature'],
          relatedExampleIds: [],
          aliases: ['pro feature']
        }
      ],
      migrations: []
    });

    const matrix = await readFeatureMatrixResource(services, { entitlement: 'anonymous' });
    const coverage = await readCatalogCoverageResource(services, { entitlement: 'anonymous' });

    expect(matrix.map((feature) => feature.featureName)).toEqual(['public feature']);
    expect(matrix[0]?.catalogCoverage.byRepository).not.toHaveProperty('revogrid-pro');
    expect(coverage.byRepository).not.toHaveProperty('revogrid-pro');
    expect(coverage.requiresProChunkCount).toBe(0);
  });

  it('keeps anonymous internal-surface searches off requires-pro implementation chunks', async () => {
    const services = createTestServices({
      chunks: [
        {
          id: 'revogrid-internal-debug',
          title: 'Internal debug API',
          body: 'Internal debug helper.',
          summary: 'Internal-only API chunk.',
          framework: 'vanilla',
          surface: 'internal',
          docType: 'api',
          version: '5.2.0',
          requiresPro: true,
          symbols: ['debug'],
          stability: 'stable',
          url: 'https://pro.rv-grid.com/api/debug',
          sourcePath: 'revogrid/src/internal/debug.ts'
        },
        {
          id: 'revogrid-internal-helper',
          title: 'Internal helper API',
          body: 'Public-safe internal helper.',
          summary: 'Internal public implementation API.',
          framework: 'vanilla',
          surface: 'internal',
          docType: 'api',
          version: '5.2.0',
          requiresPro: false,
          symbols: ['helper'],
          stability: 'stable',
          url: 'https://rv-grid.com/api/helper',
          sourcePath: 'revogrid/src/internal/helper.ts'
        }
      ],
      versions: [],
      features: [],
      migrations: []
    });

    const result = await handleSearchRevogridDocs(
      {
        query: 'internal',
        surface: 'internal'
      },
      services,
      { entitlement: 'anonymous' },
    );

    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.id).toBe('revogrid-internal-helper');
  });

  it('returns a structured unsupported response for unknown features', async () => {
    const result = await handleResolveFeatureMatrix(
      {
        featureName: 'unknown feature'
      },
      services,
      { entitlement: 'anonymous' },
    );

    expect(result.supported).toBe(false);
    expect(result.bestDocs).toEqual([]);
    expect(result.bestExamples).toEqual([]);
  });

  it('returns migration notes between versions', async () => {
    const result = await handleGetMigrationNotes(
      {
        fromVersion: '4.15.0',
        toVersion: '5.2.0'
      },
      services,
      { entitlement: 'anonymous' },
    );

    expect(result.renamedSymbols[0]).toEqual({
      from: 'beforeEdit',
      to: 'beforeedit'
    });
  });

  it('falls back to symbol and title metadata when a feature is not precomputed', async () => {
    const services = createTestServices({
      chunks: [
        {
          id: 'guide-sorting',
          title: 'Sorting',
          body: 'Sorting supports multiple columns and sorting lifecycle events.',
          summary: 'Sorting guide.',
          framework: 'vanilla',
          surface: 'core',
          docType: 'guide',
          version: '5.2.0',
          requiresPro: false,
          symbols: ['SortingPlugin', 'sorting'],
          stability: 'stable',
          url: 'https://rv-grid.com/guide/sorting'
        },
        {
          id: 'api-column-grouping',
          title: 'Interface: ColumnGrouping<T>',
          body: 'ColumnGrouping defines grouped column headers.',
          summary: 'Column grouping API.',
          framework: 'vanilla',
          surface: 'core',
          docType: 'api',
          version: '5.2.0',
          requiresPro: false,
          symbols: ['ColumnGrouping'],
          stability: 'stable',
          url: 'https://rv-grid.com/guide/types/Interface.ColumnGrouping'
        },
        {
          id: 'plugin-tree-data',
          title: 'Tree data plugin',
          body: 'TreeDataPlugin enables hierarchical row expansion.',
          summary: 'Tree data plugin guide.',
          framework: 'vanilla',
          surface: 'plugin',
          docType: 'guide',
          version: '5.2.0',
          requiresPro: true,
          symbols: ['TreeDataPlugin'],
          stability: 'stable',
          url: 'https://pro.rv-grid.com/plugins/tree-data'
        }
      ],
      versions: [],
      features: [],
      migrations: []
    });

    const sorting = await handleResolveFeatureMatrix(
      {
        featureName: 'sorting'
      },
      services,
      { entitlement: 'anonymous' },
    );
    const columnGrouping = await handleResolveFeatureMatrix(
      {
        featureName: 'ColumnGrouping'
      },
      services,
      { entitlement: 'anonymous' },
    );
    const treeData = await handleResolveFeatureMatrix(
      {
        featureName: 'TreeDataPlugin'
      },
      services,
      { entitlement: 'anonymous' },
    );

    expect(sorting.supported).toBe(true);
    expect(sorting.featureName).toBe('sorting');
    expect(sorting.bestDocs[0]?.id).toBe('guide-sorting');
    expect(columnGrouping.supported).toBe(true);
    expect(columnGrouping.featureName).toBe('ColumnGrouping');
    expect(columnGrouping.bestDocs[0]?.id).toBe('api-column-grouping');
    expect(treeData.supported).toBe(true);
    expect(treeData.requiresPro).toBe(true);
    expect(treeData.bestDocs).toEqual([]);
  });

  it('returns closest migration notes for matching release lines when no exact pair exists', async () => {
    const services = createTestServices({
      chunks: [
        {
          id: 'migration-v4-guide',
          title: 'V4 Migration Guide',
          body: 'Updated event names. beforeEdit -> beforeedit.',
          summary: 'Migration notes for the 4.x release line.',
          framework: 'vanilla',
          surface: 'migration',
          docType: 'migration',
          version: '4.20.1',
          requiresPro: false,
          symbols: ['beforeedit'],
          stability: 'stable',
          url: 'https://rv-grid.com/guide/migrations/v4'
        }
      ],
      versions: [],
      features: [],
      migrations: [
        {
          id: 'migration-3x-to-4x',
          fromVersion: '3.x',
          toVersion: '4.x',
          breakingChanges: ['Updated event names to lowercase.'],
          renamedSymbols: [
            {
              from: 'beforeEdit',
              to: 'beforeedit'
            }
          ],
          changedDefaults: [],
          packageChanges: ['Upgrade revogrid packages to the 4.x release line.'],
          recommendedDocIds: ['migration-v4-guide'],
          recommendedExampleIds: []
        }
      ]
    });

    const directUpgrade = await handleGetMigrationNotes(
      {
        fromVersion: '3.0.0',
        toVersion: '4.0.0'
      },
      services,
      { entitlement: 'anonymous' },
    );
    const intraMajorUpgrade = await handleGetMigrationNotes(
      {
        fromVersion: '4.0.0',
        toVersion: '4.1.0'
      },
      services,
      { entitlement: 'anonymous' },
    );

    expect(directUpgrade.renamedSymbols).toContainEqual({
      from: 'beforeEdit',
      to: 'beforeedit'
    });
    expect(directUpgrade.recommendedDocs[0]?.id).toBe('migration-v4-guide');
    expect(intraMajorUpgrade.renamedSymbols).toContainEqual({
      from: 'beforeEdit',
      to: 'beforeedit'
    });
    expect(intraMajorUpgrade.recommendedDocs[0]?.title).toBe('V4 Migration Guide');
  });

  it('allows framework-specific migration records to satisfy framework-agnostic requests', async () => {
    const services = createTestServices({
      chunks: [
        {
          id: 'migration-v4-guide',
          title: 'V4 Migration Guide',
          body: 'Updated event names. beforeEdit -> beforeedit.',
          summary: 'Migration notes for the 4.x release line.',
          framework: 'react',
          surface: 'migration',
          docType: 'migration',
          version: '4.20.1',
          requiresPro: false,
          symbols: ['beforeedit'],
          stability: 'stable',
          url: 'https://rv-grid.com/guide/migrations/v4'
        }
      ],
      versions: [],
      features: [],
      migrations: [
        {
          id: 'migration-3x-to-4x-react',
          fromVersion: '3.x',
          toVersion: '4.x',
          framework: 'react',
          breakingChanges: ['Updated event names to lowercase.'],
          renamedSymbols: [
            {
              from: 'beforeEdit',
              to: 'beforeedit'
            }
          ],
          changedDefaults: [],
          packageChanges: ['Upgrade revogrid packages to the 4.x release line.'],
          recommendedDocIds: ['migration-v4-guide'],
          recommendedExampleIds: []
        }
      ]
    });

    const result = await handleGetMigrationNotes(
      {
        fromVersion: '3.0.0',
        toVersion: '4.0.0'
      },
      services,
      { entitlement: 'anonymous' },
    );

    expect(result.renamedSymbols).toContainEqual({
      from: 'beforeEdit',
      to: 'beforeedit'
    });
    expect(result.recommendedDocs[0]?.id).toBe('migration-v4-guide');
  });

  it('returns empty migration arrays when the version pair is unknown', async () => {
    const result = await handleGetMigrationNotes(
      {
        fromVersion: '1.0.0',
        toVersion: '9.0.0'
      },
      services,
      { entitlement: 'anonymous' },
    );

    expect(result.breakingChanges).toEqual([]);
    expect(result.recommendedDocs).toEqual([]);
    expect(result.recommendedExamples).toEqual([]);
  });
});
