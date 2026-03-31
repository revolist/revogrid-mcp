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
        'src/content/docs/api/pivot.md',
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
        'src/content/demo/pivot.mdx',
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
        'src/components/pivot/Pivot.tsx',
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
        'src/components/overrides/Header.astro',
        '<header>Should be ignored</header>',
      ),
      writeFixtureFile(
        revogridProRoot,
        'release/plugins/pivot/index.ts',
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

    expect(sources.some((source) => source.relativePath.includes('src/components/overrides/Header.astro'))).toBe(false);
    expect(sources.some((source) => source.relativePath.includes('src/components/pivot/Pivot.tsx'))).toBe(true);
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
