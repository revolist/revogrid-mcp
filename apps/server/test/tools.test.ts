import { describe, expect, it } from 'vitest';

import { buildSeedDataset } from '@revogrid-mcp/ingestion';

import { handleFindExamples } from '../src/mcp/tools/findExamples.js';
import { handleGetMigrationNotes } from '../src/mcp/tools/getMigrationNotes.js';
import { handleResolveFeatureMatrix } from '../src/mcp/tools/resolveFeatureMatrix.js';
import { handleSearchRevogridDocs } from '../src/mcp/tools/searchRevogridDocs.js';
import { InMemoryContentRepository } from '../src/repositories/inMemoryContentRepository.js';
import { DefaultFeatureMatrixService } from '../src/services/featureService.js';
import { DefaultMigrationService } from '../src/services/migrationService.js';
import { DefaultRevogridSearchService } from '../src/services/searchService.js';

function createTestServices() {
  const repository = new InMemoryContentRepository(buildSeedDataset());
  const searchService = new DefaultRevogridSearchService(repository);

  return {
    contentRepository: repository,
    searchService,
    featureService: new DefaultFeatureMatrixService(repository, searchService),
    migrationService: new DefaultMigrationService(repository, searchService)
  };
}

describe('MCP tool handlers', () => {
  const services = createTestServices();

  it('searches docs for editable React grid', async () => {
    const result = await handleSearchRevogridDocs(
      {
        query: 'editable React grid',
        framework: 'react'
      },
      services,
      { entitlement: 'anonymous' },
    );

    expect(result.results[0]?.id).toBe('example-react-editable-grid');
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
