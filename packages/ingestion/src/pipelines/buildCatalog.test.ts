import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getExampleSources } from '../sources/examples.js';
import { buildCatalogDataset } from './buildCatalog.js';

describe.sequential('buildCatalogDataset', () => {
  let fixtureRoot = '';
  let previousRevogridRoot: string | undefined;
  let previousRevogridProRoot: string | undefined;

  beforeEach(async () => {
    previousRevogridRoot = process.env.REVOGRID_SOURCE_ROOT;
    previousRevogridProRoot = process.env.REVOGRID_PRO_SOURCE_ROOT;
    fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'revogrid-mcp-ingestion-'));

    const revogridRoot = path.join(fixtureRoot, 'revogrid');
    const revogridProRoot = path.join(fixtureRoot, 'revogrid-pro');

    await Promise.all([
      writeFixtureFile(
        revogridRoot,
        'package.json',
        JSON.stringify({ name: 'revogrid', version: '4.21.2' }, null, 2),
      ),
      writeFixtureFile(
        revogridRoot,
        'docs/guide/overview.md',
        [
          '---',
          'title: JavaScript Data Grid Overview',
          'description: Public overview of RevoGrid.',
          '---',
          '',
          '# Overview',
          '',
          'RevoGrid handles large datasets with virtual scrolling and editing.'
        ].join('\n'),
      ),
      writeFixtureFile(
        revogridRoot,
        'docs/pro/compatibility.md',
        [
          '# Pro Compatibility',
          '',
          'This is internal-facing public notes that mention Pro capabilities.'
        ].join('\n'),
      ),
      writeFixtureFile(
        revogridRoot,
        'readme/README.md',
        [
          '# Readme Index',
          '',
          'General project readme and quick links.'
        ].join('\n'),
      ),
      writeFixtureFile(
        revogridRoot,
        'packages/widget/README.md',
        [
          '# Widget package',
          '',
          'Standalone package notes and examples.'
        ].join('\n'),
      ),
      writeFixtureFile(
        revogridRoot,
        'formats/number/README.md',
        [
          '# Number format',
          '',
          'Custom column format implementation notes.'
        ].join('\n'),
      ),
      writeFixtureFile(
        revogridRoot,
        'src/test/internal-behavior.ts',
        [
          'export function internalBehavior() {',
          '  return \"internal\";',
          '}'
        ].join('\n'),
      ),
      writeFixtureFile(
        revogridRoot,
        'dist/bundles/skip-this.md',
        '# This file should be excluded',
      ),
      writeFixtureFile(
        revogridRoot,
        'docs/demo/react/react-datagrid.md',
        [
          '---',
          'title: Demo React Data Grid and Table',
          'description: Show case of React Data Grid implemented in RevoGrid.',
          '---',
          '',
          '[Edit demo](https://codesandbox.io/p/sandbox/react-revogrid-start-29fm5z)',
          '',
          'React example with `beforeedit` and editable columns.'
        ].join('\n'),
      ),
      writeFixtureFile(
        revogridRoot,
        'docs/guide/angular/_examples.md',
        [
          '# Examples',
          '',
          'Angular wrapper setup examples.'
        ].join('\n'),
      ),
      writeFixtureFile(
        revogridRoot,
        'docs/guide/parts/framework.md',
        [
          '# Framework',
          '',
          'Shared framework notes mention React, Vue, Angular, and Svelte together.'
        ].join('\n'),
      ),
      writeFixtureFile(
        revogridRoot,
        'docs/guide/pro-mention.md',
        [
          '# Public Pro Mention',
          '',
          'This public comparison mentions the Pro version, commercial licensing, and @revolist/revogrid-pro as adjacent context.'
        ].join('\n'),
      ),
      writeFixtureFile(
        revogridRoot,
        'docs/guide/migrations/v4.md',
        [
          '# Migration Guide',
          '',
          '## Properties Changes',
          '',
          '- **`hideAttribution`**: **Default**: `false`',
          '',
          'Updated event names. For example, `beforeEdit` -> `beforeedit`.'
        ].join('\n'),
      ),
      writeFixtureFile(
        revogridRoot,
        'docs/guide/types/TypeAlias.BeforeEdit.md',
        [
          '---',
          'title: BeforeEdit',
          '---',
          '',
          'Type alias for `beforeedit`.'
        ].join('\n'),
      ),
      writeFixtureFile(
        revogridRoot,
        'src/types/interfaces.ts',
        [
          'export interface BeforeEditArgs {',
          '  prop: string;',
          '}',
          '',
          'export type ColumnRegular = { prop: string };'
        ].join('\n'),
      ),
      writeFixtureFile(
        revogridProRoot,
        'package.json',
        JSON.stringify({ name: 'revogrid-pro', version: '1.5.20' }, null, 2),
      ),
      writeFixtureFile(
        revogridProRoot,
        'apps/portal/src/content/docs/api/pivot.md',
        [
          '---',
          'title: Pivot',
          'description: Pivot module API.',
          '---',
          '',
          'Use `PivotPlugin` from `@revolist/revogrid-pro`.',
          '',
          'Supports dimensions, values, and configurator state.'
        ].join('\n'),
      ),
      writeFixtureFile(
        revogridProRoot,
        'apps/portal/src/content/demo/pivot.mdx',
        [
          '---',
          'title: Pivot Demo',
          'description: Pivot table demo.',
          '---',
          '',
          'import Component from "/src/components/pivot/Pivot.astro";',
          '',
          '<Component />'
        ].join('\n'),
      ),
      writeFixtureFile(
        revogridProRoot,
        'packages/enterprise/plugins/pivot/PIVOT_FEATURES.md',
        [
          '# Pivot feature matrix',
          '',
          '| Feature | React | Angular | Enterprise | Notes |',
          '| --- | --- | --- | --- | --- |',
          '| Hierarchical rows | Yes | Yes | No | Supports tree-style row grouping in matrix mode. |',
          '| Enterprise export | No | No | No | Only for enterprise licensing. |'
        ].join('\n'),
      ),
      writeFixtureFile(
        revogridProRoot,
        'packages/enterprise/plugins/pivot/FEATURES_MATRIX.md',
        [
          '# Pivot feature list',
          '- [ ] Legacy aggregate mode',
          '- [x] Legacy formulas',
          '- [ ] Legacy header controls'
        ].join('\n'),
      ),
      writeFixtureFile(
        revogridProRoot,
        'examples/components/src/components/pivot/Pivot.tsx',
        [
          'import { PivotPlugin } from "@revolist/revogrid-pro";',
          '',
          'export function PivotExample() {',
          '  return PivotPlugin;',
          '}'
        ].join('\n'),
      ),
      writeFixtureFile(
        revogridProRoot,
        'examples/components/src/components/overrides/Header.astro',
        '<header>Should be ignored</header>',
      ),
      writeFixtureFile(
        revogridProRoot,
        'examples/core/src/core-examples/start/index.ts',
        [
          'import { RevoGrid } from "@revolist/revogrid";',
          '',
          'export const columns = [{ prop: "name", name: "Name" }];',
          'export const source = [{ name: "RevoGrid" }];',
          'export default RevoGrid;'
        ].join('\n'),
      ),
      writeFixtureFile(
        revogridProRoot,
        'packages/enterprise/plugins/pivot/index.ts',
        [
          'export class PivotPlugin {',
          '  applyPivot() {}',
          '}'
        ].join('\n'),
      )
    ]);

    process.env.REVOGRID_SOURCE_ROOT = revogridRoot;
    process.env.REVOGRID_PRO_SOURCE_ROOT = revogridProRoot;
  });

  afterEach(async () => {
    if (previousRevogridRoot === undefined) {
      delete process.env.REVOGRID_SOURCE_ROOT;
    } else {
      process.env.REVOGRID_SOURCE_ROOT = previousRevogridRoot;
    }

    if (previousRevogridProRoot === undefined) {
      delete process.env.REVOGRID_PRO_SOURCE_ROOT;
    } else {
      process.env.REVOGRID_PRO_SOURCE_ROOT = previousRevogridProRoot;
    }

    await rm(fixtureRoot, { recursive: true, force: true });
  });

  it('builds chunks from real public and pro source adapters', async () => {
    const dataset = await buildCatalogDataset();

    expect(dataset.chunks.length).toBeGreaterThanOrEqual(7);
    expect(dataset.chunks.some((chunk) => chunk.title === 'JavaScript Data Grid Overview')).toBe(true);
    expect(dataset.chunks.some((chunk) => chunk.title === 'Pivot')).toBe(true);
    expect(dataset.chunks.some((chunk) => chunk.sourcePath === 'revogrid/readme/README.md')).toBe(true);
    expect(dataset.chunks.some((chunk) => chunk.sourcePath === 'revogrid/packages/widget/README.md')).toBe(true);
    expect(dataset.chunks.some((chunk) => chunk.sourcePath === 'revogrid/src/test/internal-behavior.ts')).toBe(true);
  });

  it('includes feature artifact files and merges explicit feature matrix records', async () => {
    const dataset = await buildCatalogDataset();
    const featureNames = dataset.features.map((feature) => feature.featureName.toLowerCase());

    expect(featureNames).toContain('hierarchical rows');
    expect(featureNames).toContain('enterprise export');
    expect(featureNames).toContain('legacy formulas');
    expect(featureNames).toContain('legacy aggregate mode');

    const enterpriseExport = dataset.features.find(
      (feature) => feature.featureName.toLowerCase() === 'enterprise export',
    );
    expect(enterpriseExport).toMatchObject({
      supported: false,
      requiresPro: true
    });
  });

  it('keeps excluded build outputs out of chunking', async () => {
    const dataset = await buildCatalogDataset();
    expect(dataset.chunks.some((chunk) => chunk.sourcePath === 'revogrid/dist/bundles/skip-this.md')).toBe(false);
  });

  it('classifies internal source files as internal surface while leaving docs as user-facing', async () => {
    const dataset = await buildCatalogDataset();
    const internalChunk = dataset.chunks.find(
      (chunk) => chunk.sourcePath === 'revogrid/src/test/internal-behavior.ts',
    );
    const docsChunk = dataset.chunks.find(
      (chunk) => chunk.sourcePath === 'revogrid/docs/pro/compatibility.md',
    );
    const formatReadmeChunk = dataset.chunks.find(
      (chunk) => chunk.sourcePath === 'revogrid/formats/number/README.md',
    );

    expect(internalChunk).toMatchObject({
      surface: 'internal'
    });
    expect(docsChunk).toMatchObject({
      surface: 'core'
    });
    expect(formatReadmeChunk).toMatchObject({
      sourcePath: 'revogrid/formats/number/README.md'
    });
  });

  it('extracts framework, doc type, and example URL for React demos', async () => {
    const dataset = await buildCatalogDataset();
    const reactDemo = dataset.chunks.find((chunk) => chunk.title === 'Demo React Data Grid and Table');

    expect(reactDemo).toMatchObject({
      framework: 'react',
      docType: 'live-demo',
      requiresPro: false,
      exampleUrl: 'https://codesandbox.io/p/sandbox/react-revogrid-start-29fm5z'
    });
  });

  it('marks pivot and pro sources as requiresPro', async () => {
    const dataset = await buildCatalogDataset();
    const pivotApi = dataset.chunks.find((chunk) => chunk.title === 'Pivot');
    const pivotDemo = dataset.chunks.find((chunk) => chunk.title === 'Pivot Demo');

    expect(pivotApi).toMatchObject({
      surface: 'pivot',
      requiresPro: true
    });
    expect(pivotDemo).toMatchObject({
      surface: 'pivot',
      requiresPro: true
    });
  });

  it('uses path metadata for framework detection and cleans weak titles', async () => {
    const dataset = await buildCatalogDataset();
    const angularExamples = dataset.chunks.find(
      (chunk) => chunk.sourcePath === 'revogrid/docs/guide/angular/_examples.md',
    );
    const sharedFramework = dataset.chunks.find(
      (chunk) => chunk.sourcePath === 'revogrid/docs/guide/parts/framework.md',
    );

    expect(angularExamples).toMatchObject({
      title: 'Angular Examples',
      framework: 'angular'
    });
    expect(sharedFramework).toMatchObject({
      title: 'Framework Integration Guide',
      framework: undefined
    });
  });

  it('does not mark public comparison prose as pro-only from incidental pro mentions', async () => {
    const dataset = await buildCatalogDataset();
    const publicMention = dataset.chunks.find(
      (chunk) => chunk.sourcePath === 'revogrid/docs/guide/pro-mention.md',
    );

    expect(publicMention).toMatchObject({
      surface: 'core',
      requiresPro: false
    });
  });

  it('derives migration notes from raw markdown instead of flattened body text', async () => {
    const dataset = await buildCatalogDataset();
    const migration = dataset.migrations.find((entry) => entry.toVersion === '4.x');

    expect(migration?.renamedSymbols).toContainEqual({
      from: 'beforeEdit',
      to: 'beforeedit'
    });
    expect(migration?.changedDefaults).toContain('hideAttribution: false');
  });

  it('excludes non-example override components from the example adapter', async () => {
    const sources = await getExampleSources();

    expect(
      sources.some((source) => source.relativePath.includes('examples/components/src/components/overrides/Header.astro')),
    ).toBe(false);
    expect(sources.some((source) => source.relativePath.includes('examples/components/src/components/pivot/Pivot.tsx'))).toBe(
      true,
    );
    expect(sources.some((source) => source.relativePath.includes('examples/core/src/core-examples/start/index.ts'))).toBe(
      true,
    );
    expect(sources.some((source) => source.relativePath.includes('packages/enterprise/plugins/pivot/index.ts'))).toBe(
      false,
    );
  });

  it('maps current pro app and example layout to pro urls and gated chunks', async () => {
    const dataset = await buildCatalogDataset();
    const pivotApi = dataset.chunks.find(
      (chunk) => chunk.sourcePath === 'revogrid-pro/apps/portal/src/content/docs/api/pivot.md',
    );
    const pivotDemo = dataset.chunks.find(
      (chunk) => chunk.sourcePath === 'revogrid-pro/apps/portal/src/content/demo/pivot.mdx',
    );
    const pivotExample = dataset.chunks.find(
      (chunk) => chunk.sourcePath === 'revogrid-pro/examples/components/src/components/pivot/Pivot.tsx',
    );
    const coreExample = dataset.chunks.find(
      (chunk) => chunk.sourcePath === 'revogrid-pro/examples/core/src/core-examples/start/index.ts',
    );
    const pivotPlugin = dataset.chunks.find(
      (chunk) => chunk.sourcePath === 'revogrid-pro/packages/enterprise/plugins/pivot/index.ts',
    );

    expect(pivotApi).toMatchObject({
      requiresPro: true,
      url: 'https://pro.rv-grid.com/api/pivot'
    });
    expect(pivotDemo).toMatchObject({
      requiresPro: true,
      url: 'https://pro.rv-grid.com/demo/pivot'
    });
    expect(pivotExample).toMatchObject({
      docType: 'example',
      requiresPro: true,
      url: 'https://pro.rv-grid.com/demo/pivot'
    });
    expect(coreExample).toMatchObject({
      docType: 'example',
      requiresPro: true,
      url: 'https://pro.rv-grid.com/demo/start'
    });
    expect(pivotPlugin).toMatchObject({
      docType: 'api',
      requiresPro: true,
      url: 'https://pro.rv-grid.com/api/pivot'
    });
  });

  it('turns type files into instruction-rich API chunks', async () => {
    const dataset = await buildCatalogDataset();
    const interfacesChunk = dataset.chunks.find((chunk) => chunk.sourcePath === 'revogrid/src/types/interfaces.ts');

    expect(interfacesChunk?.title).toBe('BeforeEditArgs');
    expect(interfacesChunk?.symbols).toContain('ColumnRegular');
    expect(interfacesChunk?.body).toContain('Exported symbols: BeforeEditArgs, ColumnRegular.');
    expect(interfacesChunk?.body).toContain('Interface BeforeEditArgs');
    expect(interfacesChunk?.body).toContain('- prop: string');
  });
});

async function writeFixtureFile(rootPath: string, relativePath: string, contents: string): Promise<void> {
  const absolutePath = path.join(rootPath, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents);
}
