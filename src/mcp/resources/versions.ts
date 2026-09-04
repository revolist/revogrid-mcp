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
  const [chunks, packages, capabilities, snapshot] = await Promise.all([
    services.contentRepository.getChunks(),
    services.contentRepository.getPackages(),
    services.contentRepository.getCapabilities(),
    services.contentRepository.getSnapshot()
  ]);
  return {
    ...summarizeCatalogCoverage(chunks),
    packageCount: packages.length,
    capabilityCount: capabilities.length,
    publicExportCount: capabilities.filter((item) => item.visibility === 'public').length,
    packages: packages.map((item) => ({ name: item.name, version: item.version, product: item.product })),
    snapshot
  };
}
