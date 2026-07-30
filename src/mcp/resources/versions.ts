import type { AppServices } from '../../types/catalog.js';
import { summarizeCatalogCoverage } from '../tools/shared.js';

export async function readLatestVersionResource(services: AppServices) {
  const versions = await services.contentRepository.getVersions();
  return versions.find((version) => version.latest) ?? versions[0] ?? null;
}

export async function readAllVersionsResource(services: AppServices) {
  return services.contentRepository.getVersions();
}

export async function readCatalogCoverageResource(services: AppServices) {
  const chunks = await services.contentRepository.getChunks();
  return summarizeCatalogCoverage(chunks);
}
