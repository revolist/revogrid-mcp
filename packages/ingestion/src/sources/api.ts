import { collectSourceFiles, resolveSourceRoot } from './_shared.js';
import { REVOGRID_API_PATHS, REVOGRID_PRO_API_PATHS } from './sourceMap.js';

export async function getApiSources() {
  const revogridRoot = await resolveSourceRoot(import.meta.url, 'revogrid');
  const revogridProRoot = await resolveSourceRoot(import.meta.url, 'revogrid-pro');

  const [publicApi, proApi] = await Promise.all([
    collectSourceFiles(revogridRoot, 'api', [...REVOGRID_API_PATHS]),
    collectSourceFiles(revogridProRoot, 'api', [...REVOGRID_PRO_API_PATHS])
  ]);

  return [...publicApi, ...proApi];
}
