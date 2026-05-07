import { collectSourceFiles, resolveSourceRoot } from './_shared.js';

export async function getApiSources() {
  const revogridRoot = await resolveSourceRoot(import.meta.url, 'revogrid');
  const revogridProRoot = await resolveSourceRoot(import.meta.url, 'revogrid-pro');

  const [publicApi, proApi] = await Promise.all([
    collectSourceFiles(revogridRoot, 'api', ['docs/guide/types', 'src/types']),
    collectSourceFiles(revogridProRoot, 'api', [
      'src/content/docs/api',
      'packages/portal/src/content/docs/api',
      'release/plugins',
      'packages/pro/plugins',
      'packages/enterprise/plugins'
    ])
  ]);

  return [...publicApi, ...proApi];
}
