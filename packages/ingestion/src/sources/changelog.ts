import { collectSourceFiles, resolveSourceRoot } from './_shared.js';

export async function getChangelogSources() {
  const revogridRoot = await resolveSourceRoot(import.meta.url, 'revogrid');

  return collectSourceFiles(revogridRoot, 'changelog', [
    'docs/guide/migrations',
    'docs/blog',
    'docs/release.mjs'
  ]);
}
