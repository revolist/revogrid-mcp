import { collectSourceFiles, resolveSourceRoot } from './_shared.js';

export async function getDocsSources() {
  const revogridRoot = await resolveSourceRoot(import.meta.url, 'revogrid');
  const revogridProRoot = await resolveSourceRoot(import.meta.url, 'revogrid-pro');

  const [publicDocs, proDocs] = await Promise.all([
    collectSourceFiles(revogridRoot, 'docs', ['docs/guide', 'docs/index.md']),
    collectSourceFiles(revogridProRoot, 'docs', ['src/content/docs'])
  ]);

  return [...publicDocs, ...proDocs];
}
