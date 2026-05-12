import type { AppServices, RequestContext } from '../../types/catalog.js';
import { filterVisibleChunks, summarizeCatalogCoverage } from '../tools/shared.js';

export async function readLatestVersionResource(
  services: AppServices,
  context: RequestContext,
) {
  void context;
  const versions = await services.contentRepository.getVersions();
  return versions.find((version) => version.latest) ?? versions[0] ?? null;
}

export async function readAllVersionsResource(
  services: AppServices,
  context: RequestContext,
) {
  void context;
  return services.contentRepository.getVersions();
}

export async function readCatalogCoverageResource(services: AppServices, context: RequestContext) {
  const chunks = await services.contentRepository.getChunks();
  return summarizeCatalogCoverage(filterVisibleChunks(chunks, context));
}
