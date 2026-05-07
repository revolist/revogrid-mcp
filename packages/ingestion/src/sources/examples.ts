import { collectSourceFiles, resolveSourceRoot } from './_shared.js';

export async function getExampleSources() {
  const revogridRoot = await resolveSourceRoot(import.meta.url, 'revogrid');
  const revogridProRoot = await resolveSourceRoot(import.meta.url, 'revogrid-pro');

  const [publicExamples, proDemoContent, proComponentExamples] = await Promise.all([
    collectSourceFiles(revogridRoot, 'examples', ['docs/demo', 'packages/react/demo', 'packages/vue3/demo']),
    collectSourceFiles(revogridProRoot, 'examples', [
      'src/content/demo',
      'packages/portal/src/content/demo',
      'packages/demos/src/catalog',
      'packages/examples/src/core-examples'
    ]),
    collectSourceFiles(revogridProRoot, 'examples', [
      'src/components',
      'packages/portal/src/components',
      'packages/demos/src/components',
      'packages/examples/src/components'
    ])
  ]);

  return [
    ...publicExamples,
    ...proDemoContent,
    ...proComponentExamples.filter(isExampleComponentSource)
  ];
}

function isExampleComponentSource(source: { relativePath: string }): boolean {
  const relativePath = source.relativePath.replace(/\\/g, '/');

  if (
    relativePath.startsWith('src/components/overrides/') ||
    relativePath.startsWith('src/components/composables/') ||
    relativePath.startsWith('src/components/sys-data/') ||
    relativePath.startsWith('packages/portal/src/components/overrides/') ||
    relativePath.startsWith('packages/portal/src/components/composables/') ||
    relativePath.startsWith('packages/portal/src/components/sys-data/') ||
    relativePath.startsWith('packages/demos/src/components/overrides/') ||
    relativePath.startsWith('packages/demos/src/components/composables/') ||
    relativePath.startsWith('packages/demos/src/components/sys-data/')
  ) {
    return false;
  }

  return true;
}
