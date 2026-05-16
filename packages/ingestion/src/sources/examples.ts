import { collectSourceFiles, resolveSourceRoot } from './_shared.js';
import { REVOGRID_EXAMPLE_PATHS, REVOGRID_PRO_EXAMPLE_PATHS } from './sourceMap.js';

export async function getExampleSources() {
  const revogridRoot = await resolveSourceRoot(import.meta.url, 'revogrid');
  const revogridProRoot = await resolveSourceRoot(import.meta.url, 'revogrid-pro');

  const [publicExamples, proExamples] = await Promise.all([
    collectSourceFiles(revogridRoot, 'examples', [...REVOGRID_EXAMPLE_PATHS]),
    collectSourceFiles(revogridProRoot, 'examples', [...REVOGRID_PRO_EXAMPLE_PATHS])
  ]);

  return [
    ...publicExamples,
    ...proExamples.filter(isExampleComponentSource)
  ];
}

function isExampleComponentSource(source: { relativePath: string }): boolean {
  const relativePath = source.relativePath.replace(/\\/g, '/');

  if (
    relativePath.startsWith('src/components/overrides/') ||
    relativePath.startsWith('src/components/composables/') ||
    relativePath.startsWith('src/components/sys-data/') ||
    relativePath.startsWith('examples/components/src/components/overrides/') ||
    relativePath.startsWith('examples/components/src/components/composables/') ||
    relativePath.startsWith('examples/components/src/components/sys-data/') ||
    relativePath.startsWith('examples/components/src/components/shared/') ||
    relativePath.startsWith('apps/portal/src/components/overrides/') ||
    relativePath.startsWith('apps/portal/src/components/composables/') ||
    relativePath.startsWith('apps/portal/src/components/sys-data/') ||
    relativePath.startsWith('apps/demos/src/components/overrides/') ||
    relativePath.startsWith('apps/demos/src/components/composables/') ||
    relativePath.startsWith('apps/demos/src/components/sys-data/')
  ) {
    return false;
  }

  return true;
}
