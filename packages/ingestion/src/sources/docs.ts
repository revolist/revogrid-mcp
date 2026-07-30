import { collectSourceFiles, resolveSourceRoot } from './_shared.js';
import { REVOGRID_DOC_PATHS, REVOGRID_PRO_DOC_PATHS } from './sourceMap.js';

const IS_DOC_FILE = /\.(?:md|mdx)$/i;
const SUPERSEDED_DOC_PATHS = new Set([
  'docs/pro/new_ai.md'
]);

export async function getDocsSources() {
  const revogridRoot = await resolveSourceRoot(import.meta.url, 'revogrid');
  const revogridProRoot = await resolveSourceRoot(import.meta.url, 'revogrid-pro');

  const [publicDocs, proDocs] = await Promise.all([
    collectSourceFiles(revogridRoot, 'docs', [...REVOGRID_DOC_PATHS], {
      fileFilter: (relativePath) =>
        IS_DOC_FILE.test(relativePath) && !SUPERSEDED_DOC_PATHS.has(relativePath)
    }),
    collectSourceFiles(revogridProRoot, 'docs', [...REVOGRID_PRO_DOC_PATHS], {
      fileFilter: (relativePath) => IS_DOC_FILE.test(relativePath)
    })
  ]);

  return [...publicDocs, ...proDocs];
}
