import { describe, expect, it, vi } from 'vitest';

import type { SeedDataset } from '@revogrid-mcp/content-model';

import { InMemoryContentRepository } from '../src/repositories/inMemoryContentRepository.js';
import { DefaultDeveloperCopilotService } from '../src/services/developerCopilotService.js';

const dataset: SeedDataset = {
  chunks: [{
    id: 'pivot-api',
    title: 'PivotPlugin',
    body: 'Public Pivot plugin API.',
    surface: 'pivot',
    docType: 'api',
    requiresPro: true,
    symbols: ['PivotPlugin'],
    url: 'https://pro.rv-grid.com/api/pivot',
    sourcePath: 'revogrid-pro/packages/pivot/src/pivot/index.ts',
    product: 'pivot',
    packageName: '@revolist/pivot',
    packageVersion: '2.8.2',
    visibility: 'public',
    authority: 100
  }, {
    id: 'pivot-internal',
    title: 'PivotEngineState',
    body: 'Internal implementation state.',
    surface: 'internal',
    docType: 'api',
    requiresPro: true,
    symbols: ['PivotEngineState'],
    url: 'https://pro.rv-grid.com/api/pivot',
    sourcePath: 'revogrid-pro/packages/pivot/src/internal/state.ts',
    product: 'pivot',
    packageName: '@revolist/pivot',
    packageVersion: '2.8.2',
    visibility: 'internal',
    authority: 30
  }],
  versions: [],
  features: [],
  migrations: [],
  packages: [{
    name: '@revolist/pivot',
    version: '2.8.2',
    product: 'pivot',
    tier: 'enterprise',
    requiresPro: true,
    entrypoint: 'revogrid-pro/packages/pivot/src/index.ts',
    exportEntrypoints: ['.', './styles.css'],
    dependencies: ['@revolist/revogrid-pro'],
    peerDependencies: []
  }],
  capabilities: [{
    id: '@revolist/pivot:pivotplugin',
    name: 'PivotPlugin',
    aliases: ['pivot plugin', 'pivot'],
    product: 'pivot',
    packageName: '@revolist/pivot',
    packageVersion: '2.8.2',
    tier: 'enterprise',
    requiresPro: true,
    visibility: 'public',
    stability: 'stable',
    frameworks: ['react', 'vanilla'],
    symbolKind: 'plugin',
    exportPath: '@revolist/pivot',
    configuration: ['PivotConfig'],
    configurationKeys: ['dimensions'],
    methods: ['setConfig'],
    events: ['beforepivot'],
    dependencies: ['@revolist/revogrid-pro'],
    peerDependencies: [],
    relations: [{ type: 'dependsOn', targetId: 'package:@revolist/revogrid-pro' }],
    evidence: [{
      chunkId: 'pivot-api',
      repository: 'revogrid-pro',
      sourcePath: 'revogrid-pro/packages/pivot/src/pivot/index.ts',
      url: 'https://pro.rv-grid.com/api/pivot',
      authority: 100
    }],
    relatedExampleIds: []
  }],
  snapshot: {
    schemaVersion: 2,
    generatedAt: '2026-09-04T00:00:00.000Z',
    sourceRevisions: { 'revogrid-pro': 'abc123' },
    packageCount: 1,
    capabilityCount: 1,
    publicExportCount: 1,
    exampleCount: 0
  }
};

describe('developer copilot service', () => {
  const service = new DefaultDeveloperCopilotService(new InMemoryContentRepository(dataset));

  it('lists and resolves supported public capabilities', async () => {
    const listed = await service.listCapabilities({ product: 'pivot', limit: 10 });
    const inspected = await service.inspectApi('pivot', {});

    expect(listed.results.map((item) => item.name)).toEqual(['PivotPlugin']);
    expect(inspected.match?.packageName).toBe('@revolist/pivot');
  });

  it('builds source-backed plans and validates package ownership', async () => {
    const plan = await service.planImplementation({
      objective: 'Build a React pivot grid',
      capabilities: ['pivot'],
      framework: 'react'
    });
    const validation = await service.validateUsage({
      imports: [{ packageName: '@revolist/pivot', symbols: ['MissingPlugin'] }]
    });

    expect(plan.imports).toEqual([
      { packageName: '@revolist/pivot', symbol: 'PivotPlugin', importPath: '@revolist/pivot' }
    ]);
    expect(validation.valid).toBe(false);
    expect(validation.diagnostics[0]).toMatchObject({ code: 'invalid-import', severity: 'error' });
  });

  it('keeps internals opt-in and validates configuration, dependencies, and Pro metadata', async () => {
    const hidden = await service.inspectApi('PivotEngineState', {});
    const visible = await service.inspectApi('PivotEngineState', { includeInternal: true });
    const validation = await service.validateUsage({
      framework: 'react',
      imports: [{ packageName: '@revolist/pivot', symbols: ['PivotPlugin'] }],
      configuration: [{ capability: 'PivotPlugin', keys: ['notARealConfigKey'] }]
    });

    expect(hidden.match).toBeUndefined();
    expect(hidden.candidates).toEqual([]);
    expect(visible.match).toMatchObject({ name: 'PivotEngineState', visibility: 'internal' });
    expect(validation.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'unknown-config-key', severity: 'error' }),
      expect.objectContaining({ code: 'missing-dependency', severity: 'warning' }),
      expect.objectContaining({ code: 'requires-pro', severity: 'warning' })
    ]));
  });

  it('reuses snapshot indexes, supports qualified symbols, and invalidates after promotion', async () => {
    const repository = new InMemoryContentRepository(dataset);
    const getCapabilities = vi.spyOn(repository, 'getCapabilities');
    const indexedService = new DefaultDeveloperCopilotService(repository);

    const first = await indexedService.inspectApi('@revolist/pivot#PivotPlugin', {});
    await indexedService.listCapabilities({ product: 'pivot', limit: 10 });
    await indexedService.validateUsage({
      imports: [{ packageName: '@revolist/pivot', symbols: ['PivotPlugin'] }]
    });

    expect(first.match?.id).toBe('@revolist/pivot:pivotplugin');
    expect(getCapabilities).toHaveBeenCalledTimes(1);

    repository.updateDataset({
      ...dataset,
      snapshot: {
        ...dataset.snapshot!,
        generatedAt: '2026-09-04T00:01:00.000Z'
      }
    });
    await indexedService.inspectApi('PivotPlugin', {});
    expect(getCapabilities).toHaveBeenCalledTimes(2);
  });
});
